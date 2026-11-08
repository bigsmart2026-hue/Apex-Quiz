"""Database session management."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlmodel import SQLModel
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config.settings import get_settings


settings = get_settings()

# Convert sync URL to the async driver used by SQLAlchemy.
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# asyncpg expects `ssl=require`, not the libpq-style `sslmode=require`.
database_url = database_url.replace("sslmode=", "ssl=")

_is_sqlite = database_url.startswith("sqlite")

_engine_kwargs: dict = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}
if not _is_sqlite:
    _engine_kwargs.update({"pool_size": 5, "max_overflow": 10, "pool_recycle": 300})

engine = create_async_engine(database_url, **_engine_kwargs)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


_PAYSTACK_COLUMNS = {
    "paystack_customer_id": "VARCHAR(255)",
    "paystack_subscription_id": "VARCHAR(255)",
    "paystack_email_token": "VARCHAR(255)",
    "paystack_reference": "VARCHAR(255)",
}


def _upgrade_schema(sync_conn) -> None:
    """Idempotently add Paystack columns to an existing users table.

    ``create_all`` never alters existing tables, so deployments that predate
    the Stripe -> Paystack rename would otherwise crash with "no such column".
    """
    inspector = inspect(sync_conn)
    if not inspector.has_table("users"):
        return

    existing = {column["name"] for column in inspector.get_columns("users")}
    for name, ddl_type in _PAYSTACK_COLUMNS.items():
        if name not in existing:
            sync_conn.execute(
                text(f'ALTER TABLE users ADD COLUMN "{name}" {ddl_type}')
            )
            existing.add(name)

    # Preserve identifiers from the old Stripe-named columns when present.
    if "stripe_customer_id" in existing:
        sync_conn.execute(
            text(
                "UPDATE users SET paystack_customer_id = stripe_customer_id "
                "WHERE paystack_customer_id IS NULL AND stripe_customer_id IS NOT NULL"
            )
        )
    if "stripe_subscription_id" in existing:
        sync_conn.execute(
            text(
                "UPDATE users SET paystack_subscription_id = stripe_subscription_id "
                "WHERE paystack_subscription_id IS NULL AND stripe_subscription_id IS NOT NULL"
            )
        )


async def init_db() -> None:
    """Initialize database tables and apply lightweight schema upgrades."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await conn.run_sync(_upgrade_schema)


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Dependency for FastAPI
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database session."""
    async with get_session() as session:
        yield session