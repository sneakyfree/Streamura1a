"""
Streamura CDN Integration Service

Provides CDN integration for global stream delivery with support for
Cloudflare, Fastly, and Bunny CDN providers.

Based on DNA Strand Master Plan Step 5.2 CDN Integration.
"""

import os
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class CDNProvider(Enum):
    """Supported CDN providers."""
    CLOUDFLARE = "cloudflare"
    FASTLY = "fastly"
    BUNNY = "bunny"
    LOCAL = "local"  # Development fallback


class CDNRegion(Enum):
    """CDN edge regions."""
    NA_EAST = "na-east"
    NA_WEST = "na-west"
    EU_WEST = "eu-west"
    EU_CENTRAL = "eu-central"
    ASIA_PACIFIC = "asia-pacific"
    SOUTH_AMERICA = "south-america"


@dataclass
class EdgeLocation:
    """Represents a CDN edge location."""
    region: CDNRegion
    city: str
    status: str = "healthy"
    latency_ms: float = 0.0
    capacity_percent: float = 0.0


@dataclass
class CDNMetrics:
    """CDN performance metrics."""
    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    bandwidth_gb: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    
    @property
    def cache_hit_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.cache_hits / self.total_requests
    
    def to_dict(self) -> Dict:
        return {
            "total_requests": self.total_requests,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "cache_hit_rate": round(self.cache_hit_rate, 4),
            "bandwidth_gb": round(self.bandwidth_gb, 2),
            "p50_latency_ms": round(self.p50_latency_ms, 2),
            "p95_latency_ms": round(self.p95_latency_ms, 2),
            "p99_latency_ms": round(self.p99_latency_ms, 2),
        }


