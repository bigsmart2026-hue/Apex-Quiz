"""Security utilities: password hashing, JWT tokens."""
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.config.settings import get_settings


settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user id
    exp: int  # expiration timestamp
    iat: int  # issued at timestamp
    type: str = "access"  # access or refresh
    is_paid: bool = False
    tier: str = "free"
    email: Optional[str] = None


def hash_password(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: str,
    is_paid: bool = False,
    tier: str = "free",
    email: Optional[str] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    
    payload = TokenPayload(
        sub=user_id,
        exp=int(expire.timestamp()),
        iat=int(now.timestamp()),
        type="access",
        is_paid=is_paid,
        tier=tier,
        email=email,
    )
    
    return jwt.encode(payload.model_dump(), settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT refresh token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    
    payload = TokenPayload(
        sub=user_id,
        exp=int(expire.timestamp()),
        iat=int(now.timestamp()),
        type="refresh",
    )
    
    return jwt.encode(payload.model_dump(), settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {str(e)}")


def create_token_pair(
    user_id: str,
    is_paid: bool = False,
    tier: str = "free",
    email: Optional[str] = None
) -> dict[str, str]:
    """Create both access and refresh tokens."""
    return {
        "access_token": create_access_token(user_id, is_paid, tier, email),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
    }