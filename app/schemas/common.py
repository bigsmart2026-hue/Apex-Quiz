"""Error and common response schemas."""
from typing import Optional, List, Dict, Any, Generic, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from enum import Enum


T = TypeVar("T")


class ErrorCode(str, Enum):
    """Standardized error codes."""
    # Auth errors
    INVALID_TOKEN = "INVALID_TOKEN"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"

    # Tier/Subscription errors
    TIER_LIMIT_EXCEEDED = "TIER_LIMIT_EXCEEDED"
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED"
    PAYMENT_ALREADY_ACTIVE = "PAYMENT_ALREADY_ACTIVE"
    PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    PAYSTACK_NOT_CONFIGURED = "PAYSTACK_NOT_CONFIGURED"
    PAYSTACK_ERROR = "PAYSTACK_ERROR"
    PAYSTACK_SIGNATURE_INVALID = "PAYSTACK_SIGNATURE_INVALID"

    # PDF errors
    PDF_TOO_LARGE = "PDF_TOO_LARGE"
    PDF_CORRUPTED = "PDF_CORRUPTED"
    PDF_UNSUPPORTED_FORMAT = "PDF_UNSUPPORTED_FORMAT"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    STRUCTURING_LOW_QUALITY = "STRUCTURING_LOW_QUALITY"

    # Generation errors
    GENERATION_TIMEOUT = "GENERATION_TIMEOUT"
    GENERATION_FAILED = "GENERATION_FAILED"
    GEMINI_RATE_LIMIT = "GEMINI_RATE_LIMIT"
    GEMINI_ERROR = "GEMINI_ERROR"

    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_REQUEST = "INVALID_REQUEST"

    # System errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"


class ErrorDetail(BaseModel):
    """Detailed error information."""
    code: ErrorCode
    message: str
    field: Optional[str] = None
    recoverable: bool = False
    suggestions: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: ErrorDetail
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response wrapper."""
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaginatedResponse(BaseModel):
    """Paginated list response."""
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
