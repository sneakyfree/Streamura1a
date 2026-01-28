"""
Streamura Distributed Tracing Module

Provides OpenTelemetry-based distributed tracing for:
- Request correlation across services
- Agent decision tracking
- Database query tracing
- WebSocket message tracing
- External API call monitoring
"""

import os
import time
import uuid
import logging
from typing import Any, Dict, Optional, Callable
from functools import wraps
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import OpenTelemetry, provide fallback if not available
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import SERVICE_NAME, Resource
    from opentelemetry.trace import StatusCode, Status
    from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
    
    # Try Jaeger exporter
    try:
        from opentelemetry.exporter.jaeger.thrift import JaegerExporter
        JAEGER_AVAILABLE = True
    except ImportError:
        JAEGER_AVAILABLE = False
    
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    JAEGER_AVAILABLE = False


# =============================================================================
# CONFIGURATION
# =============================================================================

TRACING_CONFIG = {
    "service_name": "streamura-backend",
    "jaeger_agent_host": os.getenv("JAEGER_AGENT_HOST", "localhost"),
    "jaeger_agent_port": int(os.getenv("JAEGER_AGENT_PORT", "6831")),
    "sample_rate": float(os.getenv("TRACING_SAMPLE_RATE", "1.0")),
    "enabled": os.getenv("TRACING_ENABLED", "true").lower() == "true",
}


# =============================================================================
# SPAN DATA STRUCTURES
# =============================================================================

@dataclass
class SpanContext:
    """Context for a trace span."""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    baggage: Dict[str, str] = field(default_factory=dict)


@dataclass
class Span:
    """A trace span representing a unit of work."""
    name: str
    context: SpanContext
    start_time: float
    end_time: Optional[float] = None
    status: str = "OK"
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: list = field(default_factory=list)
    
    def set_attribute(self, key: str, value: Any):
        """Set a span attribute."""
        self.attributes[key] = value
    
    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        """Add an event to the span."""
        self.events.append({
            "name": name,
            "timestamp": time.time(),
            "attributes": attributes or {},
        })
    
    def set_status(self, status: str, description: Optional[str] = None):
        """Set span status."""
        self.status = status
        if description:
            self.attributes["status.description"] = description
    
    def end(self):
        """End the span."""
        self.end_time = time.time()


# =============================================================================
# TRACER IMPLEMENTATION
# =============================================================================

class StreamuraTracer:
    """
    Distributed tracer for Streamura.
    
    Uses OpenTelemetry when available, falls back to internal implementation.
    """
    
    def __init__(self, service_name: str = "streamura-backend"):
        self.service_name = service_name
        self.enabled = TRACING_CONFIG["enabled"]
        self._current_spans: Dict[str, Span] = {}
        self._otel_tracer = None
        
        if OTEL_AVAILABLE and self.enabled:
            self._init_opentelemetry()
    
    def _init_opentelemetry(self):
        """Initialize OpenTelemetry tracing."""
        try:
            resource = Resource(attributes={
                SERVICE_NAME: self.service_name
            })
            
            provider = TracerProvider(resource=resource)
            
            if JAEGER_AVAILABLE:
                jaeger_exporter = JaegerExporter(
                    agent_host_name=TRACING_CONFIG["jaeger_agent_host"],
                    agent_port=TRACING_CONFIG["jaeger_agent_port"],
                )
                provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
                logger.info(
                    f"Jaeger tracing enabled: "
                    f"{TRACING_CONFIG['jaeger_agent_host']}:{TRACING_CONFIG['jaeger_agent_port']}"
                )
            
            trace.set_tracer_provider(provider)
            self._otel_tracer = trace.get_tracer(__name__)
            
        except Exception as e:
            logger.warning(f"Failed to initialize OpenTelemetry: {e}")
    
    def _generate_id(self) -> str:
        """Generate a unique ID for trace/span."""
        return uuid.uuid4().hex[:16]
    
    @contextmanager
    def start_span(
        self,
        name: str,
        parent: Optional[SpanContext] = None,
        attributes: Optional[Dict[str, Any]] = None
    ):
        """Start a new span."""
        if not self.enabled:
            yield None
            return
        
        if self._otel_tracer:
            # Use OpenTelemetry
            with self._otel_tracer.start_as_current_span(name) as otel_span:
                if attributes:
                    for key, value in attributes.items():
                        otel_span.set_attribute(key, value)
                try:
                    yield otel_span
                except Exception as e:
                    otel_span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
        else:
            # Use internal implementation
            span_context = SpanContext(
                trace_id=parent.trace_id if parent else self._generate_id(),
                span_id=self._generate_id(),
                parent_span_id=parent.span_id if parent else None,
            )
            
            span = Span(
                name=name,
                context=span_context,
                start_time=time.time(),
                attributes=attributes or {},
            )
            
            self._current_spans[span_context.span_id] = span
            
            try:
                yield span
            except Exception as e:
                span.set_status("ERROR", str(e))
                raise
            finally:
                span.end()
                self._export_span(span)
                del self._current_spans[span_context.span_id]
    
    def _export_span(self, span: Span):
        """Export span to logging (fallback when no exporter configured)."""
        duration_ms = ((span.end_time or time.time()) - span.start_time) * 1000
        
        logger.debug(
            f"TRACE: {span.name} | "
            f"trace_id={span.context.trace_id} | "
            f"span_id={span.context.span_id} | "
            f"duration={duration_ms:.2f}ms | "
            f"status={span.status}"
        )


# Global tracer instance
tracer = StreamuraTracer()


