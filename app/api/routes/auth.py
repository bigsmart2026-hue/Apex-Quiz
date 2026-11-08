"""Authentication API routes."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field

from app.auth.security import (
    hash_password,
    verify_password,
    create_token_pair,
    decode_token,
)
from app.auth.dependencies import get_current_user
from app.config.settings import get_settings
from app.models.session import get_db_session
from app.models.database import User, SubscriptionTier
from app.schemas.common import ErrorCode, ErrorDetail, SuccessResponse
from app.schemas.subscription import SubscriptionStatus
from app.services.paystack import (
    PaystackError,
    allowed_callback_url,
    disable_subscription,
    fetch_plan,
    initialize_transaction,
    is_configured,
    parse_metadata,
    verify_transaction,
    verify_webhook_signature,
)
from app.services.subscription import (
    activate_premium,
    apply_paystack_subscription,
    attach_subscription,
    downgrade_to_free,
    fetch_active_subscription,
    reconcile_subscription,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


class RegisterRequest(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=255)


class TokenResponse(BaseModel):
    """Token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class UpgradeRequest(BaseModel):
    """Start a Paystack checkout for the premium plan."""
    callback_url: Optional[str] = Field(default=None, max_length=2048)
    email: Optional[EmailStr] = None


class CheckoutResponse(BaseModel):
    """Paystack checkout details the client redirects to."""
    authorization_url: str
    access_code: str
    reference: str


class PlanResponse(BaseModel):
    """Public details of the configured Paystack payment plan."""
    name: str
    amount: int
    currency: str
    interval: str


@router.post("/register", response_model=SuccessResponse[TokenResponse], status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    session: AsyncSession = Depends(get_db_session)
):
    """Register a new user."""
    # Check if user exists
    result = await session.execute(select(User).where(User.email == request.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Email already registered",
                recoverable=True,
                suggestions=["Use a different email or log in"]
            ).model_dump(),
        )

    # Create user
    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        tier=SubscriptionTier.FREE,
        is_paid=False,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Create tokens
    tokens = create_token_pair(
        user_id=str(user.id),
        is_paid=user.is_paid,
        tier=user.tier.value,
        email=user.email,
    )

    return SuccessResponse(
        data=TokenResponse(
            **tokens,
            user={
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier.value,
                "is_paid": user.is_paid,
            }
        ),
        message="Registration successful"
    )


@router.post("/login", response_model=SuccessResponse[TokenResponse])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db_session)
):
    """Login with email and password."""
    result = await session.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="Invalid email or password",
                recoverable=True,
                suggestions=["Check your credentials and try again"]
            ).model_dump(),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.INSUFFICIENT_PERMISSIONS,
                message="Account is deactivated",
                recoverable=False
            ).model_dump(),
        )
    
    # Update last login
    from datetime import datetime, timezone
    user.last_login = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    
    tokens = create_token_pair(
        user_id=str(user.id),
        is_paid=user.is_paid,
        tier=user.tier.value,
        email=user.email,
    )

    return SuccessResponse(
        data=TokenResponse(
            **tokens,
            user={
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier.value,
                "is_paid": user.is_paid,
            }
        ),
        message="Login successful"
    )


@router.post("/refresh", response_model=SuccessResponse[TokenResponse])
async def refresh_token(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_db_session)
):
    """Refresh access token using refresh token."""
    try:
        payload = decode_token(request.refresh_token)
        if payload.type != "refresh":
            raise ValueError("Invalid token type")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.TOKEN_EXPIRED,
                message=str(e),
                recoverable=True,
                suggestions=["Please log in again"]
            ).model_dump(),
        )
    
    import uuid as uuid_lib
    try:
        uid = uuid_lib.UUID(payload.sub)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="Invalid user id in token",
                recoverable=True,
                suggestions=["Please log in again"]
            ).model_dump(),
        )

    result = await session.execute(select(User).where(User.id == uid))
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="User not found or inactive",
                recoverable=True,
                suggestions=["Please log in again"]
            ).model_dump(),
        )
    
    tokens = create_token_pair(
        user_id=str(user.id),
        is_paid=user.is_paid,
        tier=user.tier.value,
        email=user.email,
    )

    return SuccessResponse(
        data=TokenResponse(
            **tokens,
            user={
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "tier": user.tier.value,
                "is_paid": user.is_paid,
            }
        ),
        message="Token refreshed"
    )


