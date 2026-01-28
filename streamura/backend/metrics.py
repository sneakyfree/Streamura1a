"""
Streamura Prometheus Metrics Module

Provides comprehensive observability for the Streamura platform including:
- Request latency and throughput metrics
- Agentic system metrics (decisions, approvals, execution times)
- Revenue and transaction metrics
- Streaming infrastructure metrics
- WebSocket connection tracking
"""

import time
from functools import wraps
from typing import Callable, Optional
from contextlib import contextmanager

# Try to import prometheus_client, provide fallback if not available
try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Summary,
        Info,
        generate_latest,
        CONTENT_TYPE_LATEST,
        CollectorRegistry,
        multiprocess,
        REGISTRY,
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    # Provide mock implementations
    class MockMetric:
        def labels(self, **kwargs): return self
        def inc(self, amount=1): pass
        def dec(self, amount=1): pass
        def set(self, value): pass
        def observe(self, value): pass
        def info(self, value): pass
        def time(self): return self
        def __enter__(self): return self
        def __exit__(self, *args): pass
    
    Counter = Histogram = Gauge = Summary = Info = lambda *args, **kwargs: MockMetric()
    REGISTRY = None
    CONTENT_TYPE_LATEST = "text/plain"
    def generate_latest(registry=None): return b""


# =============================================================================
# APPLICATION INFO
# =============================================================================

APP_INFO = Info(
    "streamura_app",
    "Streamura application information",
)

if PROMETHEUS_AVAILABLE:
    APP_INFO.info({
        "version": "1.0.0",
        "environment": "production",
        "platform": "streamura",
    })


# =============================================================================
# HTTP REQUEST METRICS
# =============================================================================

HTTP_REQUESTS_TOTAL = Counter(
    "streamura_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "streamura_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "streamura_http_requests_in_progress",
    "HTTP requests currently in progress",
    ["method", "endpoint"],
)


# =============================================================================
# AGENTIC SYSTEM METRICS
# =============================================================================

AGENT_DECISIONS_TOTAL = Counter(
    "streamura_agent_decisions_total",
    "Total agent decisions made",
    ["agent_type", "action_type", "outcome"],
)

AGENT_DECISION_DURATION_SECONDS = Histogram(
    "streamura_agent_decision_duration_seconds",
    "Agent decision duration in seconds",
    ["agent_type", "action_type"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0],
)

AGENT_CONFIDENCE_SCORES = Histogram(
    "streamura_agent_confidence_scores",
    "Agent decision confidence score distribution",
    ["agent_type", "action_type"],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

HITL_APPROVALS_TOTAL = Counter(
    "streamura_hitl_approvals_total",
    "Total HITL approval decisions",
    ["category", "outcome"],  # outcome: approved, rejected, escalated
)

HITL_QUEUE_SIZE = Gauge(
    "streamura_hitl_queue_size",
    "Current size of HITL approval queue",
    ["priority"],
)

HITL_WAIT_TIME_SECONDS = Histogram(
    "streamura_hitl_wait_time_seconds",
    "Time spent waiting for HITL approval",
    ["category", "priority"],
    buckets=[60, 300, 900, 1800, 3600, 7200, 14400, 28800],
)


# =============================================================================
# REVENUE METRICS
# =============================================================================

REVENUE_TOTAL = Counter(
    "streamura_revenue_total",
    "Total revenue in cents",
    ["type", "currency"],  # type: subscription, tip, virtual_good, currency_pack
)

TRANSACTIONS_TOTAL = Counter(
    "streamura_transactions_total",
    "Total transactions processed",
    ["type", "status"],  # status: success, failed, pending
)

PAYOUTS_TOTAL = Counter(
    "streamura_payouts_total",
    "Total payouts processed",
    ["status", "method"],  # method: instant, standard
)

ACTIVE_SUBSCRIPTIONS = Gauge(
    "streamura_active_subscriptions",
    "Number of active subscriptions",
)

CREATOR_BALANCE_TOTAL = Gauge(
    "streamura_creator_balance_total",
    "Total creator balance pending payout",
)


# =============================================================================
# STREAMING METRICS
# =============================================================================

ACTIVE_STREAMS = Gauge(
    "streamura_active_streams",
    "Number of currently active streams",
)

TOTAL_VIEWERS = Gauge(
    "streamura_total_viewers",
    "Total viewers across all streams",
)

STREAM_STARTS_TOTAL = Counter(
    "streamura_stream_starts_total",
    "Total stream starts",
    ["category"],
)

STREAM_DURATION_SECONDS = Histogram(
    "streamura_stream_duration_seconds",
    "Stream duration in seconds",
    ["category"],
    buckets=[60, 300, 600, 1800, 3600, 7200, 14400, 28800, 86400],
)

STREAM_PEAK_VIEWERS = Histogram(
    "streamura_stream_peak_viewers",
    "Peak viewer counts per stream",
    ["category"],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
)


# =============================================================================
# WEBSOCKET METRICS
# =============================================================================

WEBSOCKET_CONNECTIONS = Gauge(
    "streamura_websocket_connections",
    "Active WebSocket connections",
    ["type"],  # type: chat, dm, notifications
)

WEBSOCKET_MESSAGES_TOTAL = Counter(
    "streamura_websocket_messages_total",
    "Total WebSocket messages",
    ["type", "direction"],  # direction: sent, received
)


# =============================================================================
# MODERATION METRICS
# =============================================================================

MODERATION_ACTIONS_TOTAL = Counter(
    "streamura_moderation_actions_total",
    "Total moderation actions taken",
    ["action_type", "category", "automated"],
)

CONTENT_FLAGS_TOTAL = Counter(
    "streamura_content_flags_total",
    "Total content flags raised",
    ["category", "severity"],
)

CHAT_MESSAGES_MODERATED = Counter(
    "streamura_chat_messages_moderated",
    "Chat messages that triggered moderation",
    ["action"],  # action: block, warn, flag
)


# =============================================================================
# DISCOVERY & CLUSTERING METRICS
# =============================================================================

CLUSTER_EVENTS_TOTAL = Counter(
    "streamura_cluster_events_total",
    "Total clustering events",
    ["event_type"],  # event_type: created, merged, split
)

ACTIVE_CLUSTERS = Gauge(
    "streamura_active_clusters",
    "Number of active event clusters",
)

DISCOVERY_REQUESTS_TOTAL = Counter(
    "streamura_discovery_requests_total",
    "Total discovery feed requests",
    ["feed_type"],  # feed_type: home, trending, nearby, search
)


# =============================================================================
# ERROR METRICS
# =============================================================================

ERRORS_TOTAL = Counter(
    "streamura_errors_total",
    "Total application errors",
    ["type", "component"],
)


# =============================================================================
# HELPER FUNCTIONS & DECORATORS
# =============================================================================

def track_request_metrics(method: str, endpoint: str):
    """Decorator to track HTTP request metrics."""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
            start_time = time.time()
            status_code = "500"
            try:
                result = await func(*args, **kwargs)
                status_code = "200"
                return result
            except Exception as e:
                status_code = getattr(e, "status_code", "500")
                raise
            finally:
                duration = time.time() - start_time
                HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
                HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=str(status_code)).inc()
                HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
            start_time = time.time()
            status_code = "500"
            try:
                result = func(*args, **kwargs)
                status_code = "200"
                return result
            except Exception as e:
                status_code = getattr(e, "status_code", "500")
                raise
            finally:
                duration = time.time() - start_time
                HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
                HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=str(status_code)).inc()
                HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