# =============================================================================
# TRACING DECORATORS
# =============================================================================

def trace_function(
    name: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None
):
    """Decorator to trace a function."""
    def decorator(func: Callable):
        span_name = name or func.__name__
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            with tracer.start_span(span_name, attributes=attributes) as span:
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    if span:
                        span.add_event("exception", {"message": str(e)})
                    raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            with tracer.start_span(span_name, attributes=attributes) as span:
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    if span:
                        span.add_event("exception", {"message": str(e)})
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def trace_agent_decision(agent_type: str):
    """Decorator to trace agent decisions."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            attributes = {
                "agent.type": agent_type,
                "agent.operation": func.__name__,
            }
            
            with tracer.start_span(f"agent.{agent_type}.{func.__name__}", attributes=attributes) as span:
                try:
                    result = await func(*args, **kwargs)
                    
                    if span and isinstance(result, dict):
                        if "confidence" in result:
                            span.set_attribute("agent.confidence", result["confidence"])
                        if "decision" in result:
                            span.set_attribute("agent.decision", result["decision"])
                        if "requires_approval" in result:
                            span.set_attribute("agent.requires_approval", result["requires_approval"])
                    
                    return result
                except Exception as e:
                    if span:
                        span.set_status("ERROR", str(e))
                    raise
        
        return wrapper
    
    return decorator


def trace_db_query(operation: str):
    """Decorator to trace database queries."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            attributes = {
                "db.system": "postgresql",
                "db.operation": operation,
            }
            
            with tracer.start_span(f"db.{operation}", attributes=attributes) as span:
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    return result
                finally:
                    if span:
                        duration_ms = (time.time() - start) * 1000
                        span.set_attribute("db.duration_ms", duration_ms)
        
        return wrapper
    
    return decorator


def trace_external_call(service: str, operation: str):
    """Decorator to trace external API calls."""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            attributes = {
                "external.service": service,
                "external.operation": operation,
            }
            
            with tracer.start_span(f"external.{service}.{operation}", attributes=attributes) as span:
                start = time.time()
                try:
                    result = await func(*args, **kwargs)
                    if span:
                        span.set_attribute("external.success", True)
                    return result
                except Exception as e:
                    if span:
                        span.set_attribute("external.success", False)
                        span.set_attribute("external.error", str(e))
                    raise
                finally:
                    if span:
                        duration_ms = (time.time() - start) * 1000
                        span.set_attribute("external.duration_ms", duration_ms)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            attributes = {
                "external.service": service,
                "external.operation": operation,
            }
            
            with tracer.start_span(f"external.{service}.{operation}", attributes=attributes) as span:
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    if span:
                        span.set_attribute("external.success", True)
                    return result
                except Exception as e:
                    if span:
                        span.set_attribute("external.success", False)
                        span.set_attribute("external.error", str(e))
                    raise
                finally:
                    if span:
                        duration_ms = (time.time() - start) * 1000
                        span.set_attribute("external.duration_ms", duration_ms)
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# =============================================================================
# MIDDLEWARE AND UTILITIES
# =============================================================================

class TracingMiddleware:
    """ASGI middleware for request tracing."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "/")
        
        attributes = {
            "http.method": method,
            "http.url": path,
            "http.scheme": scope.get("scheme", "http"),
        }
        
        # Extract trace context from headers if present
        headers = dict(scope.get("headers", []))
        trace_id = headers.get(b"x-trace-id", b"").decode() or None
        
        with tracer.start_span(f"HTTP {method} {path}", attributes=attributes) as span:
            status_code = 500
            
            async def send_wrapper(message):
                nonlocal status_code
                if message["type"] == "http.response.start":
                    status_code = message["status"]
                    if span:
                        span.set_attribute("http.status_code", status_code)
                await send(message)
            
            try:
                await self.app(scope, receive, send_wrapper)
                
                if span and status_code >= 400:
                    span.set_status("ERROR", f"HTTP {status_code}")
                    
            except Exception as e:
                if span:
                    span.set_status("ERROR", str(e))
                raise


def get_trace_context() -> Dict[str, str]:
    """Get current trace context for propagation."""
    if OTEL_AVAILABLE:
        propagator = TraceContextTextMapPropagator()
        carrier = {}
        propagator.inject(carrier)
        return carrier
    
    return {}


def inject_trace_context(headers: Dict[str, str]):
    """Inject trace context into headers for outgoing requests."""
    trace_context = get_trace_context()
    headers.update(trace_context)
    return headers


# =============================================================================
# WEBSOCKET TRACING
# =============================================================================

def trace_websocket_message(message_type: str):
    """Trace WebSocket message handling."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            attributes = {
                "websocket.message_type": message_type,
            }
            
            with tracer.start_span(f"websocket.{message_type}", attributes=attributes) as span:
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    if span:
                        span.set_status("ERROR", str(e))
                    raise
        
        return wrapper
    
    return decorator


# =============================================================================
# AGENT DECISION TRACING
# =============================================================================

@contextmanager
def trace_agent_workflow(
    agent_type: str,
    decision_id: str,
    user_id: Optional[int] = None
):
    """Context manager to trace complete agent decision workflow."""
    attributes = {
        "agent.type": agent_type,
        "agent.decision_id": decision_id,
    }
    
    if user_id:
        attributes["agent.user_id"] = user_id
    
    with tracer.start_span(f"agent.workflow.{agent_type}", attributes=attributes) as span:
        try:
            yield span
        except Exception as e:
            if span:
                span.set_status("ERROR", str(e))
            raise
