"""Middleware for error handling, logging, and request processing."""
import time
import uuid
import logging
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.schemas.common import ErrorCode, ErrorDetail, ErrorResponse
from app.services.cache import rate_limit_cache
from app.config.settings import get_settings


settings = get_settings()
logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add request ID to all requests for tracing."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log requests and responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Log request
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )
        
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            
            # Log response
            logger.info(
                f"[{request_id}] {request.method} {request.url.path} - "
                f"Status: {response.status_code} - Time: {process_time:.1f}ms"
            )
            
            response.headers["X-Process-Time"] = f"{process_time:.1f}"
            return response
            
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - "
                f"Error: {str(e)} - Time: {process_time:.1f}ms",
                exc_info=True
            )
            raise


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware."""
    
    def __init__(self, app: ASGIApp, exempt_paths: list[str] = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or ["/health", "/api/health", "/docs", "/openapi.json", "/redoc"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for exempt paths
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        # Skip for health checks (both /health and /api/health)
        if request.url.path.startswith("/health") or request.url.path.startswith("/api/health"):
            return await call_next(request)

        # Get client identifier
        client_ip = request.client.host if request.client else "unknown"
        user_id = getattr(request.state, "user_id", None)
        identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"

        # Check rate limit (fail-open if Redis is down)
        try:
            allowed, remaining = await rate_limit_cache.check_limit(
                identifier,
                settings.RATE_LIMIT_REQUESTS,
                settings.RATE_LIMIT_WINDOW
            )
        except Exception:
            logger.warning("Rate limit check failed (Redis down?), allowing request")
            return await call_next(request)
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content=ErrorResponse(
                    error=ErrorDetail(
                        code=ErrorCode.INVALID_REQUEST,
                        message="Rate limit exceeded",
                        recoverable=True,
                        suggestions=[f"Try again in {settings.RATE_LIMIT_WINDOW} seconds"]
                    ),
                    request_id=getattr(request.state, "request_id", None)
                ).model_dump("json"),
                headers={
                    "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(settings.RATE_LIMIT_WINDOW),
                }
            )
        
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except ValueError as e:
            # Validation errors
            return JSONResponse(
                status_code=400,
                content=ErrorResponse(
                    error=ErrorDetail(
                        code=ErrorCode.VALIDATION_ERROR,
                        message=str(e),
                        recoverable=True,
                    ),
                    request_id=getattr(request.state, "request_id", None)
                ).model_dump(mode="json"),
            )
        except PermissionError as e:
            return JSONResponse(
                status_code=403,
                content=ErrorResponse(
                    error=ErrorDetail(
                        code=ErrorCode.INSUFFICIENT_PERMISSIONS,
                        message=str(e),
                        recoverable=False,
                    ),
                    request_id=getattr(request.state, "request_id", None)
                ).model_dump(mode="json"),
            )
        except Exception as e:
            # Log unexpected errors
            logger.error(
                f"Unhandled error: {str(e)}",
                exc_info=True,
                extra={"request_id": getattr(request.state, "request_id", None)}
            )
            
            return JSONResponse(
                status_code=500,
                content=ErrorResponse(
                    error=ErrorDetail(
                        code=ErrorCode.INTERNAL_ERROR,
                        message="An unexpected error occurred",
                        recoverable=True,
                        suggestions=["Please try again or contact support"]
                    ),
                    request_id=getattr(request.state, "request_id", None)
                ).model_dump(mode="json"),
            )