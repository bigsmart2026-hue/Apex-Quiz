"""Health check API routes."""
from fastapi import APIRouter
from app.config.settings import get_settings


settings = get_settings()
router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """Basic health check."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check with dependency verification."""
    checks = {
        "database": "unknown",
        "redis": "unknown",
        "gemini": "unknown",
    }
    
    # Check database
    try:
        from app.models.session import engine
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        checks["database"] = "healthy"
    except Exception:
        checks["database"] = "unhealthy"
    
    # Check Redis
    try:
        from app.services.cache import pdf_cache
        client = await pdf_cache._get_client()
        await client.ping()
        checks["redis"] = "healthy"
    except Exception:
        checks["redis"] = "unhealthy"
    
    # Check Gemini
    try:
        from app.services.gemini_client import gemini_client
        if gemini_client.api_key and gemini_client.flash_model:
            checks["gemini"] = "configured"
        else:
            checks["gemini"] = "not_configured"
    except Exception:
        checks["gemini"] = "error"
    
    all_healthy = all(v in ("healthy", "configured") for v in checks.values())
    
    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
    }