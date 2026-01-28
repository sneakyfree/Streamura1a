"""
Streamura OpenAPI Documentation Module

Comprehensive OpenAPI/Swagger documentation for all API endpoints
with enhanced descriptions, examples, and security schemes.
"""

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from typing import Any, Dict

# API metadata
API_TITLE = "Streamura API"
API_DESCRIPTION = """
# Streamura Platform API

Streamura is an AI-native streaming platform built on the DNA Strand architecture,
offering creator-first economics with a 90/10 revenue split.

## Authentication

All authenticated endpoints require a JWT Bearer token in the Authorization header:

```
Authorization: Bearer <your-token>
```

Tokens are obtained via `/api/v1/auth/login` and expire after 24 hours.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Standard endpoints**: 100 requests/minute
- **Auth endpoints**: 5 requests/minute (login), 3/5 minutes (register)
- **Search**: 60 requests/minute
- **Chat**: 30 requests/10 seconds

Exceeding limits returns `429 Too Many Requests`.

## Agentic System

Streamura uses AI agents for various platform operations. Some actions
may require Human-in-the-Loop (HITL) approval for safety:

- Payouts > $10,000
- Account-level actions (bans, suspensions)
- Content removal decisions
- Emergency actions

## WebSocket Endpoints

Real-time features use WebSocket connections:
- `/ws/chat/{stream_id}` - Live chat
- `/ws/notifications` - User notifications
- `/ws/admin/agents` - Agent status (admin only)

## Versioning

This API uses URL versioning: `/api/v1/...`

Major versions may introduce breaking changes. Minor updates are backwards compatible.
"""

API_VERSION = "1.0.0"
API_CONTACT = {
    "name": "Streamura Developer Support",
    "email": "api-support@streamura.com",
    "url": "https://developers.streamura.com",
}
API_LICENSE = {
    "name": "Proprietary",
    "url": "https://streamura.com/api-terms",
}

# Security schemes
SECURITY_SCHEMES = {
    "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "JWT token obtained from /api/v1/auth/login",
    },
    "apiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API key for server-to-server communication",
    },
}

# Tag descriptions for endpoint grouping
TAGS_METADATA = [
    {
        "name": "Authentication",
        "description": "User registration, login, logout, and token management",
    },
    {
        "name": "Users",
        "description": "User profile management and preferences",
    },
    {
        "name": "Streams",
        "description": "Live stream creation, management, and viewing",
    },
    {
        "name": "Chat",
        "description": "Real-time chat messaging in streams",
    },
    {
        "name": "Subscriptions",
        "description": "Creator subscription tiers and management",
    },
    {
        "name": "Virtual Goods",
        "description": "Digital items: badges, emotes, effects, and stickers",
    },
    {
        "name": "Revenue",
        "description": "Earnings, payouts, and revenue analytics",
    },
    {
        "name": "Discovery",
        "description": "Content discovery, search, and recommendations",
    },
    {
        "name": "Moderation",
        "description": "Content moderation and safety features",
    },
    {
        "name": "Admin",
        "description": "Administrative operations (admin only)",
    },
    {
        "name": "Agents",
        "description": "AI agent status and HITL approval queue",
    },
    {
        "name": "Analytics",
        "description": "Platform and creator analytics",
    },
    {
        "name": "Privacy",
        "description": "GDPR/CCPA data export and privacy controls",
    },
    {
        "name": "Webhooks",
        "description": "Webhook configuration and management",
    },
    {
        "name": "Health",
        "description": "System health and status endpoints",
    },
]

# Example responses
EXAMPLE_RESPONSES = {
    "user_response": {
        "id": 1234,
        "username": "creator_example",
        "display_name": "Example Creator",
        "email": "creator@example.com",
        "is_verified": True,
        "trust_score": 0.92,
        "follower_count": 15234,
        "created_at": "2025-01-15T10:30:00Z",
    },
    "stream_response": {
        "id": 5678,
        "title": "Live Gaming Session",
        "description": "Playing the latest releases",
        "category": "gaming",
        "status": "live",
        "viewer_count": 1523,
        "started_at": "2026-01-28T20:00:00Z",
        "creator": {
            "id": 1234,
            "username": "creator_example",
            "display_name": "Example Creator",
        },
        "hls_url": "https://stream.streamura.com/live/5678.m3u8",
        "thumbnail_url": "https://cdn.streamura.com/thumbnails/5678.jpg",
    },
    "error_400": {
        "detail": "Invalid request parameters",
        "errors": [
            {"field": "email", "message": "Invalid email format"}
        ],
    },
    "error_401": {
        "detail": "Not authenticated",
    },
    "error_403": {
        "detail": "Not authorized to perform this action",
    },
    "error_404": {
        "detail": "Resource not found",
    },
    "error_429": {
        "detail": "Rate limit exceeded",
        "retry_after": 60,
    },
}


