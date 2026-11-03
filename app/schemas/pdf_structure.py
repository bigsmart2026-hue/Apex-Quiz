"""PDF processing and structure schemas."""
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone


class QuestionType(str, Enum):
    """Supported question types."""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    TABLE_BASED = "table_based"


class ExtractionMethod(str, Enum):
    """PDF extraction method used."""
    PDFPLUMBER = "pdfplumber"
    PYMUPDF = "pymupdf"
    PDFMINER = "pdfminer"
    GEMINI_VISION = "gemini_vision"


class QuestionBlock(BaseModel):
    """Structured question extracted from PDF."""
    type: QuestionType
    question_text: str = Field(..., min_length=1, max_length=5000)
    options: Optional[List[str]] = Field(default=None, max_length=6)
    correct_answer: Union[str, List[str]]
    explanation: Optional[str] = Field(default=None, max_length=2000)
    source_location: Dict[str, Any] = Field(
        default_factory=dict,
        description="Page, coordinates, extraction method metadata"
    )
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Confidence score for this extraction (0-1)"
    )
    
    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        if v is not None:
            # For multiple choice, need at least 2 options
            if info.data.get("type") == QuestionType.MULTIPLE_CHOICE and len(v) < 2:
                raise ValueError("Multiple choice questions need at least 2 options")
            # For true/false, normalize to True/False
            if info.data.get("type") == QuestionType.TRUE_FALSE:
                return ["True", "False"]
        return v


class DocumentMetadata(BaseModel):
    """Metadata about the processed document."""
    filename: str
    file_size_bytes: int
    page_count: int
    extraction_method: ExtractionMethod
    processing_time_ms: int
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: List[str] = Field(default_factory=list)


class StructuredContent(BaseModel):
    """Complete structured content from PDF."""
    blocks: List[QuestionBlock] = Field(default_factory=list)
    metadata: DocumentMetadata
    extraction_quality: float = Field(..., ge=0.0, le=1.0)
    warnings: List[str] = Field(default_factory=list)
    
    @property
    def question_count(self) -> int:
        return len(self.blocks)


class RawExtraction(BaseModel):
    """Raw extraction result before structuring."""
    text: str
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[Dict[str, Any]] = Field(default_factory=list)
    method: ExtractionMethod
    page_count: int
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)