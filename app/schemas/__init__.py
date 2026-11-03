"""Schema exports."""
from app.schemas.subscription import SubscriptionTier, TierLimits, SubscriptionStatus
from app.schemas.pdf_structure import (
    QuestionBlock,
    StructuredContent,
    RawExtraction,
    DocumentMetadata,
    QuestionType,
    ExtractionMethod,
)
from app.schemas.quiz import (
    GeneratedQuestion,
    QuizRequest,
    TextQuizRequest,
    QuizResponse,
    QuizListItem,
    QuizDetailResponse,
    QuestionType as QuizQuestionType,
    DifficultyLevel,
)
from app.schemas.common import (
    ErrorCode,
    ErrorDetail,
    ErrorResponse,
    SuccessResponse,
    PaginatedResponse,
)
from app.schemas.study_aids import (
    FlashcardItem,
    QuizItem,
    StudyAidPayload,
    StudyAidGenerationRequest,
    StudySetResponse,
    StudySetListItem,
    StudyDifficulty,
)

__all__ = [
    "SubscriptionTier",
    "TierLimits",
    "SubscriptionStatus",
    "QuestionBlock",
    "StructuredContent",
    "RawExtraction",
    "DocumentMetadata",
    "QuestionType",
    "ExtractionMethod",
    "GeneratedQuestion",
    "QuizRequest",
    "TextQuizRequest",
    "QuizResponse",
    "QuizListItem",
    "QuizDetailResponse",
    "QuizQuestionType",
    "DifficultyLevel",
    "ErrorCode",
    "ErrorDetail",
    "ErrorResponse",
    "SuccessResponse",
    "PaginatedResponse",
    "FlashcardItem",
    "QuizItem",
    "StudyAidPayload",
    "StudyAidGenerationRequest",
    "StudySetResponse",
    "StudySetListItem",
    "StudyDifficulty",
]