@contextmanager
def track_agent_decision(agent_type: str, action_type: str):
    """Context manager to track agent decision metrics."""
    start_time = time.time()
    outcome = "success"
    try:
        yield
    except Exception:
        outcome = "error"
        raise
    finally:
        duration = time.time() - start_time
        AGENT_DECISION_DURATION_SECONDS.labels(
            agent_type=agent_type, action_type=action_type
        ).observe(duration)
        AGENT_DECISIONS_TOTAL.labels(
            agent_type=agent_type, action_type=action_type, outcome=outcome
        ).inc()


def record_agent_confidence(agent_type: str, action_type: str, confidence: float):
    """Record agent decision confidence score."""
    AGENT_CONFIDENCE_SCORES.labels(
        agent_type=agent_type, action_type=action_type
    ).observe(confidence)


def record_revenue(amount_cents: int, revenue_type: str, currency: str = "USD"):
    """Record revenue transaction."""
    REVENUE_TOTAL.labels(type=revenue_type, currency=currency).inc(amount_cents)


def record_transaction(transaction_type: str, status: str):
    """Record transaction status."""
    TRANSACTIONS_TOTAL.labels(type=transaction_type, status=status).inc()


def record_hitl_approval(category: str, outcome: str):
    """Record HITL approval outcome."""
    HITL_APPROVALS_TOTAL.labels(category=category, outcome=outcome).inc()


def update_hitl_queue_size(priority: str, size: int):
    """Update HITL queue size gauge."""
    HITL_QUEUE_SIZE.labels(priority=priority).set(size)


def record_stream_start(category: str):
    """Record stream start."""
    STREAM_STARTS_TOTAL.labels(category=category).inc()
    ACTIVE_STREAMS.inc()


def record_stream_end(category: str, duration_seconds: float, peak_viewers: int):
    """Record stream end with metrics."""
    ACTIVE_STREAMS.dec()
    STREAM_DURATION_SECONDS.labels(category=category).observe(duration_seconds)
    STREAM_PEAK_VIEWERS.labels(category=category).observe(peak_viewers)


def update_viewer_count(total_viewers: int):
    """Update total viewer gauge."""
    TOTAL_VIEWERS.set(total_viewers)


def record_moderation_action(action_type: str, category: str, automated: bool = True):
    """Record moderation action."""
    MODERATION_ACTIONS_TOTAL.labels(
        action_type=action_type,
        category=category,
        automated=str(automated).lower()
    ).inc()


def record_error(error_type: str, component: str):
    """Record application error."""
    ERRORS_TOTAL.labels(type=error_type, component=component).inc()


# =============================================================================
# METRICS ENDPOINT
# =============================================================================

def get_metrics():
    """Generate Prometheus metrics output."""
    if not PROMETHEUS_AVAILABLE:
        return b"# Prometheus client not installed", "text/plain"
    
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST


def get_metrics_content_type():
    """Get the content type for metrics endpoint."""
    return CONTENT_TYPE_LATEST


# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

def create_metrics_endpoint(app):
    """Add /metrics endpoint to FastAPI app."""
    from fastapi import Response
    
    @app.get("/metrics")
    async def metrics():
        content, content_type = get_metrics()
        return Response(content=content, media_type=content_type)
    
    return app


# =============================================================================
# MIDDLEWARE FOR AUTOMATIC REQUEST TRACKING
# =============================================================================

class PrometheusMiddleware:
    """FastAPI middleware for automatic request metrics."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "/")
        
        # Normalize path (remove IDs for grouping)
        import re
        normalized_path = re.sub(r'/\d+', '/{id}', path)
        
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=normalized_path).inc()
        start_time = time.time()
        status_code = 500
        
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.time() - start_time
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method, endpoint=normalized_path
            ).observe(duration)
            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=normalized_path, status_code=str(status_code)
            ).inc()
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method, endpoint=normalized_path).dec()
