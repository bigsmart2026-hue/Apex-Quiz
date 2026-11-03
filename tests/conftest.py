"""Test configuration and fixtures."""
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import create_app
from app.models.session import get_db_session
from app.models.database import User, SubscriptionTier
from app.auth.security import hash_password, create_token_pair


# Test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def init_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    """Setup and teardown test database."""
    await init_test_db()
    yield
    await close_test_db()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get test database session."""
    async with test_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with overridden dependencies."""
    app = create_app()

    async def _override():
        yield db_session

    app.dependency_overrides[get_db_session] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user (get-or-create for test isolation)."""
    from sqlmodel import select
    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    existing = result.scalars().first()
    if existing:
        return existing
    user = User(
        email="test@example.com",
        hashed_password=hash_password("testpassword123"),
        full_name="Test User",
        tier=SubscriptionTier.FREE,
        is_paid=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def premium_user(db_session: AsyncSession) -> User:
    """Create a premium test user (get-or-create for test isolation)."""
    from sqlmodel import select
    result = await db_session.execute(select(User).where(User.email == "premium@example.com"))
    existing = result.scalars().first()
    if existing:
        return existing
    user = User(
        email="premium@example.com",
        hashed_password=hash_password("testpassword123"),
        full_name="Premium User",
        tier=SubscriptionTier.PREMIUM,
        is_paid=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict:
    """Get auth headers for test user."""
    tokens = create_token_pair(
        user_id=str(test_user.id),
        is_paid=test_user.is_paid,
        tier=test_user.tier.value,
        email=test_user.email,
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest_asyncio.fixture
async def premium_auth_headers(premium_user: User) -> dict:
    """Get auth headers for premium user."""
    tokens = create_token_pair(
        user_id=str(premium_user.id),
        is_paid=premium_user.is_paid,
        tier=premium_user.tier.value,
        email=premium_user.email,
    )
    return {"Authorization": f"Bearer {tokens['access_token']}"}
