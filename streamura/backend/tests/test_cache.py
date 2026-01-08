"""
Tests for Redis Response Caching Service (Phase 11)

Tests the following functionality:
- Cache get/set operations
- Cache TTL behavior
- Pattern-based invalidation
- Cache decorator functionality
- Cache key generation
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from backend.cache import (
    CacheService,
    get_cache_service,
    make_cache_key,
    cache_response,
    CacheKeys,
    invalidate_on_stream_change,
    invalidate_on_ranking_update,
    invalidate_user_cache,
    invalidate_creator_cache,
    CACHE_PREFIX,
)


class TestCacheKeyGeneration:
    """Test cache key generation utilities."""

    def test_make_cache_key_simple(self):
        """Test simple cache key generation."""
        key = make_cache_key("events", "live", 10)
        assert key == "events:live:10"

    def test_make_cache_key_with_kwargs(self):
        """Test cache key generation with keyword arguments."""
        key = make_cache_key("events", status="live", limit=10)
        assert "status=live" in key
        assert "limit=10" in key

    def test_make_cache_key_deterministic(self):
        """Test that same inputs produce same key."""
        key1 = make_cache_key("events", status="live", limit=10)
        key2 = make_cache_key("events", limit=10, status="live")
        assert key1 == key2

    def test_make_cache_key_long_string(self):
        """Test that long keys are hashed."""
        long_arg = "x" * 300
        key = make_cache_key(long_arg)
        # Should be MD5 hash (32 chars)
        assert len(key) == 32

    def test_cache_keys_class_methods(self):
        """Test CacheKeys helper methods."""
        assert CacheKeys.events_list("abc") == "events:abc"
        assert CacheKeys.events_trending(10) == "trending:10"
        assert CacheKeys.streams_list("live", 1) == "streams:live:1"
        assert CacheKeys.discover("sports", 2) == "discover:sports:2"
        assert CacheKeys.user(123) == "user:123"
        assert CacheKeys.user_pattern(123) == "user:123:*"
        assert CacheKeys.creator(456) == "creator:456"
        assert CacheKeys.creator_tiers(456) == "creator:456:tiers"


class TestCacheService:
    """Test CacheService operations."""

    @pytest.fixture
    def cache_service(self):
        """Create a fresh cache service instance."""
        return CacheService()

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        mock = AsyncMock()
        mock.ping = AsyncMock(return_value=True)
        mock.get = AsyncMock(return_value=None)
        mock.setex = AsyncMock(return_value=True)
        mock.delete = AsyncMock(return_value=1)
        mock.exists = AsyncMock(return_value=1)
        mock.ttl = AsyncMock(return_value=300)
        mock.scan_iter = AsyncMock(return_value=AsyncIteratorMock([]))
        mock.info = AsyncMock(return_value={"keyspace_hits": 100, "keyspace_misses": 50})
        mock.close = AsyncMock()
        return mock

    @pytest.mark.asyncio
    async def test_cache_get_miss(self, cache_service, mock_redis):
        """Test cache get when key doesn't exist."""
        mock_redis.get = AsyncMock(return_value=None)

        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.get("nonexistent")
            assert result is None

    @pytest.mark.asyncio
    async def test_cache_get_hit(self, cache_service, mock_redis):
        """Test cache get when key exists."""
        mock_redis.get = AsyncMock(return_value='{"data": "test"}')

        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.get("existing")
            assert result == {"data": "test"}

    @pytest.mark.asyncio
    async def test_cache_set(self, cache_service, mock_redis):
        """Test cache set operation."""
        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.set("key", {"value": 123}, ttl=60)
            assert result is True
            mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_delete(self, cache_service, mock_redis):
        """Test cache delete operation."""
        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.delete("key")
            assert result is True
            mock_redis.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_cache_exists(self, cache_service, mock_redis):
        """Test cache exists check."""
        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.exists("key")
            assert result is True

    @pytest.mark.asyncio
    async def test_cache_get_ttl(self, cache_service, mock_redis):
        """Test getting TTL for a key."""
        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            result = await cache_service.get_ttl("key")
            assert result == 300

    @pytest.mark.asyncio
    async def test_cache_disabled(self, cache_service):
        """Test that operations return gracefully when cache is disabled."""
        with patch('backend.cache.CACHE_ENABLED', False):
            result = await cache_service.get("key")
            assert result is None

            result = await cache_service.set("key", "value")
            assert result is False

    @pytest.mark.asyncio
    async def test_cache_connection_error(self, cache_service):
        """Test graceful handling of Redis connection errors."""
        with patch('backend.cache.redis.from_url', side_effect=Exception("Connection refused")):
            result = await cache_service.get("key")
            assert result is None

    @pytest.mark.asyncio
    async def test_make_key_with_prefix(self, cache_service):
        """Test that keys are properly prefixed."""
        key = cache_service._make_key("test")
        assert key.startswith(CACHE_PREFIX)
        assert key == f"{CACHE_PREFIX}test"