def custom_openapi(app: FastAPI) -> Dict[str, Any]:
    """
    Generate custom OpenAPI schema with enhanced documentation.
    """
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=API_TITLE,
        version=API_VERSION,
        description=API_DESCRIPTION,
        routes=app.routes,
        tags=TAGS_METADATA,
    )
    
    # Add contact and license info
    openapi_schema["info"]["contact"] = API_CONTACT
    openapi_schema["info"]["license"] = API_LICENSE
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = SECURITY_SCHEMES
    
    # Add global security requirement
    openapi_schema["security"] = [{"bearerAuth": []}]
    
    # Add servers
    openapi_schema["servers"] = [
        {
            "url": "https://api.streamura.com",
            "description": "Production API",
        },
        {
            "url": "https://api-staging.streamura.com",
            "description": "Staging API",
        },
        {
            "url": "http://localhost:8000",
            "description": "Local development",
        },
    ]
    
    # Add common response schemas
    openapi_schema["components"]["schemas"]["Error"] = {
        "type": "object",
        "properties": {
            "detail": {"type": "string"},
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "field": {"type": "string"},
                        "message": {"type": "string"},
                    },
                },
            },
        },
        "required": ["detail"],
    }
    
    openapi_schema["components"]["schemas"]["PaginatedResponse"] = {
        "type": "object",
        "properties": {
            "items": {"type": "array"},
            "total": {"type": "integer"},
            "page": {"type": "integer"},
            "page_size": {"type": "integer"},
            "has_more": {"type": "boolean"},
        },
    }
    
    # Cache the schema
    app.openapi_schema = openapi_schema
    
    return openapi_schema


def setup_openapi(app: FastAPI):
    """
    Configure OpenAPI documentation for the FastAPI app.
    """
    app.openapi = lambda: custom_openapi(app)
    
    # Override docs endpoints
    app.docs_url = "/api/docs"
    app.redoc_url = "/api/redoc"
    app.openapi_url = "/api/openapi.json"


# Endpoint documentation decorators
def documented_endpoint(
    summary: str,
    description: str,
    response_description: str = "Successful response",
    responses: Dict[int, Dict[str, Any]] = None,
    tags: list = None,
):
    """
    Decorator factory for adding detailed documentation to endpoints.
    
    Usage:
        @router.get("/users/{user_id}")
        @documented_endpoint(
            summary="Get user by ID",
            description="Retrieves a user's public profile by their ID.",
            tags=["Users"]
        )
        async def get_user(user_id: int):
            ...
    """
    default_responses = {
        400: {"description": "Bad Request", "content": {"application/json": {"example": EXAMPLE_RESPONSES["error_400"]}}},
        401: {"description": "Unauthorized", "content": {"application/json": {"example": EXAMPLE_RESPONSES["error_401"]}}},
        404: {"description": "Not Found", "content": {"application/json": {"example": EXAMPLE_RESPONSES["error_404"]}}},
        429: {"description": "Rate Limited", "content": {"application/json": {"example": EXAMPLE_RESPONSES["error_429"]}}},
    }
    
    merged_responses = {**default_responses, **(responses or {})}
    
    def decorator(func):
        func.__doc__ = description
        
        # Add OpenAPI metadata
        if not hasattr(func, "_openapi_extra"):
            func._openapi_extra = {}
        
        func._openapi_extra["summary"] = summary
        func._openapi_extra["responses"] = merged_responses
        if tags:
            func._openapi_extra["tags"] = tags
        
        return func
    
    return decorator


# API route documentation templates
ROUTE_DOCS = {
    # Authentication
    "auth_register": {
        "summary": "Register new user",
        "description": """
Register a new user account.

**Rate limit**: 3 requests per 5 minutes

Returns a confirmation that the account was created. The user must verify their
email before they can log in.
        """,
        "tags": ["Authentication"],
    },
    "auth_login": {
        "summary": "User login",
        "description": """
Authenticate a user and receive a JWT access token.

**Rate limit**: 5 requests per minute

If 2FA is enabled, the response will include `2fa_required: true` and the user
must complete 2FA verification via `/api/v1/auth/2fa/verify`.
        """,
        "tags": ["Authentication"],
    },
    
    # Streams
    "streams_create": {
        "summary": "Create stream",
        "description": """
Create a new live stream.

The response includes the RTMP ingest URL and stream key for broadcasting.
The stream starts in 'offline' status until the broadcaster connects.

**Requires**: Authenticated user with creator permissions
        """,
        "tags": ["Streams"],
    },
    "streams_list": {
        "summary": "List streams",
        "description": """
Get a paginated list of streams.

Supports filtering by:
- `status`: live, offline, past
- `category`: gaming, music, talk, etc.
- `creator_id`: Filter by specific creator
        """,
        "tags": ["Streams"],
    },
    
    # Revenue
    "revenue_request_payout": {
        "summary": "Request payout",
        "description": """
Request a payout of available earnings.

**HITL Approval**: Payouts exceeding $10,000 require manual approval
from the finance team before processing.

Minimum payout: $100.00
Processing time: 3-5 business days
        """,
        "tags": ["Revenue"],
    },
    
    # Admin/Agents
    "agents_status": {
        "summary": "Get agent status",
        "description": """
Get the current status of all AI agents in the system.

**Requires**: Admin authentication

Returns health status, recent decisions, and performance metrics
for each agent type.
        """,
        "tags": ["Agents"],
    },
    "hitl_queue": {
        "summary": "Get HITL approval queue",
        "description": """
Get pending Human-in-the-Loop approval requests.

**Requires**: Admin authentication

Items in the queue are decisions that exceeded confidence thresholds
or monetary limits and require human review.
        """,
        "tags": ["Agents"],
    },
}


def get_route_doc(route_name: str) -> Dict[str, Any]:
    """Get documentation for a specific route."""
    return ROUTE_DOCS.get(route_name, {
        "summary": route_name.replace("_", " ").title(),
        "description": f"Endpoint: {route_name}",
    })
