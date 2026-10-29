"""Main API router."""
from fastapi import APIRouter
from app.api.routes import auth, quiz, health, study_aids, payments


api_router = APIRouter(prefix="/api")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(payments.router)
api_router.include_router(quiz.router)
api_router.include_router(study_aids.router)


@api_router.get("/")
async def api_root():
    """API root endpoint."""
    return {
        "name": "Apex Quiz API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }