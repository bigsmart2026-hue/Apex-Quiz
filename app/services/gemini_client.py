"""Gemini AI client for text generation and vision.

The legacy ``google-generativeai`` SDK is deprecated and its async path can
block for the full timeout while retrying 5xx responses (for example, a 503
"model is experiencing high demand"). This client calls the Generative
Language REST API directly with ``httpx`` so we control the timeout, see the
real error, and can fail over across a configurable model chain.
"""
import asyncio
import base64
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from app.config.settings import get_settings


settings = get_settings()

GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Status codes worth moving to the next model in the chain.
FAILOVER_STATUS_CODES = {404, 429, 500, 502, 503, 504}
# Status codes that may recover on a second pass over the chain.
TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}


@dataclass
class GeminiResponse:
    """Gemini API response."""
    text: str
    model: str
    usage: Dict[str, int]
    latency_ms: int
    success: bool
    error: Optional[str] = None


class GeminiClient:
    """REST wrapper for Google Gemini with model failover."""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.flash_model_name = settings.GEMINI_FLASH_MODEL
        self.request_timeout = settings.GEMINI_REQUEST_TIMEOUT

        fallbacks = [
            name.strip()
            for name in (settings.GEMINI_FALLBACK_MODELS or "").split(",")
            if name.strip()
        ]
        self.model_chain = [self.flash_model_name] + [
            name for name in fallbacks if name != self.flash_model_name
        ]

    # ------------------------------------------------------------------
    # REST helpers
    # ------------------------------------------------------------------

    def _extract_text(self, data: Dict[str, Any]) -> str:
        for candidate in data.get("candidates") or []:
            parts = (candidate.get("content") or {}).get("parts") or []
            text = "".join(
                part.get("text", "")
                for part in parts
                if isinstance(part, dict)
            )
            if text.strip():
                return text
        return ""

    def _extract_usage(self, data: Dict[str, Any]) -> Dict[str, int]:
        usage = data.get("usageMetadata") or {}
        return {
            "prompt_tokens": usage.get("promptTokenCount", 0),
            "candidates_tokens": usage.get("candidatesTokenCount", 0),
            "total_tokens": usage.get("totalTokenCount", 0),
        }

    async def _call_model(
        self,
        model_name: str,
        parts: List[Dict[str, Any]],
        generation_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"contents": [{"parts": parts}]}
        if generation_config:
            payload["generationConfig"] = generation_config

        async with httpx.AsyncClient(timeout=self.request_timeout) as client:
            response = await client.post(
                f"{GEMINI_REST_BASE}/models/{model_name}:generateContent",
                # Send the key as a header so it never appears in request logs
                # or error messages that include the URL.
                headers={"x-goog-api-key": self.api_key},
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def _generate_across_models(
        self,
        parts: List[Dict[str, Any]],
        generation_config: Optional[Dict[str, Any]] = None,
    ) -> GeminiResponse:
        """Try each model in the chain, then retry transient failures once."""
        if not self.api_key:
            return GeminiResponse(
                text="",
                model="none",
                usage={},
                latency_ms=0,
                success=False,
                error="Gemini API key not configured",
            )

        overall_started = time.time()
        last_error = "No Gemini models configured"
        max_attempts = max(1, settings.GEMINI_MAX_ATTEMPTS)

        for attempt in range(1, max_attempts + 1):
            transient_failure = False

            for model_name in self.model_chain:
                started = time.time()
                try:
                    data = await self._call_model(model_name, parts, generation_config)
                    latency = int((time.time() - started) * 1000)
                    text = self._extract_text(data)

                    if not text.strip():
                        last_error = f"GEMINI_ERROR: empty response from {model_name}"
                        continue

                    finish_reason = ""
                    for candidate in data.get("candidates") or []:
                        finish_reason = candidate.get("finishReason", "")
                        break
                    if finish_reason and finish_reason != "STOP":
                        last_error = (
                            f"GEMINI_ERROR: {finish_reason} from {model_name}"
                        )
                        continue

                    return GeminiResponse(
                        text=text,
                        model=model_name,
                        usage=self._extract_usage(data),
                        latency_ms=latency,
                        success=True,
                    )
                except httpx.TimeoutException:
                    last_error = (
                        f"GEMINI_TIMEOUT: {model_name} did not respond in "
                        f"{self.request_timeout:.0f}s"
                    )
                    continue
                except httpx.HTTPStatusError as exc:
                    status_code = exc.response.status_code
                    body = exc.response.text[:300]
                    last_error = f"GEMINI_ERROR: {status_code} {body}"

                    if status_code not in FAILOVER_STATUS_CODES:
                        # Bad request, auth, or permission error: retrying
                        # another model will not help.
                        return GeminiResponse(
                            text="",
                            model=model_name,
                            usage={},
                            latency_ms=int((time.time() - started) * 1000),
                            success=False,
                            error=last_error,
                        )
                    if status_code in TRANSIENT_STATUS_CODES:
                        transient_failure = True
                    continue
                except Exception as exc:
                    last_error = f"GEMINI_ERROR: {exc}"
                    continue

            if transient_failure and attempt < max_attempts:
                await asyncio.sleep(settings.GEMINI_RETRY_DELAY)
                continue
            break

        return GeminiResponse(
            text="",
            model=self.flash_model_name,
            usage={},
            latency_ms=int((time.time() - overall_started) * 1000),
            success=False,
            error=last_error,
        )

    def _default_generation_config(
        self,
        max_output_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> Dict[str, Any]:
        config: Dict[str, Any] = {
            "temperature": settings.GEMINI_TEMPERATURE,
            "topP": 0.8,
            "topK": 40,
            "maxOutputTokens": max_output_tokens or settings.GEMINI_MAX_OUTPUT_TOKENS,
        }
        if json_mode:
            config["responseMimeType"] = "application/json"
        return config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate(self, prompt: str) -> GeminiResponse:
        """Generate plain text using the model chain."""
        return await self._generate_across_models(
            [{"text": prompt}],
            self._default_generation_config(),
        )

    async def generate_json(
        self,
        prompt: str,
        max_output_tokens: Optional[int] = None,
    ) -> GeminiResponse:
        """Generate content constrained to JSON, with a plain-text fallback."""
        parts = [{"text": prompt}]
        result = await self._generate_across_models(
            parts,
            self._default_generation_config(
                max_output_tokens=max_output_tokens,
                json_mode=True,
            ),
        )

        # Some models/proxies reject responseMimeType with a 400. Retry plain.
        if not result.success and result.error and " 400 " in result.error:
            return await self._generate_across_models(
                parts,
                self._default_generation_config(max_output_tokens=max_output_tokens),
            )

        return result

    async def generate_with_fallback(self, prompt: str) -> GeminiResponse:
        """Backwards-compatible alias for generate()."""
        return await self.generate(prompt)

    async def structure_content(self, prompt: str) -> str:
        """Structure content using Gemini (uses Flash for speed)."""
        result = await self.generate_with_fallback(prompt)
        if not result.success:
            raise ValueError(f"Gemini structuring failed: {result.error}")
        return result.text

    async def extract_text_from_images(self, images: List[Dict[str, Any]]) -> str:
        """Extract text from page images using Gemini Vision."""
        if not self.api_key:
            return ""

        prompt = (
            "Extract ALL text from these PDF page images. "
            "Preserve structure: headings, paragraphs, lists, tables. "
            "For tables, format as markdown tables. "
            "Return only the extracted text, no commentary."
        )

        parts: List[Dict[str, Any]] = [{"text": prompt}]
        for image in images[:10]:  # Limit to 10 images
            parts.append({
                "inlineData": {
                    "mimeType": "image/png",
                    "data": base64.b64encode(image["data"]).decode(),
                }
            })

        result = await self._generate_across_models(parts)
        if not result.success:
            return f"[Vision extraction failed: {result.error}]"
        return result.text

    async def generate_quiz(
        self,
        structured_content: str,
        question_count: int,
        difficulty: str = "medium",
        question_types: Optional[List[str]] = None,
        topics: Optional[List[str]] = None,
    ) -> GeminiResponse:
        """Generate playable quiz questions from structured content."""
        supported_types = [
            question_type
            for question_type in (question_types or [])
            if question_type in {"multiple_choice", "true_false"}
        ]
        if not supported_types:
            supported_types = ["multiple_choice", "true_false"]
        types_str = ", ".join(supported_types)
        topics_str = ", ".join(topics) if topics else "all topics"

        # Truncate to 15000 chars for free-tier speed
        content_preview = structured_content[:15000]

        prompt = f"""Generate exactly {question_count} playable quiz questions from the following structured content.

STRUCTURED CONTENT:
{content_preview}

REQUIREMENTS:
- Generate exactly {question_count} questions
- Difficulty: {difficulty}
- Question types: {types_str}. Do not generate short-answer questions.
- Focus topics: {topics_str}
- Each question must be clear, accurate, and answerable from the content
- Multiple-choice questions must have exactly 4 distinct options, and correct_answer must exactly match one of the options
- True/false questions must have options ["True", "False"], and correct_answer must be "True" or "False"
- Include explanations for answers
- Verify the correct answer before returning it

OUTPUT FORMAT (JSON array):
[
  {{
    "id": "q1",
    "type": "multiple_choice",
    "question_text": "Question text",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "Why this is correct",
    "difficulty": "easy|medium|hard",
    "topic_tags": ["topic1", "topic2"],
    "source_reference": "Page X, Section Y"
  }}
]

Return ONLY the JSON array. Do not wrap it in markdown fences."""

        return await self.generate_json(prompt, max_output_tokens=8192)


# Singleton instance
gemini_client = GeminiClient()
