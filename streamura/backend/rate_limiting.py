"""
Streamura Rate Limiting Middleware

Implements tiered rate limiting based on user trust level and endpoint sensitivity.
Uses Redis for distributed rate limiting across multiple instances.
"""

import os
import time
import asyncio
from typing import Optional, Dict, Tuple
from functools import wraps
from datetime import datetime, timedelta

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


class RateLimitTier:
    """Rate limit tiers based on user trust level."""
    
    # Format: (requests, window_seconds)
    ANONYMOUS = (30, 60)       # 30 requests per minute
    BASIC = (60, 60)           # 60 requests per minute
    VERIFIED = (120, 60)       # 120 requests per minute (Bronze/Silver)
    TRUSTED = (300, 60)        # 300 requests per minute (Gold)
    PREMIUM = (600, 60)        # 600 requests per minute (Platinum)
    
    @classmethod
    def get_tier(cls, trust_score: Optional[int] = None, is_verified: bool = False) -> Tuple[int, int]:
        """Get rate limit tier based on trust score."""
        if trust_score is None:
            return cls.ANONYMOUS
        
        if trust_score >= 90:
            return cls.PREMIUM
        elif trust_score >= 70:
            return cls.TRUSTED
        elif trust_score >= 50 or is_verified:
            return cls.VERIFIED
        else:
            return cls.BASIC


class EndpointLimits:
    """Special rate limits for sensitive endpoints."""
    
    LIMITS = {
        # Auth endpoints - very strict
        "/api/auth/login": (5, 60),          # 5 per minute
        "/api/auth/register": (3, 60),       # 3 per minute
        "/api/auth/forgot-password": (3, 300),  # 3 per 5 minutes
        
        # Payment endpoints - strict
        "/api/payments/payout": (10, 60),    # 10 per minute
        "/api/payments/tip": (30, 60),       # 30 per minute
        
        # Streaming endpoints - moderate
        "/api/streams/create": (5, 60),      # 5 per minute
        "/api/events/create": (5, 60),       # 5 per minute
        
        # Search - moderate
        "/api/discovery/search": (30, 60),   # 30 per minute
        
        # High volume endpoints - relaxed
        "/api/streams": (120, 60),           # 120 per minute
        "/api/notifications": (60, 60),      # 60 per minute
    }
    
    @classmethod
    def get_limit(cls, path: str) -> Optional[Tuple[int, int]]:
        """Get special limit for endpoint if exists."""
        for endpoint, limit in cls.LIMITS.items():
            if path.startswith(endpoint):
                return limit
        return None


class RateLimiter:
    """Redis-backed rate limiter with sliding window."""
    
    def __init__(self):
        self.redis_client = None
        self.local_cache: Dict[str, list] = {}  # Fallback for no Redis
        self._lock = asyncio.Lock()
    
    async def get_redis(self):
        """Get or create Redis connection."""
        if self.redis_client is None and redis:
            try:
                self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
                await self.redis_client.ping()
            except Exception as e:
                print(f"Redis connection failed: {e}")
                self.redis_client = None
        return self.redis_client
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int
    ) -> Tuple[bool, int, int]:
        """
        Check if request is within rate limit.
        
        Returns: (is_allowed, remaining, reset_time)
        """
        now = time.time()
        window_start = now - window
        
        redis_client = await self.get_redis()
        
        if redis_client:
            return await self._check_redis(redis_client, key, limit, window, now, window_start)
        else:
            return await self._check_local(key, limit, window, now, window_start)
    
    async def _check_redis(
        self,
        client,
        key: str,
        limit: int,
        window: int,
        now: float,
        window_start: float
    ) -> Tuple[bool, int, int]:
        """Check rate limit using Redis sorted set."""
        try:
            pipe = client.pipeline()
            
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Count requests in window
            pipe.zcard(key)
            # Set expiry
            pipe.expire(key, window + 1)
            
            results = await pipe.execute()
            request_count = results[2]
            
            remaining = max(0, limit - request_count)
            reset_time = int(now + window)
            
            return request_count <= limit, remaining, reset_time
        except Exception as e:
            print(f"Redis rate limit error: {e}")
            return True, limit, int(now + window)  # Allow on error
    
    async def _check_local(
        self,
        key: str,
        limit: int,
        window: int,
        now: float,
        window_start: float
    ) -> Tuple[bool, int, int]:
        """Check rate limit using local memory (single instance only)."""
        async with self._lock:
            if key not in self.local_cache:
                self.local_cache[key] = []
            
            # Remove old entries
            self.local_cache[key] = [t for t in self.local_cache[key] if t > window_start]
            
            # Add current request
            self.local_cache[key].append(now)
            
            request_count = len(self.local_cache[key])
            remaining = max(0, limit - request_count)
            reset_time = int(now + window)
            
            return request_count <= limit, remaining, reset_time


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""
    
    EXEMPT_PATHS = {
        "/health",
        "/api/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/favicon.ico",
    }
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Skip rate limiting for exempt paths
        if any(path.startswith(p) for p in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Skip non-API paths
        if not path.startswith("/api"):
            return await call_next(request)
        
        # Get user info from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        trust_score = getattr(user, "trust_score", None) if user else None
        is_verified = getattr(user, "is_verified", False) if user else False
        user_id = getattr(user, "id", None) if user else None
        
        # Build rate limit key
        if user_id:
            key = f"rate_limit:user:{user_id}"
        else:
            # Use IP for anonymous users
            forwarded = request.headers.get("X-Forwarded-For")
            ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
            key = f"rate_limit:ip:{ip}"
        
        # Check for endpoint-specific limits first
        endpoint_limit = EndpointLimits.get_limit(path)
        if endpoint_limit:
            limit, window = endpoint_limit
            key = f"{key}:{path.replace('/', '_')}"
        else:
            # Use tier-based limits
            limit, window = RateLimitTier.get_tier(trust_score, is_verified)
        
        # Check rate limit
        is_allowed, remaining, reset_time = await rate_limiter.check_rate_limit(key, limit, window)
        
        # Add rate limit headers
        response = await call_next(request) if is_allowed else None
        
        if response is None:
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please slow down.",
                    "retry_after": reset_time - int(time.time()),
                }
            )
        
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)
        
        if not is_allowed:
            response.headers["Retry-After"] = str(reset_time - int(time.time()))
        
        return response


# Decorator for manual rate limiting on specific functions
def rate_limit(limit: int = 60, window: int = 60, key_prefix: str = ""):
    """Decorator to rate limit specific endpoints."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            user = getattr(request.state, "user", None)
            user_id = getattr(user, "id", "anonymous") if user else "anonymous"
            
            key = f"rate_limit:{key_prefix}:{user_id}"
            is_allowed, remaining, reset_time = await rate_limiter.check_rate_limit(key, limit, window)
            
            if not is_allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Try again in {reset_time - int(time.time())} seconds.",
                    headers={"Retry-After": str(reset_time - int(time.time()))}
                )
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
