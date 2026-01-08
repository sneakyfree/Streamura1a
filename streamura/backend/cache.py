"""
Redis Response Caching Service (Phase 11)

Provides a caching layer for high-traffic API endpoints to reduce
database load and improve response times.

Features:
- Async Redis operations
- TTL-based caching
- Pattern-based cache invalidation
- Decorator for easy endpoint caching
- JSON serialization for complex responses
"""

import os
import json
import hashlib
import logging
from typing import Any, Optional, Callable, List
from functools import wraps
from datetime import datetime

import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_PREFIX = "streamura:cache:"
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"


class CacheService:
    """
    Redis-based caching service for API responses.

    Usage:
        cache = get_cache_service()

        # Manual caching
        await cache.set("key", {"data": "value"}, ttl=300)
        data = await cache.get("key")

        # Invalidation
        await cache.delete("key")
        await cache.invalidate_pattern("events:*")
    """

    _instance: Optional["CacheService"] = None
    _redis: Optional[redis.Redis] = None

    def __init__(self):
        self._redis = None
        self._connected = False

    async def get_redis(self) -> Optional[redis.Redis]:
        """Get or create Redis connection."""
        if not CACHE_ENABLED:
            return None

        if self._redis is None:
            try:
                self._redis = redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                # Test connection
                await self._redis.ping()
                self._connected = True
                logger.info("Redis cache connection established")
            except Exception as e:
                logger.warning(f"Redis cache unavailable: {e}")
                self._redis = None
                self._connected = False

        return self._redis

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            self._connected = False

    def _make_key(self, key: str) -> str:
        """Create full cache key with prefix."""
        return f"{CACHE_PREFIX}{key}"

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        r = await self.get_redis()
        if not r:
            return None

        try:
            full_key = self._make_key(key)
            data = await r.get(full_key)

            if data:
                logger.debug(f"Cache HIT: {key}")
                return json.loads(data)
            else:
                logger.debug(f"Cache MISS: {key}")
                return None

        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 300
    ) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache (must be JSON serializable)
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            True if successful, False otherwise
        """
        r = await self.get_redis()
        if not r:
            return False

        try:
            full_key = self._make_key(key)
            data = json.dumps(value, default=str)
            await r.setex(full_key, ttl, data)
            logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete value from cache.

        Args:
            key: Cache key

        Returns:
            True if deleted, False otherwise
        """
        r = await self.get_redis()
        if not r:
            return False

        try:
            full_key = self._make_key(key)
            result = await r.delete(full_key)
            logger.debug(f"Cache DELETE: {key}")
            return result > 0

        except Exception as e:
            logger.warning(f"Cache delete error: {e}")
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.

        Args:
            pattern: Glob pattern (e.g., "events:*", "user:123:*")

        Returns:
            Number of keys deleted
        """
        r = await self.get_redis()
        if not r:
            return 0

        try:
            full_pattern = self._make_key(pattern)
            keys = []

            # Use SCAN to find matching keys (safe for production)
            async for key in r.scan_iter(match=full_pattern, count=100):
                keys.append(key)

            if keys:
                deleted = await r.delete(*keys)
                logger.info(f"Cache INVALIDATE: {pattern} ({deleted} keys)")
                return deleted
            return 0

        except Exception as e:
            logger.warning(f"Cache invalidate error: {e}")
            return 0

    async def invalidate_multiple(self, patterns: List[str]) -> int:
        """
        Delete keys matching multiple patterns.

        Args:
            patterns: List of glob patterns

        Returns:
            Total number of keys deleted
        """
        total = 0
        for pattern in patterns:
            total += await self.invalidate_pattern(pattern)
        return total

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        r = await self.get_redis()
        if not r:
            return False

        try:
            full_key = self._make_key(key)
            return await r.exists(full_key) > 0
        except Exception:
            return False

    async def get_ttl(self, key: str) -> int:
        """Get remaining TTL for a key in seconds."""
        r = await self.get_redis()
        if not r:
            return -1

        try:
            full_key = self._make_key(key)
            return await r.ttl(full_key)
        except Exception:
            return -1

    async def get_stats(self) -> dict:
        """Get cache statistics."""
        r = await self.get_redis()
        if not r:
            return {"enabled": False, "connected": False}

        try:
            info = await r.info("stats")
            memory = await r.info("memory")

            # Count our cached keys
            key_count = 0
            async for _ in r.scan_iter(match=f"{CACHE_PREFIX}*", count=100):
                key_count += 1

            return {
                "enabled": CACHE_ENABLED,
                "connected": self._connected,
                "cached_keys": key_count,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "used_memory": memory.get("used_memory_human", "N/A"),
            }
        except Exception as e:
            return {"enabled": CACHE_ENABLED, "connected": False, "error": str(e)}


# Singleton instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get the singleton cache service instance."""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


