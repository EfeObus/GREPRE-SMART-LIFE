"""
GrePre Smart Life - Production Middleware
Rate limiting, security headers, request logging, compression
"""

import asyncio
import gzip
import logging
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from io import BytesIO
from typing import Callable, Dict, Optional

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger("grepre.middleware")


# ============================================================================
# RATE LIMITER
# ============================================================================
class RateLimitExceeded(Exception):
    pass


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter.
    For production with multiple instances, use Redis-based limiter.
    """

    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_rate_limited(
        self, key: str, limit: int, window_seconds: int
    ) -> tuple[bool, int, int]:
        """
        Check if a key has exceeded the rate limit.
        Returns (is_limited, remaining, reset_time)
        """
        async with self._lock:
            now = time.time()
            window_start = now - window_seconds

            # Clean old requests
            self.requests[key] = [
                req_time for req_time in self.requests[key] if req_time > window_start
            ]

            current_count = len(self.requests[key])
            remaining = max(0, limit - current_count)
            reset_time = int(now + window_seconds)

            if current_count >= limit:
                return True, remaining, reset_time

            self.requests[key].append(now)
            return False, remaining - 1, reset_time

    async def cleanup(self):
        """Remove expired entries"""
        async with self._lock:
            now = time.time()
            expired_keys = []
            for key, timestamps in self.requests.items():
                if all(t < now - 3600 for t in timestamps):  # 1 hour cleanup
                    expired_keys.append(key)
            for key in expired_keys:
                del self.requests[key]


# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with different limits per endpoint type.
    """

    def __init__(
        self,
        app: ASGIApp,
        default_limit: int = 100,
        default_window: int = 60,
        auth_limit: int = 5,
        auth_window: int = 60,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.auth_limit = auth_limit
        self.auth_window = auth_window

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client identifier
        client_ip = self._get_client_ip(request)
        path = request.url.path

        # Determine rate limit based on endpoint
        if "/auth/login" in path or "/auth/token" in path:
            limit, window = self.auth_limit, self.auth_window
            key = f"auth:{client_ip}"
        elif "/auth/register" in path:
            limit, window = 3, 300  # 3 per 5 minutes for registration
            key = f"register:{client_ip}"
        elif path.startswith("/api/"):
            limit, window = self.default_limit, self.default_window
            key = f"api:{client_ip}"
        else:
            # Static files and pages - more lenient
            limit, window = 200, 60
            key = f"static:{client_ip}"

        # Check rate limit
        is_limited, remaining, reset_time = await rate_limiter.is_rate_limited(
            key, limit, window
        )

        if is_limited:
            logger.warning(f"Rate limit exceeded for {key}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": reset_time - int(time.time()),
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time - int(time.time())),
                },
            )

        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP, handling proxies"""
        # Check for forwarded headers (behind proxy/load balancer)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"


# ============================================================================
# SECURITY HEADERS
# ============================================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS Protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        # Content Security Policy
        if request.url.path.startswith("/api/"):
            # API responses - stricter CSP
            response.headers["Content-Security-Policy"] = "default-src 'none'"
        else:
            # HTML pages - allow necessary resources
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'"
            )

        # HSTS (only in production with HTTPS)
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# ============================================================================
# REQUEST LOGGING
# ============================================================================
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured request logging with request IDs for tracing.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        # Log request
        start_time = time.time()
        client_ip = self._get_client_ip(request)

        logger.info(
            f"[{request_id}] {request.method} {request.url.path} " f"from {client_ip}"
        )

        try:
            response = await call_next(request)

            # Log response
            duration_ms = (time.time() - start_time) * 1000
            logger.info(
                f"[{request_id}] {response.status_code} " f"in {duration_ms:.2f}ms"
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"[{request_id}] Error: {str(e)} " f"in {duration_ms:.2f}ms")
            raise

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


# ============================================================================
# COMPRESSION
# ============================================================================
class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Gzip compression for responses larger than threshold.
    """

    def __init__(self, app: ASGIApp, minimum_size: int = 500):
        super().__init__(app)
        self.minimum_size = minimum_size

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if client accepts gzip
        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding.lower():
            return await call_next(request)

        response = await call_next(request)

        # Don't compress if already encoded or streaming
        if (
            response.headers.get("Content-Encoding")
            or "text/event-stream" in response.headers.get("Content-Type", "")
            or not hasattr(response, "body")
        ):
            return response

        # Get body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        # Only compress if above threshold
        if len(body) < self.minimum_size:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # Compress
        compressed = gzip.compress(body, compresslevel=6)

        # Only use compressed if smaller
        if len(compressed) < len(body):
            headers = dict(response.headers)
            headers["Content-Encoding"] = "gzip"
            headers["Content-Length"] = str(len(compressed))

            return Response(
                content=compressed,
                status_code=response.status_code,
                headers=headers,
                media_type=response.media_type,
            )

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
