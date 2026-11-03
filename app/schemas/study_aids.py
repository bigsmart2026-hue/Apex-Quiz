"""Study aid generation schemas: grounded flashcards and multiple-choice quizzes.

The schemas mirror the output contract used by the study aid generation
service. They are intentionally strict so malformed LLM output is rejected
before it ever reaches persistence or the UI.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class StudyDifficulty(str, Enum):
    """Difficulty levels for generated study aids."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class FlashcardItem(BaseModel):
    """A single atomic flashcard grounded in the source text."""
    id: str = Field(..., min_length=1, max_length=64, description="Unique identifier for the flashcard")
    front: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Concise, specific question or term prompt",
    )
    back: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Clear, precise answer grounded in the text",
    )
    source_reference: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Verbatim snippet from the source text proving grounding",
    )

    @field_validator("front", "back", "source_reference")
    @classmethod
    def _strip_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty or whitespace")
        return value


class QuizItem(BaseModel):
    """A single multiple-choice question with engineered distractors."""
    id: str = Field(..., min_length=1, max_length=64, description="Unique identifier for the question")
    question: str = Field(..., min_length=1, max_length=5000, description="Clear multiple-choice question stem")
    options: List[str] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Exactly four options: one correct answer and three distractors",
    )
    correct_answer_index: int = Field(
        ...,
        ge=0,
        le=3,
        description="Index of the correct option (0-3)",
    )
    explanation: str = Field(
        ...,
        min_length=1,
        max_length=3000,
        description="Why the answer is correct, citing the source text",
    )
    source_reference: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Verbatim snippet from the source text proving grounding",
    )
    difficulty: StudyDifficulty = Field(
        default=StudyDifficulty.MEDIUM,
        description="Question difficulty",
    )
    topic_tags: List[str] = Field(default_factory=list, description="Optional topic tags")

    @field_validator("question", "explanation", "source_reference")
    @classmethod
    def _strip_non_empty(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty or whitespace")
        return value

    @field_validator("options")
    @classmethod
    def _validate_options(cls, options: List[str]) -> List[str]:
        cleaned = [str(option).strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("Options cannot be empty")
        if len({option.casefold() for option in cleaned}) != len(cleaned):
            raise ValueError("Options must be unique")
        return cleaned


class StudyAidPayload(BaseModel):
    """Validated LLM output: flashcards plus quiz questions."""
    flashcards: List[FlashcardItem] = Field(default_factory=list)
    quiz_questions: List[QuizItem] = Field(default_factory=list)

    @property
    def total_items(self) -> int:
        return len(self.flashcards) + len(self.quiz_questions)


class StudyAidGenerationRequest(BaseModel):
    """Request to generate study aids from pasted text."""
    source_text: str = Field(..., min_length=100, max_length=200000)
    num_flashcards: int = Field(default=5, ge=0, le=50)
    num_quizzes: int = Field(default=5, ge=0, le=50)
    difficulty: StudyDifficulty = StudyDifficulty.MEDIUM
    topics: Optional[List[str]] = Field(default=None, description="Optional topics to focus on")

    @model_validator(mode="after")
    def _at_least_one_item(self) -> "StudyAidGenerationRequest":
        if self.num_flashcards + self.num_quizzes < 1:
            raise ValueError("Request at least one flashcard or quiz question")
        return self


class StudySetResponse(BaseModel):
    """Complete generated study set returned to clients."""
    study_set_id: str
    flashcards: List[FlashcardItem]
    quiz_questions: List[QuizItem]
    flashcard_count: int
    quiz_count: int
    generation_time_ms: int
    grounding_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Fraction of raw LLM items that passed grounding verification",
    )
    chunks_processed: int
    warnings: List[str] = Field(default_factory=list)
    source_filename: Optional[str] = None
    cached: bool = Field(
        default=False,
        description="True when this set was returned from the cache instead of regenerated",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudySetListItem(BaseModel):
    """Summary of a stored study set."""
    study_set_id: str
    flashcard_count: int
    quiz_count: int
    grounding_score: float
    created_at: datetime
    source_filename: Optional[str] = None
