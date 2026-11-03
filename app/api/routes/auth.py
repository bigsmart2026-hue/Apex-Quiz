"""Authentication API routes."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
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
from app.models.session import get_db_session
from app.models.database import User, SubscriptionTier
from app.schemas.common import ErrorCode, ErrorDetail, SuccessResponse
from app.schemas.subscription import SubscriptionStatus


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
    """Mock checkout request (demo billing — no real payment processed)."""
    plan: str = Field(default="premium", max_length=32)
    payment_token: Optional[str] = Field(default=None, max_length=255)


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
async def get_subscription_status(user: User = Depends(get_current_user)):
    """Get current user's subscription status."""
    from app.config.settings import get_settings
    settings = get_settings()
    
    limit = settings.PREMIUM_QUESTION_MAX if user.is_paid else settings.FREE_QUESTION_MAX
    
    return SuccessResponse(
        data=SubscriptionStatus(
            tier="premium" if user.is_paid else "free",
            is_paid=user.is_paid,
            question_limit=limit,
            questions_used_this_month=user.questions_generated_this_month,
            questions_remaining=max(0, limit - user.questions_generated_this_month),
            expires_at=user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
        )
    )


@router.post("/logout", response_model=SuccessResponse)
async def logout(response: Response):
    """Logout (client should discard tokens)."""
    return SuccessResponse(message="Logged out successfully")


def _subscription_status_payload(user: User) -> SubscriptionStatus:
    """Build subscription status for a user."""
    from app.config.settings import get_settings
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


@router.post("/upgrade", response_model=SuccessResponse[SubscriptionStatus])
async def upgrade_subscription(
    request: UpgradeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Upgrade to premium (demo checkout — no real payment processed)."""
    if request.plan != "premium":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message=f"Unknown plan: {request.plan}",
                recoverable=True,
                suggestions=["Use plan 'premium'"]
            ).model_dump(),
        )

    user.is_paid = True
    user.tier = SubscriptionTier.PREMIUM
    session.add(user)
    await session.commit()

    return SuccessResponse(
        data=_subscription_status_payload(user),
        message="Upgraded to premium",
    )


@router.post("/cancel", response_model=SuccessResponse[SubscriptionStatus])
async def cancel_subscription(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Cancel premium and return to the free tier."""
    user.is_paid = False
    user.tier = SubscriptionTier.FREE
    session.add(user)
    await session.commit()

    return SuccessResponse(
        data=_subscription_status_payload(user),
        message="Subscription cancelled",
    )