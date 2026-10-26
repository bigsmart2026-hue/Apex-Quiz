"""NotebookLM-style study aid generation pipeline.

The pipeline is built on four pillars:

1. **Strict source grounding** — every item must carry a verbatim snippet from
   the source text. Snippets are verified against the extracted text before an
   item is accepted, so hallucinated facts are dropped instead of shown.
2. **Atomic pedagogical decomposition** — the master prompt forces one single
   concept per flashcard/question.
3. **Structured JSON output** — Gemini JSON mode plus a Pydantic validation and
   salvage layer, so malformed output never reaches persistence.
4. **Distractor engineering** — four unique options per quiz item, with three
   plausible wrong answers drawn from the source context.

Large documents are processed with an overlapping sliding-window chunker. Each
chunk is generated independently (bounded concurrency) and the results are
deduplicated and trimmed to the requested counts.
"""
import asyncio
import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from pydantic import ValidationError

from app.config.settings import get_settings
from app.schemas.study_aids import FlashcardItem, QuizItem, StudyAidPayload
from app.services.gemini_client import gemini_client


settings = get_settings()


def compute_request_hash(
    source: Union[str, bytes],
    num_flashcards: int,
    num_quizzes: int,
    difficulty: str,
    topics: Optional[List[str]] = None,
) -> str:
    """Return a stable cache key for a study aid request.

    The key covers both the source content and the generation parameters, so
    requesting the same text with different counts, difficulty, or topics
    produces a fresh set instead of a mismatched cached one.
    """
    digest = hashlib.sha256()
    if isinstance(source, str):
        digest.update(source.encode("utf-8"))
    else:
        digest.update(source)

    signature = "|".join(
        [
            str(num_flashcards),
            str(num_quizzes),
            (difficulty or "medium").lower(),
            ",".join(sorted(topic.casefold() for topic in (topics or []))),
        ]
    )
    digest.update(b"\x00")
    digest.update(signature.encode("utf-8"))
    return digest.hexdigest()


# ---------------------------------------------------------------------------
# Master Studio Prompt
# ---------------------------------------------------------------------------

MASTER_STUDIO_PROMPT = """\
Role: You are an expert instructional designer, psychometrician, and curriculum engineer specializing in automated study aid generation.

Objective: Analyze the provided source text and generate a comprehensive, high-quality set of study aids consisting of atomic flashcards and multiple-choice quiz questions.

### Strict Operating Rules:
1. GROUNDING ABSOLUTE: Use ONLY the provided source text. Do not extrapolate, assume, or bring in external knowledge. If a fact is not in the text, do not use it.
2. ATOMIC DECOMPOSITION: Each flashcard or quiz question must test ONE single concept, definition, or relationship. Never combine multiple sub-questions into a single item.
3. DISTRACTOR PLAUSIBILITY: For multiple-choice questions, generate 3 incorrect options (distractors) that target common misconceptions or pull related, confusing concepts directly from the text. Avoid obviously absurd wrong answers.
4. JSON FORMATTING: Output must be raw, valid JSON matching the schema specified below. No markdown wrapping outside the JSON block, no conversational filler.
5. SOURCE REFERENCES MUST BE VERBATIM: The "source_reference" value must be copied character-for-character from the Source Text. Never paraphrase or summarize it.

### Required JSON Output Schema:
{
  "flashcards": [
    {
      "id": "fc_001",
      "front": "Concise, specific question or term prompt",
      "back": "Clear, precise answer grounded in the text",
      "source_reference": "Exact keyword or sentence snippet from the text proving grounding"
    }
  ],
  "quiz_questions": [
    {
      "id": "q_001",
      "question": "Clear multiple-choice question stem",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correct_answer_index": 1,
      "explanation": "Detailed explanation citing why this answer is correct based on the source text.",
      "source_reference": "Exact text snippet supporting this question",
      "difficulty": "easy|medium|hard",
      "topic_tags": ["topic1", "topic2"]
    }
  ]
}"""


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ChunkResult:
    """Generation result for a single source chunk."""
    payload: StudyAidPayload
    raw_item_count: int = 0
    grounded_item_count: int = 0
    warnings: List[str] = field(default_factory=list)


