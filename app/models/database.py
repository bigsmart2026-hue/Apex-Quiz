"""Database models using SQLModel."""
from typing import Optional
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Float, JSON, Enum as SAEnum
import uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SubscriptionTier(str, PyEnum):
    FREE = "free"
    PREMIUM = "premium"


class PaystackSubscriptionStatus(str, PyEnum):
    """Lifecycle of a Paystack-managed subscription."""
    PENDING = "pending"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    DISABLED = "disabled"


class User(SQLModel, table=True):
    """User model."""
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(sa_column=Column(String(255), unique=True, nullable=False, index=True))
    hashed_password: str = Field(sa_column=Column(String(255), nullable=False))
    full_name: Optional[str] = Field(default=None, sa_column=Column(String(255)))

    # Subscription
    tier: SubscriptionTier = Field(
        default=SubscriptionTier.FREE,
        sa_column=Column(SAEnum(SubscriptionTier), nullable=False, default=SubscriptionTier.FREE)
    )
    is_paid: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    subscription_expires_at: Optional[datetime] = Field(default=None)
    stripe_customer_id: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    stripe_subscription_id: Optional[str] = Field(default=None, sa_column=Column(String(255)))

    # Usage tracking
    questions_generated_this_month: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    last_usage_reset: datetime = Field(default_factory=_utcnow)

    # Metadata
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    is_verified: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    last_login: Optional[datetime] = Field(default=None)


class PaystackSubscription(SQLModel, table=True):
    """Paystack subscription/customer linkage for a user.

    Kept separate from ``User`` so existing databases pick up the new
    tables through ``create_all`` without an in-place column migration.
    """
    __tablename__ = "paystack_subscriptions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    plan_code: str = Field(sa_column=Column(String(64), nullable=False))
    status: str = Field(
        default=PaystackSubscriptionStatus.PENDING.value,
        sa_column=Column(String(32), nullable=False, default=PaystackSubscriptionStatus.PENDING.value),
    )

    # Paystack identifiers. ``email_token`` is server-only (used to disable
    # a subscription) and must never be returned by an API response.
    customer_code: Optional[str] = Field(default=None, sa_column=Column(String(64), index=True))
    subscription_code: Optional[str] = Field(
        default=None, sa_column=Column(String(64), unique=True, index=True)
    )
    email_token: Optional[str] = Field(default=None, sa_column=Column(String(128)))

    next_payment_date: Optional[datetime] = Field(default=None)
    last_payment_reference: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    last_payment_at: Optional[datetime] = Field(default=None)
    last_failure_at: Optional[datetime] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))


class PaymentTransaction(SQLModel, table=True):
    """A Paystack checkout initialized by this backend.

    The stored amount/currency/plan are the source of truth when verifying
    a payment or processing a webhook.
    """
    __tablename__ = "payment_transactions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    reference: str = Field(sa_column=Column(String(100), unique=True, nullable=False, index=True))

    plan_key: str = Field(sa_column=Column(String(32), nullable=False))
    plan_code: str = Field(sa_column=Column(String(64), nullable=False))
    amount: int = Field(sa_column=Column(Integer, nullable=False))  # currency subunit
    currency: str = Field(sa_column=Column(String(8), nullable=False))
    # Receipt email supplied at checkout; used to correlate webhooks for
    # subscriptions that arrive before charge.success.
    email: Optional[str] = Field(default=None, sa_column=Column(String(255), index=True))
    status: str = Field(default="pending", sa_column=Column(String(32), nullable=False, default="pending"))

    authorization_url: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    access_code: Optional[str] = Field(default=None, sa_column=Column(String(128)))
    paystack_transaction_id: Optional[str] = Field(default=None, sa_column=Column(String(64)))

    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))


class PaystackWebhookEvent(SQLModel, table=True):
    """Idempotency ledger for verified Paystack webhook events."""
    __tablename__ = "paystack_webhook_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    event_key: str = Field(sa_column=Column(String(160), unique=True, nullable=False, index=True))
    event_type: str = Field(sa_column=Column(String(64), nullable=False))
    reference: Optional[str] = Field(default=None, sa_column=Column(String(100), index=True))
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    processed: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    error: Optional[str] = Field(default=None, sa_column=Column(String(500)))

    received_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    processed_at: Optional[datetime] = Field(default=None)


class Quiz(SQLModel, table=True):
    """Generated quiz model."""
    __tablename__ = "quizzes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Source
    source_filename: Optional[str] = Field(default=None)
    source_file_hash: Optional[str] = Field(default=None, sa_column=Column(String(64), index=True))

    # Generation params
    question_count: int = Field(sa_column=Column(Integer, nullable=False))
    difficulty: Optional[str] = Field(default=None)
    topics: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    question_types: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Results
    questions: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    total_generated: int = Field(default=0)
    generation_time_ms: int = Field(default=0)

    # Metadata
    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))


class PDFDocument(SQLModel, table=True):
    """Processed PDF document cache."""
    __tablename__ = "pdf_documents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # File info
    filename: str = Field(sa_column=Column(String(255), nullable=False))
    file_hash: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    file_size_bytes: int = Field(sa_column=Column(Integer, nullable=False))

    # Structured content (cached)
    structured_content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    extraction_quality: float = Field(default=0.0, sa_column=Column(Float, default=0.0))
    extraction_method: str = Field(default="")
    page_count: int = Field(default=0)
    warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Metadata
    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    expires_at: datetime = Field(sa_column=Column(DateTime, nullable=False, index=True))
    access_count: int = Field(default=0)
    last_accessed: datetime = Field(default_factory=_utcnow)


class StudySet(SQLModel, table=True):
    """Generated study aid set (grounded flashcards + quiz questions)."""
    __tablename__ = "study_sets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Source
    source_filename: Optional[str] = Field(default=None)
    source_file_hash: Optional[str] = Field(default=None, sa_column=Column(String(64), index=True))

    # Generated content
    flashcards: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    quiz_questions: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    flashcard_count: int = Field(default=0)
    quiz_count: int = Field(default=0)

    # Quality / diagnostics
    grounding_score: float = Field(default=0.0, sa_column=Column(Float, default=0.0))
    chunks_processed: int = Field(default=0)
    generation_time_ms: int = Field(default=0)
    warnings: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Metadata
    created_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))
    updated_at: datetime = Field(default_factory=_utcnow, sa_column=Column(DateTime, nullable=False))