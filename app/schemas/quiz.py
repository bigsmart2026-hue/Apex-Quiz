"""Quiz generation request/response schemas."""
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone
from enum import Enum


class QuestionType(str, Enum):
    """Question types for generated quiz."""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"


class DifficultyLevel(str, Enum):
    """Question difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class GeneratedQuestion(BaseModel):
    """A single generated quiz question."""
    id: str
    type: QuestionType
    question_text: str = Field(..., min_length=1, max_length=5000)
    options: Optional[List[str]] = Field(default=None, max_length=6)
    correct_answer: Union[str, List[str]]
    explanation: Optional[str] = Field(default=None, max_length=2000)
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    topic_tags: List[str] = Field(default_factory=list)
    source_reference: Optional[str] = None
    
    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        if v is not None and info.data.get("type") == QuestionType.MULTIPLE_CHOICE:
            if len(v) < 2:
                raise ValueError("Multiple choice questions need at least 2 options")
            if len(v) > 6:
                raise ValueError("Maximum 6 options allowed")
        return v


class QuizRequest(BaseModel):
    """Request to generate quiz from PDF."""
    question_count: int = Field(..., ge=1, le=50, description="Number of questions to generate")
    difficulty: Optional[DifficultyLevel] = Field(default=None, description="Preferred difficulty")
    topics: Optional[List[str]] = Field(default=None, description="Specific topics to focus on")
    question_types: Optional[List[QuestionType]] = Field(
        default=None, 
        description="Types of questions to generate"
    )
    
    @field_validator("question_count")
    @classmethod
    def validate_count(cls, v: int, info) -> int:
        # Will be validated against user tier in the endpoint
        return v


class TextQuizRequest(BaseModel):
    """Request to generate quiz from direct text input."""
    text: str = Field(..., min_length=100, max_length=100000, description="Source text content")
    question_count: int = Field(..., ge=1, le=50)
    difficulty: Optional[DifficultyLevel] = None
    topics: Optional[List[str]] = None
    question_types: Optional[List[QuestionType]] = None


class QuizResponse(BaseModel):
    """Quiz generation response."""
    quiz_id: str
    questions: List[GeneratedQuestion]
    total_generated: int
    requested_count: int
    generation_time_ms: int
    source_document_id: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QuizListItem(BaseModel):
    """Quiz summary for listing."""
    quiz_id: str
    question_count: int
    created_at: datetime
    source_filename: Optional[str] = None


class QuizDetailResponse(BaseModel):
    """Full quiz details."""
    quiz_id: str
    questions: List[GeneratedQuestion]
    created_at: datetime
    source_filename: Optional[str] = None
    generation_params: Dict[str, Any] = Field(default_factory=dict)