@dataclass
class StudyAidResult:
    """Aggregated generation result across all chunks."""
    payload: StudyAidPayload
    warnings: List[str] = field(default_factory=list)
    grounding_score: float = 0.0
    chunks_processed: int = 0
    generation_time_ms: int = 0
    raw_item_count: int = 0
    grounded_item_count: int = 0


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

_WHITESPACE_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalize_text(text: str) -> str:
    """Normalize line endings and collapse runs of whitespace."""
    return _WHITESPACE_RE.sub(" ", (text or "").replace("\r\n", "\n").replace("\r", "\n")).strip()


def normalize_for_grounding(text: str) -> str:
    """Case-folded, whitespace-collapsed form used for exact grounding checks."""
    return normalize_text(text).casefold()


def normalize_for_grounding_loose(text: str) -> str:
    """Case-folded form with punctuation removed, tolerant of LLM punctuation drift."""
    return _WHITESPACE_RE.sub(" ", _PUNCT_RE.sub("", (text or "").casefold())).strip()


def chunk_source_text(
    text: str,
    chunk_size: int = 12000,
    overlap: int = 400,
    max_chunks: int = 8,
) -> List[str]:
    """Split source text into overlapping chunks, preferring paragraph breaks.

    The overlap preserves context across boundaries so a concept split between
    two chunks can still be understood. A hard cap prevents runaway API usage
    on very large documents.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: List[str] = []
    start = 0
    while start < len(text) and len(chunks) < max_chunks:
        end = min(start + chunk_size, len(text))

        if end < len(text):
            # Prefer a paragraph break in the second half of the window.
            boundary = text.rfind("\n\n", start + chunk_size // 2, end)
            if boundary == -1:
                boundary = text.rfind(". ", start + chunk_size // 2, end)
                if boundary != -1:
                    boundary += 1
            if boundary > start:
                end = boundary

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def _allocate(total: int, weights: List[int]) -> List[int]:
    """Distribute `total` items across chunks proportionally to their sizes."""
    if total <= 0 or not weights:
        return [0] * len(weights)

    weight_sum = sum(weights) or len(weights)
    raw = [total * weight / weight_sum for weight in weights]
    counts = [int(value) for value in raw]
    remainder = total - sum(counts)

    by_fraction = sorted(
        range(len(raw)),
        key=lambda index: raw[index] - counts[index],
        reverse=True,
    )
    for index in by_fraction[:remainder]:
        counts[index] += 1
    return counts


# ---------------------------------------------------------------------------
# Grounding verification
# ---------------------------------------------------------------------------

def is_grounded(
    reference: str,
    normalized_source: str,
    loose_source: str,
    min_chars: int = 8,
) -> bool:
    """Return True when a reference can be traced back to the source text.

    Three tiers of tolerance:
    1. Exact substring match on normalized text.
    2. Punctuation-insensitive substring match.
    3. Token-overlap match (>= 90%) for minor edits or truncated quotes.
    """
    if not reference or not normalized_source:
        return False

    reference = reference.strip().strip('"\'`“”‘’')

    normalized_reference = normalize_for_grounding(reference)
    if normalized_reference and normalized_reference in normalized_source:
        return True

    loose_reference = normalize_for_grounding_loose(reference)
    if len(loose_reference) >= min_chars and loose_reference in loose_source:
        return True

    reference_tokens = loose_reference.split()
    if len(reference_tokens) >= 6:
        source_tokens = set(loose_source.split())
        overlap = sum(1 for token in reference_tokens if token in source_tokens) / len(reference_tokens)
        if overlap >= 0.9:
            return True

    return False


# ---------------------------------------------------------------------------
# JSON parsing and validation
# ---------------------------------------------------------------------------

def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _slice_json(text: str, opener: str, closer: str) -> Optional[str]:
    start = text.find(opener)
    end = text.rfind(closer)
    if start != -1 and end > start:
        return text[start:end + 1]
    return None


def _repair_json(text: str) -> str:
    """Apply conservative repairs for common LLM JSON mistakes."""
    # Remove trailing commas before a closing bracket/brace.
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Normalize smart quotes that would break JSON strings.
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return text


def extract_json_object(raw: str) -> Optional[Dict[str, Any]]:
    """Extract a JSON object from an LLM response with conservative repair."""
    if not raw:
        return None

    text = _strip_code_fences(raw)
    candidates = [text]

    object_slice = _slice_json(text, "{", "}")
    if object_slice and object_slice != text:
        candidates.append(object_slice)

    for candidate in candidates:
        for attempt in (candidate, _repair_json(candidate)):
            try:
                data = json.loads(attempt)
            except (json.JSONDecodeError, TypeError):
                continue
            if isinstance(data, dict):
                return data

    return None


def _coerce_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _coerce_options(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [_coerce_string(option) for option in value]


def _coerce_index(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            return int(stripped)
        # Accept a letter answer ("A", "B", ...) as a convenience.
        if len(stripped) == 1 and stripped.upper().isalpha():
            return ord(stripped.upper()) - ord("A")
    return 0


def _normalize_flashcard_dict(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    return {
        "id": _coerce_string(item.get("id")) or f"fc_{index + 1:03d}",
        "front": _coerce_string(item.get("front") or item.get("question") or item.get("term")),
        "back": _coerce_string(item.get("back") or item.get("answer") or item.get("definition")),
        "source_reference": _coerce_string(
            item.get("source_reference") or item.get("source") or item.get("reference")
        ),
    }


def _normalize_quiz_dict(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    return {
        "id": _coerce_string(item.get("id")) or f"q_{index + 1:03d}",
        "question": _coerce_string(item.get("question") or item.get("question_text") or item.get("stem")),
        "options": _coerce_options(item.get("options") or item.get("choices")),
        "correct_answer_index": _coerce_index(
            item.get("correct_answer_index", item.get("correct_index", item.get("answer_index")))
        ),
        "explanation": _coerce_string(item.get("explanation") or item.get("rationale")),
        "source_reference": _coerce_string(
            item.get("source_reference") or item.get("source") or item.get("reference")
        ),
        "difficulty": item.get("difficulty") or "medium",
        "topic_tags": [str(tag) for tag in item.get("topic_tags", [])] if isinstance(item.get("topic_tags"), list) else [],
    }


def parse_study_aid_payload(
    raw: str,
    source_text: str,
    min_grounding_chars: int = 8,
) -> ChunkResult:
    """Parse, validate, ground, and deduplicate a single model response."""
    warnings: List[str] = []
    normalized_source = normalize_for_grounding(source_text)
    loose_source = normalize_for_grounding_loose(source_text)

    data = extract_json_object(raw)
    if data is None:
        if raw and raw.strip():
            warnings.append("Model response was not valid JSON; no items were extracted.")
        return ChunkResult(payload=StudyAidPayload(), warnings=warnings)

    raw_flashcards = data.get("flashcards") or data.get("cards") or []
    raw_quizzes = (
        data.get("quiz_questions")
        or data.get("quizzes")
        or data.get("quiz")
        or data.get("questions")
        or []
    )
    if not isinstance(raw_flashcards, list):
        raw_flashcards = []
    if not isinstance(raw_quizzes, list):
        raw_quizzes = []

    raw_item_count = len(raw_flashcards) + len(raw_quizzes)
    grounded_item_count = 0
    flashcards: List[FlashcardItem] = []
    quizzes: List[QuizItem] = []

    for index, item in enumerate(raw_flashcards):
        if not isinstance(item, dict):
            continue
        try:
            card = FlashcardItem.model_validate(_normalize_flashcard_dict(item, index))
        except ValidationError:
            warnings.append(f"Skipped malformed flashcard at index {index}.")
            continue
        if not is_grounded(card.source_reference, normalized_source, loose_source, min_grounding_chars):
            warnings.append(f"Dropped ungrounded flashcard: {card.front[:80]!r}")
            continue
        flashcards.append(card)
        grounded_item_count += 1

    for index, item in enumerate(raw_quizzes):
        if not isinstance(item, dict):
            continue
        try:
            quiz = QuizItem.model_validate(_normalize_quiz_dict(item, index))
        except ValidationError:
            warnings.append(f"Skipped malformed quiz question at index {index}.")
            continue
        if not is_grounded(quiz.source_reference, normalized_source, loose_source, min_grounding_chars):
            warnings.append(f"Dropped ungrounded quiz question: {quiz.question[:80]!r}")
            continue
        quizzes.append(quiz)
        grounded_item_count += 1

    flashcards = _dedupe_flashcards(flashcards)
    quizzes = _dedupe_quizzes(quizzes)

    return ChunkResult(
        payload=StudyAidPayload(flashcards=flashcards, quiz_questions=quizzes),
        raw_item_count=raw_item_count,
        grounded_item_count=grounded_item_count,
        warnings=warnings,
    )


def _dedupe_flashcards(cards: List[FlashcardItem]) -> List[FlashcardItem]:
    seen: set[str] = set()
    output: List[FlashcardItem] = []
    for card in cards:
        key = normalize_for_grounding_loose(f"{card.front} {card.back}")
        if key in seen:
            continue
        seen.add(key)
        output.append(card)
    return output


def _dedupe_quizzes(quizzes: List[QuizItem]) -> List[QuizItem]:
    seen: set[str] = set()
    output: List[QuizItem] = []
    for quiz in quizzes:
        key = normalize_for_grounding_loose(quiz.question)
        if key in seen:
            continue
        seen.add(key)
        output.append(quiz)
    return output


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

def build_generation_prompt(
    chunk: str,
    num_flashcards: int,
    num_quizzes: int,
    difficulty: str = "medium",
    topics: Optional[List[str]] = None,
) -> str:
    """Assemble the master prompt for one chunk."""
    topics_line = ", ".join(topics) if topics else "all topics present in the text"
    return f"""{MASTER_STUDIO_PROMPT}