@router.get("/me", response_model=SuccessResponse[dict])
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current user info."""
    return SuccessResponse(
        data={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "tier": user.tier.value,
            "is_paid": user.is_paid,
            "subscription_expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "created_at": user.created_at.isoformat(),
        }
    )


@router.get("/subscription", response_model=SuccessResponse[SubscriptionStatus])
async def get_subscription_status(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Get current user's subscription status.

    Also reconciles a pending checkout or a lapsed subscription with Paystack
    so premium works without a webhook endpoint.
    """
    await reconcile_subscription(user, session)
    return SuccessResponse(data=_subscription_status_payload(user))


@router.post("/logout", response_model=SuccessResponse)
async def logout(response: Response):
    """Logout (client should discard tokens)."""
    return SuccessResponse(message="Logged out successfully")


def _subscription_status_payload(user: User) -> SubscriptionStatus:
    """Build subscription status for a user."""
    settings = get_settings()
    limit = settings.PREMIUM_QUESTION_MAX if user.is_paid else settings.FREE_QUESTION_MAX
    return SubscriptionStatus(
        tier="premium" if user.is_paid else "free",
        is_paid=user.is_paid,
        question_limit=limit,
        questions_used_this_month=user.questions_generated_this_month,
        questions_remaining=max(0, limit - user.questions_generated_this_month),
        expires_at=user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
    )


def _payment_error(message: str, *, status_code: int = status.HTTP_502_BAD_GATEWAY) -> HTTPException:
    server_error = status_code >= 500
    return HTTPException(
        status_code=status_code,
        detail=ErrorDetail(
            code=ErrorCode.SERVICE_UNAVAILABLE if server_error else ErrorCode.INVALID_REQUEST,
            message=message,
            recoverable=server_error,
            suggestions=["Try again in a moment"] if server_error else [],
        ).model_dump(),
    )


@router.get("/upgrade/plan", response_model=SuccessResponse[PlanResponse])
async def get_upgrade_plan():
    """Return the configured Paystack plan so the UI can show the real price."""
    settings = get_settings()
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.SERVICE_UNAVAILABLE,
                message="Premium payments are not configured",
                recoverable=False,
            ).model_dump(),
        )

    try:
        plan = await fetch_plan(settings.PAYSTACK_PLAN_CODE)
    except PaystackError as exc:
        raise _payment_error(exc.message, status_code=exc.status_code) from exc

    return SuccessResponse(
        data=PlanResponse(
            name=plan.get("name") or "Premium",
            amount=int(plan.get("amount") or settings.PAYSTACK_AMOUNT),
            currency=str(plan.get("currency") or settings.PAYSTACK_CURRENCY),
            interval=str(plan.get("interval") or "monthly"),
        )
    )


@router.post("/upgrade", response_model=SuccessResponse[CheckoutResponse])
async def start_upgrade(
    request: UpgradeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Initialize a Paystack transaction and return the checkout URL."""
    settings = get_settings()

    # Reconcile a previous checkout first so a completed payment can never be
    # charged twice from a stale tab.
    await reconcile_subscription(user, session)

    if user.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="This account already has premium",
                recoverable=False,
            ).model_dump(),
        )
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.SERVICE_UNAVAILABLE,
                message="Premium payments are not configured",
                recoverable=False,
                suggestions=["Set PAYSTACK_SECRET_KEY and PAYSTACK_PLAN_CODE on the server"],
            ).model_dump(),
        )

    try:
        callback_url = allowed_callback_url(request.callback_url, settings.PAYSTACK_CALLBACK_URL)
        checkout = await initialize_transaction(
            email=request.email or user.email,
            callback_url=callback_url,
            metadata={
                "user_id": str(user.id),
                "purpose": "premium_subscription",
            },
        )
    except PaystackError as exc:
        raise _payment_error(exc.message, status_code=exc.status_code) from exc

    if not checkout.get("authorization_url"):
        raise _payment_error("Paystack did not return a checkout URL")

    # Remember the pending reference so a paid checkout is reconciled even if
    # the browser never returns to the callback page (no webhook required).
    if checkout.get("reference"):
        user.paystack_reference = checkout["reference"]
        session.add(user)
        await session.commit()

    return SuccessResponse(
        data=CheckoutResponse(
            authorization_url=checkout["authorization_url"],
            access_code=checkout.get("access_code", ""),
            reference=checkout.get("reference", ""),
        ),
        message="Redirect to Paystack to complete payment",
    )


@router.get("/upgrade/verify", response_model=SuccessResponse[SubscriptionStatus])
async def verify_upgrade(
    reference: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Verify a Paystack transaction and activate premium."""
    try:
        data = await verify_transaction(reference)
    except PaystackError as exc:
        raise _payment_error(exc.message, status_code=exc.status_code) from exc

    if data.get("status") != "success":
        raise _payment_error("Payment was not successful", status_code=status.HTTP_400_BAD_REQUEST)

    metadata = parse_metadata(data.get("metadata"))
    owner = str(metadata.get("user_id") or "")
    customer = data.get("customer") or {}
    customer_email = str(customer.get("email") or "").strip().lower()
    if owner != str(user.id) and customer_email != user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.INSUFFICIENT_PERMISSIONS,
                message="This payment does not belong to the current account",
                recoverable=False,
            ).model_dump(),
        )

    settings = get_settings()
    plan = data.get("plan")
    if not isinstance(plan, dict):
        plan = {}
    amount = int(data.get("amount") or 0)
    expected_amount = int(plan.get("amount") or settings.PAYSTACK_AMOUNT)
    currency = str(data.get("currency") or "").upper()
    expected_currency = str(plan.get("currency") or settings.PAYSTACK_CURRENCY).upper()
    if amount < expected_amount:
        raise _payment_error("Payment amount is lower than the plan price", status_code=status.HTTP_400_BAD_REQUEST)
    if currency and currency != expected_currency:
        raise _payment_error("Payment currency does not match the plan currency", status_code=status.HTTP_400_BAD_REQUEST)

    activate_premium(user, reference=reference, data=data)

    # Store subscription identifiers now so cancellation works even without a
    # webhook endpoint.
    await attach_subscription(user)

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return SuccessResponse(
        data=_subscription_status_payload(user),
        message="Premium activated",
    )