class TestCacheInvalidation:
    """Test cache invalidation functions."""

    @pytest.fixture
    def mock_cache_service(self):
        """Create a mock cache service."""
        mock = AsyncMock()
        mock.invalidate_pattern = AsyncMock(return_value=5)
        mock.invalidate_multiple = AsyncMock(return_value=10)
        mock.delete = AsyncMock(return_value=True)
        return mock

    @pytest.mark.asyncio
    async def test_invalidate_on_stream_change(self, mock_cache_service):
        """Test stream change invalidation."""
        with patch('backend.cache.get_cache_service', return_value=mock_cache_service):
            await invalidate_on_stream_change()
            mock_cache_service.invalidate_multiple.assert_called_once()
            call_args = mock_cache_service.invalidate_multiple.call_args[0][0]
            assert CacheKeys.STREAMS_ALL in call_args
            assert CacheKeys.DISCOVER_ALL in call_args

    @pytest.mark.asyncio
    async def test_invalidate_on_ranking_update(self, mock_cache_service):
        """Test ranking update invalidation."""
        with patch('backend.cache.get_cache_service', return_value=mock_cache_service):
            await invalidate_on_ranking_update()
            mock_cache_service.invalidate_multiple.assert_called_once()
            call_args = mock_cache_service.invalidate_multiple.call_args[0][0]
            assert CacheKeys.EVENTS_TRENDING in call_args
            assert CacheKeys.EVENTS_ALL in call_args

    @pytest.mark.asyncio
    async def test_invalidate_user_cache(self, mock_cache_service):
        """Test user cache invalidation."""
        with patch('backend.cache.get_cache_service', return_value=mock_cache_service):
            await invalidate_user_cache(123)
            mock_cache_service.invalidate_pattern.assert_called_with("user:123:*")
            mock_cache_service.delete.assert_called_with("user:123")

    @pytest.mark.asyncio
    async def test_invalidate_creator_cache(self, mock_cache_service):
        """Test creator cache invalidation."""
        with patch('backend.cache.get_cache_service', return_value=mock_cache_service):
            await invalidate_creator_cache(456)
            assert mock_cache_service.delete.call_count == 2


class TestCacheDecorator:
    """Test cache_response decorator."""

    @pytest.mark.asyncio
    async def test_decorator_caches_result(self):
        """Test that decorator caches function results."""
        call_count = 0

        @cache_response(ttl=60, key_prefix="test")
        async def expensive_function(x: int):
            nonlocal call_count
            call_count += 1
            return {"result": x * 2}

        mock_cache = AsyncMock()
        mock_cache.get = AsyncMock(side_effect=[None, {"result": 10}])
        mock_cache.set = AsyncMock()

        with patch('backend.cache.get_cache_service', return_value=mock_cache):
            # First call - cache miss
            result1 = await expensive_function(5)
            assert result1 == {"result": 10}
            assert call_count == 1

            # Second call - cache hit (returns cached value)
            result2 = await expensive_function(5)
            assert result2 == {"result": 10}
            # Function shouldn't be called again for cache hit
            assert call_count == 1

    @pytest.mark.asyncio
    async def test_decorator_with_custom_key_builder(self):
        """Test decorator with custom key builder."""
        @cache_response(ttl=60, key_builder=lambda user_id: f"user:{user_id}:profile")
        async def get_profile(user_id: int):
            return {"user_id": user_id, "name": "Test"}

        mock_cache = AsyncMock()
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        with patch('backend.cache.get_cache_service', return_value=mock_cache):
            await get_profile(123)
            # Verify the custom key was used
            mock_cache.get.assert_called_with("user:123:profile")