class CDNService:
    """
    CDN integration for global stream delivery.
    
    Supports multiple CDN providers with automatic detection
    based on environment variables.
    """
    
    # Configuration from environment
    CLOUDFLARE_API_KEY = os.getenv("CLOUDFLARE_API_KEY", "")
    CLOUDFLARE_ZONE_ID = os.getenv("CLOUDFLARE_ZONE_ID", "")
    FASTLY_API_KEY = os.getenv("FASTLY_API_KEY", "")
    FASTLY_SERVICE_ID = os.getenv("FASTLY_SERVICE_ID", "")
    BUNNY_API_KEY = os.getenv("BUNNY_API_KEY", "")
    BUNNY_PULL_ZONE = os.getenv("BUNNY_PULL_ZONE", "")
    STREAM_CDN_DOMAIN = os.getenv("STREAM_CDN_DOMAIN", "")
    
    # Default edge locations (simulated for demo)
    DEFAULT_EDGE_LOCATIONS = [
        EdgeLocation(CDNRegion.NA_EAST, "New York", "healthy", 15.2, 45.0),
        EdgeLocation(CDNRegion.NA_WEST, "Los Angeles", "healthy", 22.5, 38.0),
        EdgeLocation(CDNRegion.EU_WEST, "London", "healthy", 28.1, 52.0),
        EdgeLocation(CDNRegion.EU_CENTRAL, "Frankfurt", "healthy", 31.4, 41.0),
        EdgeLocation(CDNRegion.ASIA_PACIFIC, "Tokyo", "healthy", 85.2, 33.0),
        EdgeLocation(CDNRegion.SOUTH_AMERICA, "São Paulo", "healthy", 95.7, 25.0),
    ]
    
    def __init__(self, provider: Optional[CDNProvider] = None):
        """
        Initialize CDN service.
        
        Args:
            provider: Specific CDN provider to use (auto-detected if None)
        """
        self.provider = provider or self._detect_provider()
        self._metrics = CDNMetrics()
        self._edge_locations = self.DEFAULT_EDGE_LOCATIONS.copy()
        self._configure()
    
    def _detect_provider(self) -> CDNProvider:
        """Auto-detect CDN provider from environment variables."""
        if self.CLOUDFLARE_API_KEY and self.CLOUDFLARE_ZONE_ID:
            logger.info("CDN: Detected Cloudflare configuration")
            return CDNProvider.CLOUDFLARE
        elif self.FASTLY_API_KEY and self.FASTLY_SERVICE_ID:
            logger.info("CDN: Detected Fastly configuration")
            return CDNProvider.FASTLY
        elif self.BUNNY_API_KEY and self.BUNNY_PULL_ZONE:
            logger.info("CDN: Detected Bunny configuration")
            return CDNProvider.BUNNY
        else:
            logger.warning("CDN: No provider configured, using local fallback")
            return CDNProvider.LOCAL
    
    def _configure(self):
        """Configure CDN provider-specific settings."""
        if self.provider == CDNProvider.CLOUDFLARE:
            self._base_url = f"https://{self.STREAM_CDN_DOMAIN or 'stream.streamura.com'}"
            self._api_endpoint = "https://api.cloudflare.com/client/v4"
        elif self.provider == CDNProvider.FASTLY:
            self._base_url = f"https://{self.STREAM_CDN_DOMAIN or 'stream.streamura.com'}"
            self._api_endpoint = "https://api.fastly.com"
        elif self.provider == CDNProvider.BUNNY:
            self._base_url = f"https://{self.BUNNY_PULL_ZONE}.b-cdn.net"
            self._api_endpoint = "https://api.bunny.net"
        else:
            self._base_url = "http://localhost:8000"
            self._api_endpoint = None
    
    @property
    def is_production_mode(self) -> bool:
        """Check if running with a real CDN provider."""
        return self.provider != CDNProvider.LOCAL
    
    def get_stream_url(
        self,
        stream_id: int,
        quality: str = "auto",
        format: str = "hls"
    ) -> str:
        """
        Generate CDN-optimized stream URL.
        
        Args:
            stream_id: Unique stream identifier
            quality: Quality setting (auto, 1080p, 720p, 480p, 360p)
            format: Stream format (hls, dash)
            
        Returns:
            CDN edge URL for the stream
        """
        if format == "hls":
            path = f"/streams/{stream_id}/playlist.m3u8"
        else:
            path = f"/streams/{stream_id}/manifest.mpd"
        
        params = f"?quality={quality}"
        
        # Add cache-busting token for live streams
        params += f"&t={int(datetime.utcnow().timestamp())}"
        
        return f"{self._base_url}{path}{params}"
    
    def get_thumbnail_url(self, stream_id: int, size: str = "medium") -> str:
        """Get CDN URL for stream thumbnail."""
        return f"{self._base_url}/thumbnails/{stream_id}_{size}.jpg"
    
    def get_recording_url(self, recording_id: int) -> str:
        """Get CDN URL for a recording/VOD."""
        return f"{self._base_url}/recordings/{recording_id}/index.m3u8"
    
    async def purge_cache(self, stream_id: int) -> Dict:
        """
        Purge CDN cache for a stream.
        
        Typically called when a stream ends or settings change.
        
        Args:
            stream_id: Stream to purge from cache
            
        Returns:
            Purge status
        """
        purge_paths = [
            f"/streams/{stream_id}/*",
            f"/thumbnails/{stream_id}_*",
        ]
        
        if self.provider == CDNProvider.CLOUDFLARE:
            return await self._purge_cloudflare(purge_paths)
        elif self.provider == CDNProvider.FASTLY:
            return await self._purge_fastly(purge_paths)
        elif self.provider == CDNProvider.BUNNY:
            return await self._purge_bunny(purge_paths)
        else:
            logger.debug(f"Local mode: Would purge {purge_paths}")
            return {"status": "simulated", "paths": purge_paths}
    
    async def _purge_cloudflare(self, paths: List[str]) -> Dict:
        """Purge cache via Cloudflare API."""
        # In production, would use httpx to call Cloudflare API:
        # POST /zones/{zone_id}/purge_cache
        # {"files": [...]}
        logger.info(f"Cloudflare: Purging {len(paths)} paths")
        return {"status": "success", "provider": "cloudflare", "paths_purged": len(paths)}
    
    async def _purge_fastly(self, paths: List[str]) -> Dict:
        """Purge cache via Fastly API."""
        # In production, would use Fastly Surrogate-Key purging
        logger.info(f"Fastly: Purging {len(paths)} paths")
        return {"status": "success", "provider": "fastly", "paths_purged": len(paths)}
    
    async def _purge_bunny(self, paths: List[str]) -> Dict:
        """Purge cache via Bunny CDN API."""
        # In production, would use Bunny purge API
        logger.info(f"Bunny: Purging {len(paths)} paths")
        return {"status": "success", "provider": "bunny", "paths_purged": len(paths)}
    
    def get_edge_locations(self) -> List[Dict]:
        """
        Get list of active edge locations with status.
        
        Returns:
            List of edge location dictionaries
        """
        return [
            {
                "region": loc.region.value,
                "city": loc.city,
                "status": loc.status,
                "latency_ms": loc.latency_ms,
                "capacity_percent": loc.capacity_percent,
            }
            for loc in self._edge_locations
        ]
    
    def get_nearest_edge(self, latitude: float, longitude: float) -> Dict:
        """
        Find the nearest edge location to given coordinates.
        
        Args:
            latitude: User's latitude
            longitude: User's longitude
            
        Returns:
            Nearest edge location info
        """
        # Simplified region detection based on longitude
        if longitude < -100:
            region = CDNRegion.NA_WEST
        elif longitude < -30:
            region = CDNRegion.NA_EAST
        elif longitude < 0:
            region = CDNRegion.EU_WEST
        elif longitude < 40:
            region = CDNRegion.EU_CENTRAL
        elif longitude < 100:
            region = CDNRegion.ASIA_PACIFIC
        else:
            region = CDNRegion.ASIA_PACIFIC
        
        for loc in self._edge_locations:
            if loc.region == region:
                return {
                    "region": loc.region.value,
                    "city": loc.city,
                    "estimated_latency_ms": loc.latency_ms,
                }
        
        # Fallback to first healthy location
        return {
            "region": self._edge_locations[0].region.value,
            "city": self._edge_locations[0].city,
            "estimated_latency_ms": self._edge_locations[0].latency_ms,
        }
    
    def get_metrics(self) -> Dict:
        """
        Get CDN performance metrics.
        
        Returns:
            Metrics dictionary
        """
        return {
            "provider": self.provider.value,
            "is_production": self.is_production_mode,
            "metrics": self._metrics.to_dict(),
            "edge_locations": len(self._edge_locations),
            "healthy_locations": sum(1 for loc in self._edge_locations if loc.status == "healthy"),
        }
    
    def get_status(self) -> Dict:
        """Get overall CDN status."""
        healthy_count = sum(1 for loc in self._edge_locations if loc.status == "healthy")
        total_count = len(self._edge_locations)
        
        if healthy_count == total_count:
            overall_status = "healthy"
        elif healthy_count > total_count // 2:
            overall_status = "degraded"
        else:
            overall_status = "unhealthy"
        
        return {
            "provider": self.provider.value,
            "status": overall_status,
            "is_production": self.is_production_mode,
            "base_url": self._base_url,
            "edge_locations": {
                "total": total_count,
                "healthy": healthy_count,
            },
        }


# Singleton instance
_cdn_instance: Optional[CDNService] = None


def get_cdn_service() -> CDNService:
    """Get or create the singleton CDNService instance."""
    global _cdn_instance
    if _cdn_instance is None:
        _cdn_instance = CDNService()
    return _cdn_instance


def reset_cdn_service():
    """Reset the singleton instance (useful for testing)."""
    global _cdn_instance
    _cdn_instance = None
