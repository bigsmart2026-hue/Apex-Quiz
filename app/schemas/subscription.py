"""Subscription and tier-related schemas."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class SubscriptionTier(str, Enum):
    """User subscription tiers."""
    FREE = "free"
    PREMIUM = "premium"


class TierLimits(BaseModel):
    """Question limits per tier."""
    min_questions: int
    max_questions: int
    
    @classmethod
    def for_tier(cls, tier: SubscriptionTier, settings) -> "TierLimits":
        if tier == SubscriptionTier.PREMIUM:
            return cls(
                min_questions=settings.PREMIUM_QUESTION_MIN,
                max_questions=settings.PREMIUM_QUESTION_MAX
            )
        return cls(
            min_questions=settings.FREE_QUESTION_MIN,
            max_questions=settings.FREE_QUESTION_MAX
        )


class SubscriptionStatus(BaseModel):
    """User subscription status response."""
    tier: SubscriptionTier
    is_paid: bool
    question_limit: int
    questions_used_this_month: int = 0
    questions_remaining: int
    expires_at: Optional[str] = None