class TestCachedEndpoints:
    """Integration tests for cached API endpoints."""

    def test_cached_events_endpoint(self, client: TestClient):
        """Test that events endpoint returns cached data correctly."""
        # First request - populates cache
        response1 = client.get("/api/v1/events")
        assert response1.status_code == 200

        # Second request - should use cache (same result)
        response2 = client.get("/api/v1/events")
        assert response2.status_code == 200
        assert response1.json() == response2.json()

    def test_cached_trending_endpoint(self, client: TestClient):
        """Test that trending endpoint uses caching."""
        response = client.get("/api/v1/events/trending")
        assert response.status_code == 200

    def test_cached_discover_endpoint(self, client: TestClient):
        """Test that discover endpoint uses caching."""
        response = client.get("/api/v1/discover")
        assert response.status_code == 200

    def test_cached_categories_endpoint(self, client: TestClient):
        """Test that categories endpoint uses caching."""
        response = client.get("/api/v1/discover/categories")
        assert response.status_code == 200


class AsyncIteratorMock:
    """Helper class for mocking async iterators."""

    def __init__(self, items):
        self.items = items
        self.index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item


class TestPatternInvalidation:
    """Test pattern-based cache invalidation."""

    @pytest.fixture
    def cache_service(self):
        """Create a fresh cache service instance."""
        return CacheService()

    @pytest.mark.asyncio
    async def test_invalidate_pattern_empty(self, cache_service):
        """Test invalidation when no keys match."""
        mock_redis = AsyncMock()
        mock_redis.scan_iter = lambda *args, **kwargs: AsyncIteratorMock([])
        mock_redis.delete = AsyncMock(return_value=0)

        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            count = await cache_service.invalidate_pattern("nonexistent:*")
            assert count == 0

    @pytest.mark.asyncio
    async def test_invalidate_pattern_with_matches(self, cache_service):
        """Test invalidation when keys match."""
        mock_redis = AsyncMock()
        mock_redis.scan_iter = lambda *args, **kwargs: AsyncIteratorMock([
            f"{CACHE_PREFIX}events:1",
            f"{CACHE_PREFIX}events:2",
            f"{CACHE_PREFIX}events:3",
        ])
        mock_redis.delete = AsyncMock(return_value=3)

        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            count = await cache_service.invalidate_pattern("events:*")
            assert count == 3

    @pytest.mark.asyncio
    async def test_invalidate_multiple_patterns(self, cache_service):
        """Test invalidating multiple patterns at once."""
        mock_redis = AsyncMock()
        mock_redis.scan_iter = lambda *args, **kwargs: AsyncIteratorMock([f"{CACHE_PREFIX}key"])
        mock_redis.delete = AsyncMock(return_value=1)

        with patch.object(cache_service, 'get_redis', return_value=mock_redis):
            count = await cache_service.invalidate_multiple(["events:*", "discover:*", "trending:*"])
            assert count == 3


class TestCacheStats:
    """Test cache statistics retrieval."""

    @pytest.mark.asyncio
    async def test_get_stats_connected(self):
        """Test getting stats when connected."""
        cache = CacheService()
        mock_redis = AsyncMock()
        mock_redis.info = AsyncMock(side_effect=[
            {"keyspace_hits": 100, "keyspace_misses": 50},
            {"used_memory_human": "10MB"}
        ])
        mock_redis.scan_iter = lambda *args, **kwargs: AsyncIteratorMock([
            f"{CACHE_PREFIX}key1",
            f"{CACHE_PREFIX}key2",
        ])

        cache._connected = True
        with patch.object(cache, 'get_redis', return_value=mock_redis):
            stats = await cache.get_stats()
            assert stats["connected"] is True
            assert stats["cached_keys"] == 2
            assert stats["hits"] == 100
            assert stats["misses"] == 50

    @pytest.mark.asyncio
    async def test_get_stats_disconnected(self):
        """Test getting stats when disconnected."""
        cache = CacheService()

        with patch.object(cache, 'get_redis', return_value=None):
            stats = await cache.get_stats()
            assert stats["connected"] is False
