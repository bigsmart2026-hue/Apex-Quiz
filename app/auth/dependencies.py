"""Authentication dependencies for FastAPI."""
import uuid as uuid_lib
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.security import decode_token
from app.models.database import User
from app.models.session import get_db_session
from app.config.settings import get_settings
from app.schemas.common import ErrorCode, ErrorDetail


settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def _get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
    """Fetch user by string ID, handling UUID conversion."""
    try:
        uid = uuid_lib.UUID(user_id)
    except (ValueError, AttributeError, TypeError):
        return None
    result = await session.execute(select(User).where(User.id == uid))
    return result.scalars().first()


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session)
) -> Optional[User]:
    """Get current user if token is valid, otherwise return None."""
    if not token:
        return None

    try:
        payload = decode_token(token)
        if payload.type != "access":
            return None
    except ValueError:
        return None

    user = await _get_user_by_id(session, payload.sub)

    if not user or not user.is_active:
        return None

    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session)
) -> User:
    """Get current authenticated user (required)."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="Authentication required",
                recoverable=False
            ).model_dump(),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = decode_token(token)
        if payload.type != "access":
            raise ValueError("Invalid token type")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message=str(e),
                recoverable=True,
                suggestions=["Please log in again"]
            ).model_dump(),
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await _get_user_by_id(session, payload.sub)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_TOKEN,
                message="User not found",
                recoverable=True,
                suggestions=["Please log in again"]
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
    
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    """Get current active user (alias for clarity)."""
    return user


def require_paid_tier(user: User = Depends(get_current_user)) -> User:
    """Require user to have premium subscription."""
    if not user.is_paid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorDetail(
                code=ErrorCode.SUBSCRIPTION_REQUIRED,
                message="Premium subscription required",
                recoverable=True,
                suggestions=["Upgrade to premium to access this feature"]
            ).model_dump(),
        )
    return user


async def get_question_limit(user: User = Depends(get_current_user)) -> int:
    """Get question limit based on user's subscription tier."""
    from app.config.settings import get_settings
    settings = get_settings()
    
    if user.is_paid:
        return settings.PREMIUM_QUESTION_MAX
    return settings.FREE_QUESTION_MAX


async def verify_subscription_status(user: User = Depends(get_current_user)) -> dict:
    """Verify and return subscription status."""
    from app.config.settings import get_settings
    settings = get_settings()
    
    tier = "premium" if user.is_paid else "free"
    limit = settings.PREMIUM_QUESTION_MAX if user.is_paid else settings.FREE_QUESTION_MAX
    
    return {
        "tier": tier,
        "is_paid": user.is_paid,
        "question_limit": limit,
        "questions_used_this_month": user.questions_generated_this_month,
        "questions_remaining": max(0, limit - user.questions_generated_this_month),
        "expires_at": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
    }