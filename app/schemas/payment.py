"""Paystack checkout and payment verification schemas."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.subscription import SubscriptionStatus


class PaystackPlanInfo(BaseModel):
    """Public display details for the configured recurring plan."""
    plan_key: str
    name: str
    amount: float
    amount_subunit: int
    currency: str
    interval: str
    price_label: str
    configured: bool
    public_key: Optional[str] = None


class InitializePaymentRequest(BaseModel):
    """Start a Paystack checkout for the server-configured plan.

    The client cannot supply a plan code or amount; both are resolved from
    server settings so a caller cannot downgrade the price.
    """
    model_config = ConfigDict(extra="forbid")

    plan: str = Field(default="premium", max_length=32)
    email: Optional[EmailStr] = Field(
        default=None,
        description="Optional receipt email; defaults to the account email.",
    )


class InitializePaymentResponse(BaseModel):
    """Details the frontend needs to open the Paystack popup."""
    reference: str
    authorization_url: str
    access_code: Optional[str] = None
    public_key: str
    email: EmailStr
    plan: PaystackPlanInfo


class VerifyPaymentRequest(BaseModel):
    """Verify a checkout reference server-side."""
    model_config = ConfigDict(extra="forbid")

    reference: str = Field(..., min_length=6, max_length=100)


class PaymentVerificationResponse(BaseModel):
    """Result of a server-side transaction verification."""
    reference: str
    status: str
    subscription: SubscriptionStatus