### Generation Targets:
- Flashcards: exactly {num_flashcards}
- Quiz questions: exactly {num_quizzes}
- Difficulty: {difficulty}
- Focus topics: {topics_line}

### Source Text:
<<<SOURCE_START>>>
{chunk}
<<<SOURCE_END>>>

Generate exactly {num_flashcards} flashcards and exactly {num_quizzes} multiple-choice quiz questions.
Return ONLY the JSON object. Every "source_reference" MUST be a verbatim snippet copied from the Source Text above."""


# ---------------------------------------------------------------------------
# Generation service
# ---------------------------------------------------------------------------

class StudyAidService:
    """Grounded flashcard/quiz generation with chunking and validation."""

    def __init__(self) -> None:
        self.chunk_size = settings.STUDY_AID_CHUNK_SIZE
        self.chunk_overlap = settings.STUDY_AID_CHUNK_OVERLAP
        self.max_chunks = settings.STUDY_AID_MAX_CHUNKS
        self.concurrency = max(1, settings.STUDY_AID_CONCURRENCY)
        self.max_output_tokens = settings.STUDY_AID_MAX_OUTPUT_TOKENS
        self.min_grounding_chars = settings.STUDY_AID_GROUNDING_MIN_CHARS

    async def generate(
        self,
        source_text: str,
        num_flashcards: int = 5,
        num_quizzes: int = 5,
        difficulty: str = "medium",
        topics: Optional[List[str]] = None,
    ) -> StudyAidResult:
        """Generate grounded study aids from raw text."""
        start_time = time.time()

        source_text = (source_text or "").strip()
        if len(source_text) < 100:
            raise ValueError("Source text must be at least 100 characters long.")

        chunks = chunk_source_text(
            source_text,
            chunk_size=self.chunk_size,
            overlap=self.chunk_overlap,
            max_chunks=self.max_chunks,
        )
        if not chunks:
            raise ValueError("Source text produced no chunks.")

        warnings: List[str] = []
        if len(chunks) >= self.max_chunks and len(source_text) > sum(len(c) for c in chunks):
            warnings.append(
                f"Document was truncated to the first {self.max_chunks} chunks for speed. "
                "Only the beginning of the document was used."
            )

        card_allocations = _allocate(num_flashcards, [len(chunk) for chunk in chunks])
        quiz_allocations = _allocate(num_quizzes, [len(chunk) for chunk in chunks])

        semaphore = asyncio.Semaphore(self.concurrency)

        async def run_chunk(index: int) -> ChunkResult:
            async with semaphore:
                return await self._generate_chunk(
                    chunk=chunks[index],
                    num_flashcards=card_allocations[index],
                    num_quizzes=quiz_allocations[index],
                    difficulty=difficulty,
                    topics=topics,
                )

        chunk_results = await asyncio.gather(
            *(run_chunk(index) for index in range(len(chunks))),
            return_exceptions=True,
        )

        flashcards: List[FlashcardItem] = []
        quizzes: List[QuizItem] = []
        raw_item_count = 0
        grounded_item_count = 0
        successful_chunks = 0

        for index, result in enumerate(chunk_results):
            if isinstance(result, Exception):
                message = str(result) or result.__class__.__name__
                warnings.append(f"Chunk {index + 1} failed: {message}")
                continue

            successful_chunks += 1
            warnings.extend(result.warnings)
            flashcards.extend(result.payload.flashcards)
            quizzes.extend(result.payload.quiz_questions)
            raw_item_count += result.raw_item_count
            grounded_item_count += result.grounded_item_count

        if successful_chunks == 0:
            detail = next(
                (warning for warning in warnings if warning.startswith("Chunk ")),
                "No successful model response.",
            )
            raise ValueError(
                "Study aid generation failed for every chunk. "
                f"{detail} Check the Gemini API key, quota, and network connection."
            )

        flashcards = _dedupe_flashcards(flashcards)[:num_flashcards]
        quizzes = _dedupe_quizzes(quizzes)[:num_quizzes]

        for index, card in enumerate(flashcards):
            card.id = f"fc_{index + 1:03d}"
        for index, quiz in enumerate(quizzes):
            quiz.id = f"q_{index + 1:03d}"

        if raw_item_count and grounded_item_count < raw_item_count:
            warnings.append(
                f"Dropped {raw_item_count - grounded_item_count} item(s) that could not be "
                "verified against the source text."
            )

        grounding_score = (
            grounded_item_count / raw_item_count if raw_item_count else 0.0
        )

        generation_time_ms = int((time.time() - start_time) * 1000)

        return StudyAidResult(
            payload=StudyAidPayload(flashcards=flashcards, quiz_questions=quizzes),
            warnings=warnings,
            grounding_score=round(min(1.0, max(0.0, grounding_score)), 4),
            chunks_processed=successful_chunks,
            generation_time_ms=generation_time_ms,
            raw_item_count=raw_item_count,
            grounded_item_count=grounded_item_count,
        )

    async def _generate_chunk(
        self,
        chunk: str,
        num_flashcards: int,
        num_quizzes: int,
        difficulty: str,
        topics: Optional[List[str]],
    ) -> ChunkResult:
        """Generate and validate study aids for a single chunk."""
        if num_flashcards <= 0 and num_quizzes <= 0:
            return ChunkResult(payload=StudyAidPayload())

        prompt = build_generation_prompt(
            chunk=chunk,
            num_flashcards=num_flashcards,
            num_quizzes=num_quizzes,
            difficulty=difficulty,
            topics=topics,
        )

        response = await gemini_client.generate_json(
            prompt,
            max_output_tokens=self.max_output_tokens,
        )

        if not response.success:
            raise RuntimeError(response.error or "Gemini generation failed")

        return parse_study_aid_payload(
            raw=response.text,
            source_text=chunk,
            min_grounding_chars=self.min_grounding_chars,
        )


# Singleton instance
study_aid_service = StudyAidService()