def make_cache_key(*args, **kwargs) -> str:
    """
    Create a cache key from function arguments.

    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments

    Returns:
        Deterministic hash-based key
    """
    # Create a deterministic string from args
    key_parts = [str(a) for a in args]
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    key_string = ":".join(key_parts)

    # Hash if too long
    if len(key_string) > 200:
        return hashlib.md5(key_string.encode()).hexdigest()
    return key_string


def cache_response(
    ttl: int = 300,
    key_prefix: str = "",
    key_builder: Optional[Callable] = None,
):
    """
    Decorator for caching endpoint responses.

    Args:
        ttl: Cache TTL in seconds (default 5 minutes)
        key_prefix: Prefix for cache key
        key_builder: Optional function to build custom cache key

    Usage:
        @cache_response(ttl=60, key_prefix="events")
        async def get_events(category: str = None, limit: int = 20):
            ...

        # With custom key builder
        @cache_response(ttl=300, key_builder=lambda user_id: f"user:{user_id}")
        async def get_user(user_id: int):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache_service()

            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                func_key = make_cache_key(*args, **kwargs)
                cache_key = f"{key_prefix}:{func_key}" if key_prefix else func_key

            # Try to get from cache
            cached = await cache.get(cache_key)
            if cached is not None:
                return cached

            # Call function and cache result
            result = await func(*args, **kwargs)

            # Cache the result
            await cache.set(cache_key, result, ttl=ttl)

            return result

        return wrapper
    return decorator


# Cache key patterns for invalidation
class CacheKeys:
    """Common cache key patterns."""

    # Events
    EVENTS_ALL = "events:*"
    EVENTS_TRENDING = "trending:*"

    @staticmethod
    def events_list(params_hash: str) -> str:
        return f"events:{params_hash}"

    @staticmethod
    def events_trending(limit: int) -> str:
        return f"trending:{limit}"

    # Streams
    STREAMS_ALL = "streams:*"

    @staticmethod
    def streams_list(status: str, page: int) -> str:
        return f"streams:{status}:{page}"

    # Discovery
    DISCOVER_ALL = "discover:*"

    @staticmethod
    def discover(category: str, page: int) -> str:
        return f"discover:{category}:{page}"

    # Users
    @staticmethod
    def user(user_id: int) -> str:
        return f"user:{user_id}"

    @staticmethod
    def user_pattern(user_id: int) -> str:
        return f"user:{user_id}:*"

    # Creator profiles
    @staticmethod
    def creator(creator_id: int) -> str:
        return f"creator:{creator_id}"

    @staticmethod
    def creator_tiers(creator_id: int) -> str:
        return f"creator:{creator_id}:tiers"


async def invalidate_on_stream_change():
    """Invalidate caches when a stream is created/updated/ended."""
    cache = get_cache_service()
    await cache.invalidate_multiple([
        CacheKeys.STREAMS_ALL,
        CacheKeys.DISCOVER_ALL,
        CacheKeys.EVENTS_ALL,
    ])


async def invalidate_on_ranking_update():
    """Invalidate caches when rankings are updated."""
    cache = get_cache_service()
    await cache.invalidate_multiple([
        CacheKeys.EVENTS_TRENDING,
        CacheKeys.EVENTS_ALL,
        CacheKeys.DISCOVER_ALL,
    ])


async def invalidate_user_cache(user_id: int):
    """Invalidate all caches related to a user."""
    cache = get_cache_service()
    await cache.invalidate_pattern(CacheKeys.user_pattern(user_id))
    await cache.delete(CacheKeys.user(user_id))


async def invalidate_creator_cache(creator_id: int):
    """Invalidate all caches related to a creator."""
    cache = get_cache_service()
    await cache.delete(CacheKeys.creator(creator_id))
    await cache.delete(CacheKeys.creator_tiers(creator_id))
