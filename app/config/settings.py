"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # App
    APP_NAME: str = "Apex Quiz API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./apex_quiz.db"
    
    # Subscription Tiers
    FREE_QUESTION_MAX: int = 10
    FREE_QUESTION_MIN: int = 5
    PREMIUM_QUESTION_MAX: int = 50
    PREMIUM_QUESTION_MIN: int = 10
    
    # PDF Processing
    PDF_MAX_MB: int = 20
    STRUCTURE_QUALITY_THRESHOLD: float = 0.6
    
    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_FLASH_MODEL: str = "gemini-3.6-flash"
    # Comma-separated failover chain, tried in order when the primary model
    # times out or returns a retryable status (429/503/etc.).
    GEMINI_FALLBACK_MODELS: str = "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.1-flash-lite"
    # Per-model request timeout in seconds. Failover happens after this.
    GEMINI_REQUEST_TIMEOUT: float = 30.0
    # One extra pass over the model chain for transient 503/429 responses.
    GEMINI_MAX_ATTEMPTS: int = 2
    GEMINI_RETRY_DELAY: float = 1.5
    GEMINI_TEMPERATURE: float = 0.05
    GEMINI_MAX_OUTPUT_TOKENS: int = 2048

    # Study Aid Generation (NotebookLM-style grounded flashcards/quizzes)
    STUDY_AID_CHUNK_SIZE: int = 12000
    STUDY_AID_CHUNK_OVERLAP: int = 400
    STUDY_AID_MAX_CHUNKS: int = 8
    STUDY_AID_CONCURRENCY: int = 3
    STUDY_AID_MAX_OUTPUT_TOKENS: int = 8192
    STUDY_AID_GROUNDING_MIN_CHARS: int = 8
    
    # Redis Cache
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 3600
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5175",
    ]
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    @property
    def pdf_max_bytes(self) -> int:
        return self.PDF_MAX_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()