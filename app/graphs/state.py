"""LangGraph state definitions for quiz generation."""
from typing import TypedDict, List, Optional, Dict, Any
from app.schemas.pdf_structure import StructuredContent
from app.schemas.quiz import GeneratedQuestion, DifficultyLevel, QuestionType


class QuizGenerationState(TypedDict):
    """State for quiz generation workflow."""
    # Input
    user_id: str
    tier: str  # "free" or "premium"
    pdf_content: StructuredContent
    requested_count: int
    difficulty: Optional[DifficultyLevel]
    question_types: Optional[List[QuestionType]]
    topics: Optional[List[str]]
    
    # Processing
    selected_blocks: List[Dict[str, Any]]  # Selected question blocks
    generated_questions: List[GeneratedQuestion]
    validation_errors: List[str]
    retry_count: int
    
    # Output
    final_questions: List[GeneratedQuestion]
    warnings: List[str]
    generation_time_ms: int


# Node functions will be imported from nodes.py