@router.post("/paystack/webhook")
async def paystack_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
):
    """Handle Paystack webhook events (signature verified)."""
    settings = get_settings()
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not verify_webhook_signature(raw_body, signature, settings.PAYSTACK_SECRET_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="Invalid Paystack signature",
                recoverable=False,
            ).model_dump(),
        )

    try:
        event = json.loads(raw_body)
    except ValueError:
        return {"status": "ignored"}

    event_type = event.get("event")
    data = event.get("data") or {}

    async def _find_user() -> Optional[User]:
        metadata = parse_metadata(data.get("metadata"))
        user_id = metadata.get("user_id")
        if user_id:
            try:
                import uuid as uuid_lib
                uid = uuid_lib.UUID(str(user_id))
            except (ValueError, TypeError):
                uid = None
            if uid:
                result = await session.execute(select(User).where(User.id == uid))
                found = result.scalars().first()
                if found:
                    return found
        customer = data.get("customer") or {}
        customer_id = customer.get("id")
        if customer_id:
            result = await session.execute(
                select(User).where(User.paystack_customer_id == str(customer_id))
            )
            found = result.scalars().first()
            if found:
                return found
        email = customer.get("email")
        if email:
            result = await session.execute(
                select(User).where(func.lower(User.email) == str(email).strip().lower())
            )
            return result.scalars().first()
        return None

    user = await _find_user()
    if not user:
        return {"status": "ignored"}

    if event_type == "charge.success":
        activate_premium(user, reference=data.get("reference"), data=data)
        await attach_subscription(user)
    elif event_type == "subscription.create":
        apply_paystack_subscription(user, data)
    elif event_type == "subscription.disable":
        downgrade_to_free(user)
    elif event_type == "subscription.not_renew":
        # "Not renewing" keeps access until the current period ends. The
        # expiry check downgrades the account after next_payment_date.
        apply_paystack_subscription(user, data)

    session.add(user)
    await session.commit()
    return {"status": "ok"}


@router.post("/cancel", response_model=SuccessResponse[SubscriptionStatus])
async def cancel_subscription(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Disable the Paystack subscription and return to the free tier."""
    if not user.paystack_subscription_id or not user.paystack_email_token:
        # No webhook required: look the subscription up on demand.
        try:
            subscription = await fetch_active_subscription(user)
        except PaystackError as exc:
            raise _payment_error(exc.message, status_code=exc.status_code) from exc
        if subscription:
            apply_paystack_subscription(user, subscription)

    if not user.paystack_subscription_id or not user.paystack_email_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="No active Paystack subscription found",
                recoverable=True,
                suggestions=["Payments made without a plan cannot be cancelled here"],
            ).model_dump(),
        )

    try:
        await disable_subscription(user.paystack_subscription_id, user.paystack_email_token)
    except PaystackError as exc:
        raise _payment_error(exc.message, status_code=exc.status_code) from exc

    downgrade_to_free(user)
    session.add(user)
    await session.commit()

    return SuccessResponse(
        data=_subscription_status_payload(user),
        message="Subscription cancelled",
    )