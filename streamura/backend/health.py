"""
Streamura Health Check Module

Provides health and readiness endpoints for Kubernetes/Docker orchestration:
- /health - Basic liveness probe
- /ready - Readiness probe with dependency checks
- /status - Detailed system status
"""

import time
from datetime import datetime
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

import logging

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health check status values."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class DependencyCheck:
    """Result of a single dependency health check."""
    name: str
    status: HealthStatus
    latency_ms: Optional[float] = None
    message: Optional[str] = None
    last_check: datetime = field(default_factory=datetime.utcnow)


class HealthChecker:
    """Health check service for monitoring system dependencies."""
    
    def __init__(self):
        self.start_time = datetime.utcnow()
        self._checks: Dict[str, DependencyCheck] = {}
    
    async def check_database(self, db_session) -> DependencyCheck:
        """Check database connectivity."""
        start = time.time()
        try:
            # Simple query to verify connection
            result = db_session.execute("SELECT 1")
            result.fetchone()
            latency = (time.time() - start) * 1000
            
            return DependencyCheck(
                name="database",
                status=HealthStatus.HEALTHY,
                latency_ms=round(latency, 2),
                message="PostgreSQL connected"
            )
        except Exception as e:
            latency = (time.time() - start) * 1000
            logger.error(f"Database health check failed: {e}")
            return DependencyCheck(
                name="database",
                status=HealthStatus.UNHEALTHY,
                latency_ms=round(latency, 2),
                message=str(e)
            )
    
    async def check_redis(self, redis_client=None) -> DependencyCheck:
        """Check Redis connectivity."""
        start = time.time()
        try:
            if redis_client is None:
                # Try to import and connect
                try:
                    import redis.asyncio as redis
                    import os
                    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
                    client = redis.from_url(redis_url)
                    await client.ping()
                    await client.close()
                except ImportError:
                    return DependencyCheck(
                        name="redis",
                        status=HealthStatus.DEGRADED,
                        message="Redis client not installed"
                    )
            else:
                await redis_client.ping()
            
            latency = (time.time() - start) * 1000
            return DependencyCheck(
                name="redis",
                status=HealthStatus.HEALTHY,
                latency_ms=round(latency, 2),
                message="Redis connected"
            )
        except Exception as e:
            latency = (time.time() - start) * 1000
            logger.warning(f"Redis health check failed: {e}")
            return DependencyCheck(
                name="redis",
                status=HealthStatus.DEGRADED,
                latency_ms=round(latency, 2),
                message=str(e)
            )
    
    def check_livekit(self) -> DependencyCheck:
        """Check LiveKit connectivity."""
        import os
        
        livekit_url = os.getenv("LIVEKIT_URL")
        if not livekit_url:
            return DependencyCheck(
                name="livekit",
                status=HealthStatus.DEGRADED,
                message="LIVEKIT_URL not configured"
            )
        
        # Basic config check (actual connectivity would need async HTTP)
        return DependencyCheck(
            name="livekit",
            status=HealthStatus.HEALTHY,
            message=f"LiveKit configured: {livekit_url[:50]}..."
        )
    
    def check_stripe(self) -> DependencyCheck:
        """Check Stripe configuration."""
        import os
        
        stripe_key = os.getenv("STRIPE_SECRET_KEY")
        if not stripe_key:
            return DependencyCheck(
                name="stripe",
                status=HealthStatus.DEGRADED,
                message="STRIPE_SECRET_KEY not configured"
            )
        
        # Verify key format
        if stripe_key.startswith("sk_test_") or stripe_key.startswith("sk_live_"):
            return DependencyCheck(
                name="stripe",
                status=HealthStatus.HEALTHY,
                message="Stripe configured"
            )
        
        return DependencyCheck(
            name="stripe",
            status=HealthStatus.DEGRADED,
            message="Invalid Stripe key format"
        )
    
    def check_email(self) -> DependencyCheck:
        """Check email service configuration."""
        import os
        
        smtp_host = os.getenv("SMTP_HOST")
        if not smtp_host:
            return DependencyCheck(
                name="email",
                status=HealthStatus.DEGRADED,
                message="SMTP_HOST not configured"
            )
        
        return DependencyCheck(
            name="email",
            status=HealthStatus.HEALTHY,
            message=f"SMTP configured: {smtp_host}"
        )
    
    def get_uptime(self) -> Dict[str, Any]:
        """Get uptime information."""
        now = datetime.utcnow()
        uptime = now - self.start_time
        
        return {
            "started_at": self.start_time.isoformat(),
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_human": str(uptime).split(".")[0]
        }
    
    async def get_full_status(self, db_session=None, redis_client=None) -> Dict[str, Any]:
        """Get comprehensive system status."""
        checks = []
        
        # Check database
        if db_session:
            checks.append(await self.check_database(db_session))
        
        # Check Redis
        checks.append(await self.check_redis(redis_client))
        
        # Check external services
        checks.append(self.check_livekit())
        checks.append(self.check_stripe())
        checks.append(self.check_email())
        
        # Determine overall status
        unhealthy = [c for c in checks if c.status == HealthStatus.UNHEALTHY]
        degraded = [c for c in checks if c.status == HealthStatus.DEGRADED]
        
        if unhealthy:
            overall_status = HealthStatus.UNHEALTHY
        elif degraded:
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.HEALTHY
        
        return {
            "status": overall_status.value,
            "uptime": self.get_uptime(),
            "checks": [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "latency_ms": c.latency_ms,
                    "message": c.message,
                    "last_check": c.last_check.isoformat(),
                }
                for c in checks
            ],
            "version": "1.0.0",
            "environment": "production"
        }


# Global health checker instance
health_checker = HealthChecker()


# =============================================================================
# FASTAPI ENDPOINT FUNCTIONS
# =============================================================================

def get_health_response() -> Dict[str, Any]:
    """Simple liveness probe response."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_ready_response(db_session=None) -> Dict[str, Any]:
    """Readiness probe with database check."""
    if db_session:
        db_check = await health_checker.check_database(db_session)
        if db_check.status == HealthStatus.UNHEALTHY:
            return {
                "status": "unhealthy",
                "reason": "database unavailable",
                "timestamp": datetime.utcnow().isoformat(),
            }
    
    return {
        "status": "ready",
        "uptime": health_checker.get_uptime(),
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_status_response(db_session=None, redis_client=None) -> Dict[str, Any]:
    """Detailed status for monitoring dashboards."""
    return await health_checker.get_full_status(db_session, redis_client)


# =============================================================================
# FASTAPI ROUTER INTEGRATION
# =============================================================================

def create_health_router():
    """Create FastAPI router with health endpoints."""
    from fastapi import APIRouter, Depends, Response
    from backend.database import get_db
    
    router = APIRouter(tags=["Health"])
    
    @router.get("/health")
    async def health():
        """
        Liveness probe endpoint.
        Returns 200 if the service is running.
        """
        return get_health_response()
    
    @router.get("/ready")
    async def ready(db=Depends(get_db)):
        """
        Readiness probe endpoint.
        Returns 200 if the service is ready to accept traffic.
        Checks database connectivity.
        """
        result = await get_ready_response(db)
        if result["status"] != "ready":
            return Response(
                content='{"status": "not ready"}',
                status_code=503,
                media_type="application/json"
            )
        return result
    
    @router.get("/status")
    async def status(db=Depends(get_db)):
        """
        Detailed system status endpoint.
        Returns comprehensive health information for all dependencies.
        """
        return await get_status_response(db)
    
    return router
