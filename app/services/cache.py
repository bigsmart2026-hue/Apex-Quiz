"""Redis caching service."""
import hashlib
from typing import Optional, Any, TypeVar, Generic

import redis.asyncio as redis
from pydantic import BaseModel

from app.config.settings import get_settings


settings = get_settings()

T = TypeVar('T', bound=BaseModel)


class CacheService(Generic[T]):
    """Generic Redis cache service."""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self.default_ttl = settings.CACHE_TTL_SECONDS
    
    async def _get_client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._client is None:
            self._client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
        return self._client
    
    async def close(self):
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
    
    def _make_key(self, prefix: str, identifier: str) -> str:
        """Create cache key with prefix."""
        return f"apex_quiz:{prefix}:{identifier}"
    
    async def get(self, prefix: str, identifier: str, model: type[T]) -> Optional[T]:
        """Get cached value and deserialize to model (returns None if Redis down)."""
        try:
            client = await self._get_client()
            key = self._make_key(prefix, identifier)

            data = await client.get(key)
            if data:
                try:
                    return model.model_validate_json(data)
                except Exception:
                    return None
        except Exception:
            return None
        return None
    
    async def set(
        self,
        prefix: str,
        identifier: str,
        value: BaseModel,
        ttl: Optional[int] = None
    ) -> bool:
        """Serialize and cache value."""
        client = await self._get_client()
        key = self._make_key(prefix, identifier)
        ttl = ttl or self.default_ttl
        
        try:
            data = value.model_dump_json()
            await client.setex(key, ttl, data)
            return True
        except Exception:
            return False
    
    async def delete(self, prefix: str, identifier: str) -> bool:
        """Delete cached value."""
        try:
            client = await self._get_client()
            key = self._make_key(prefix, identifier)
            result = await client.delete(key)
            return result > 0
        except Exception:
            return False

    async def exists(self, prefix: str, identifier: str) -> bool:
        """Check if key exists."""
        try:
            client = await self._get_client()
            key = self._make_key(prefix, identifier)
            return await client.exists(key) > 0
        except Exception:
            return False

    async def increment(self, prefix: str, identifier: str, ttl: Optional[int] = None) -> int:
        """Increment a counter."""
        try:
            client = await self._get_client()
            key = self._make_key(prefix, identifier)
            ttl = ttl or self.default_ttl

            pipe = client.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
            return results[0]
        except Exception:
            return 0


class PDFCacheService(CacheService):
    """Specialized cache for PDF structured content."""
    
    def __init__(self):
        super().__init__()
        self.prefix = "pdf_structure"
    
    def _compute_hash(self, file_bytes: bytes) -> str:
        """Compute SHA256 hash of file content."""
        return hashlib.sha256(file_bytes).hexdigest()[:32]
    
    async def get_structured_content(self, file_bytes: bytes) -> Optional[Any]:
        """Get cached structured content by file hash."""
        file_hash = self._compute_hash(file_bytes)
        from app.schemas.pdf_structure import StructuredContent
        return await self.get(self.prefix, file_hash, StructuredContent)
    
    async def set_structured_content(
        self,
        file_bytes: bytes,
        content: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Cache structured content by file hash."""
        file_hash = self._compute_hash(file_bytes)
        return await self.set(self.prefix, file_hash, content, ttl)
    
    async def increment_access(self, file_bytes: bytes) -> int:
        """Increment access counter for cached PDF."""
        file_hash = self._compute_hash(file_bytes)
        return await self.increment(f"{self.prefix}:access", file_hash)


class RateLimitCache(CacheService):
    """Rate limiting cache."""
    
    def __init__(self):
        super().__init__()
        self.prefix = "ratelimit"
    
    async def check_limit(
        self,
        identifier: str,
        limit: int,
        window_seconds: int
    ) -> tuple[bool, int]:
        """Check if rate limit exceeded. Returns (allowed, remaining)."""
        client = await self._get_client()
        key = self._make_key(self.prefix, identifier)
        
        current = await client.get(key)
        if current is None:
            await client.setex(key, window_seconds, 1)
            return True, limit - 1
        
        count = int(current)
        if count >= limit:
            return False, 0
        
        await client.incr(key)
        return True, limit - count - 1


# Singleton instances
pdf_cache = PDFCacheService()
rate_limit_cache = RateLimitCache()


async def close_cache():
    """Close all cache connections."""
    await pdf_cache.close()
    await rate_limit_cache.close()