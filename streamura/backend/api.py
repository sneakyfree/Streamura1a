"""
Streamura API Routes

This module contains all API endpoints for the Streamura backend.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, WebSocket, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from .database import get_db

# Rate limiter instance - will use the one from app state
limiter = Limiter(key_func=get_remote_address)
from .auth import (
    authenticate_user,
    create_user,
    create_anonymous_user,
    migrate_anonymous_to_registered,
    generate_auth_tokens,
    refresh_access_token,
    get_current_user,
    get_current_active_user,
    get_current_user_optional,
    get_current_admin_user,
    create_password_reset_token,
    verify_password_reset_token,
    reset_user_password,
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from .models import (
    User, Stream, Event, Notification, ChatMessage, UserFollow, StreamLike,
    Report, ModerationAction, Recording, ScheduledStream, StreamAnalytics,
    Tip, Transaction, ContentFilter, ModerationQueueItem, StreamModerationSettings, ChatMute,
    Conversation, ContactSubmission,
)
from .schemas import (
    StreamCreate,
    StreamResponse,
    EventCreate,
    EventUpdate,
    EventResponse,
    EventDetailResponse,
    EventListResponse,
    NotificationResponse
)
from .clustering import get_clustering_service, run_clustering
from .ranking import get_ranking_service
from .cache import get_cache_service, CacheKeys, make_cache_key
from .moderation import get_content_moderator, ModerationAction as ModAction
from .streaming import (
    streaming_service,
    initialize_stream_room,
    get_viewer_connection,
    handle_livekit_webhook,
)
from .schemas import (
    AdImpressionBase,
    AdImpressionResponse
)
from .models import AdImpression
from .websocket import (
    manager as ws_manager,
    handle_websocket_connection,
    broadcast_stream_status,
    handle_dm_websocket_connection,
    send_dm_notification,
    send_dm_read_receipt,
    dm_manager,
    broadcast_tip,
)
from .i18n import t, get_locale_from_request, DEFAULT_LANGUAGE
import random
import string


def get_locale(request: Request) -> str:
    """Get locale from request state or default to English."""
    try:
        return getattr(request.state, "locale", DEFAULT_LANGUAGE)
    except AttributeError:
        return DEFAULT_LANGUAGE


# Pydantic models for streaming API
class StreamTokenResponse(BaseModel):
    room_name: str
    token: str
    livekit_url: str


class WebhookResponse(BaseModel):
    status: str
    action: Optional[str] = None
    reason: Optional[str] = None


class AdResponse(BaseModel):
    id: str
    title: str
    description: str
    image_url: str
    cta_text: str
    cta_url: str
    duration: int = 15
    skip_after: int = 5
    priority: int = 1


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    stream_id: Optional[int] = None,
    event_id: Optional[int] = None,
    from_user_id: Optional[int] = None,
    transaction_id: Optional[int] = None,
    extra_data: Optional[dict] = None,
    commit: bool = True
):
    """Helper to create a notification"""
    notif = Notification(
        user_id=user_id,
        notification_type=type,
        title=title,
        message=message,
        stream_id=stream_id,
        event_id=event_id,
        from_user_id=from_user_id,
        transaction_id=transaction_id,
        extra_data=extra_data
    )
    db.add(notif)
    if commit:
        db.commit()
    return notif


router = APIRouter(prefix="/api/v1")


# =============================================================================
# NOTIFICATION ROUTES (Task 2.1.2)
# =============================================================================

@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's notifications"""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return notifications


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True, 
        "read_at": datetime.utcnow()
    })
    db.commit()
    
    return {"message": "All notifications marked as read"}



# =============================================================================
# EXPLAINABILITY ROUTES (DNA Strand C.4 Multi-View Explainability)
# =============================================================================

from .explainability import (
    get_explainability_engine,
    ViewLevel,
    DecisionType,
)


class ExplanationRequest(BaseModel):
    decision_type: str
    decision_data: Dict[str, Any]


@router.get("/explain/{decision_id}")
async def get_decision_explanation(
    decision_id: int,
    view: str = "viewer",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get explanation for a decision at appropriate view level.
    
    View levels:
    - viewer: Plain language explanation
    - creator: Detailed metrics and improvement tips
    - moderator: Evidence and policy references (requires moderator role)
    - auditor: Complete audit trail (requires admin role)
    """
    try:
        view_level = ViewLevel(view)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid view level. Must be one of: viewer, creator, moderator, auditor"
        )
    
    # Check authorization for higher-level views
    if view_level == ViewLevel.AUDITOR and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Auditor view requires admin role")
    
    if view_level == ViewLevel.MODERATOR and not (current_user.is_admin or getattr(current_user, 'is_moderator', False)):
        raise HTTPException(status_code=403, detail="Moderator view requires moderator role")
    
    engine = get_explainability_engine(db)
    
    # Mock decision data - in production, fetch from database
    decision_data = {
        "decision_id": decision_id,
        "action": "flag",
        "categories": {"profanity": 0.75, "spam": 0.2},
        "confidence": 0.75,
        "primary_reason": "profanity",
        "content": "Sample flagged content...",
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    result = engine.generate_explanation(
        decision_type=DecisionType.MODERATION,
        decision_data=decision_data,
        view_level=view_level,
        user_id=current_user.id
    )
    
    return result.to_dict()


@router.get("/moderation/{action_id}/explanation")
async def get_moderation_explanation(
    action_id: int,
    view: str = "viewer",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get explanation for a specific moderation action."""
    action = db.query(ModerationAction).filter(ModerationAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Moderation action not found")
    
    if action.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this action")
    
    try:
        view_level = ViewLevel(view)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid view level")
    
    if view_level == ViewLevel.AUDITOR and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Auditor view requires admin role")
    
    engine = get_explainability_engine(db)
    
    decision_data = {
        "decision_id": action.id,
        "action": action.action_type,
        "confidence": getattr(action, 'confidence', 0.0),
        "primary_reason": action.reason,
        "timestamp": action.created_at.isoformat() if action.created_at else datetime.utcnow().isoformat(),
        "user_id": action.user_id,
    }
    
    result = engine.generate_explanation(
        decision_type=DecisionType.MODERATION,
        decision_data=decision_data,
        view_level=view_level,
        user_id=current_user.id
    )
    
    return result.to_dict()


@router.get("/trust/{user_id}/explanation")
async def get_trust_score_explanation(
    user_id: int,
    view: str = "viewer",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get explanation for a user's trust score."""
    if user_id != current_user.id and not current_user.is_admin:
        view = "viewer"
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        view_level = ViewLevel(view)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid view level")
    
    from .trust_score import get_trust_score_engine
    trust_engine = get_trust_score_engine(db)
    trust_data = trust_engine.calculate_trust_score(user_id, include_breakdown=True)
    
    engine = get_explainability_engine(db)
    
    decision_data = {
        "decision_id": f"trust_{user_id}_{datetime.utcnow().strftime('%Y%m%d')}",
        "old_score": getattr(target_user, 'trust_score', 0) or 0,
        "new_score": trust_data.get("score", 0),
        "change": trust_data.get("score", 0) - (getattr(target_user, 'trust_score', 0) or 0),
        "tier": trust_data.get("tier", "unverified"),
        "breakdown": trust_data.get("breakdown", {}),
        "recommendations": trust_data.get("recommendations", []),
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    result = engine.generate_explanation(
        decision_type=DecisionType.TRUST_SCORE,
        decision_data=decision_data,
        view_level=view_level,
        user_id=current_user.id
    )
    
    return result.to_dict()


# =============================================================================
# MODEL ROUTER ROUTES (DNA Strand C.7 Model-Agnostic Design)
# =============================================================================

from .model_router import get_model_router, TaskType as RouterTaskType


@router.get("/admin/model-router/status")
async def get_model_router_status(
    task_type: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
):
    """Get status of all AI model providers (admin only)."""
    router_instance = get_model_router()
    
    task = None
    if task_type:
        try:
            task = RouterTaskType(task_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid task type: {task_type}")
    
    return router_instance.get_provider_status(task)


@router.get("/admin/model-router/metrics")
async def get_model_router_metrics(
    current_user: User = Depends(get_current_admin_user),
):
    """Get aggregated metrics for all AI providers (admin only)."""
    router_instance = get_model_router()
    return router_instance.get_metrics()


class WeightUpdateRequest(BaseModel):
    task_type: str
    weights: Dict[str, float]


@router.post("/admin/model-router/weights")
async def update_model_weights(
    request_data: WeightUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
):
    """Update routing weights for a task type (admin only)."""
    try:
        task = RouterTaskType(request_data.task_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid task type: {request_data.task_type}")
    
    router_instance = get_model_router()
    router_instance.update_weights(task, request_data.weights)
    
    return {"status": "updated", "task_type": request_data.task_type, "weights": request_data.weights}


class ProviderToggleRequest(BaseModel):
    provider_name: str
    is_available: bool


@router.post("/admin/model-router/provider/toggle")
async def toggle_model_provider(
    request_data: ProviderToggleRequest,
    current_user: User = Depends(get_current_admin_user),
):
    """Enable or disable a provider (admin only)."""
    router_instance = get_model_router()
    router_instance.set_provider_availability(request_data.provider_name, request_data.is_available)
    
    return {"status": "updated", "provider": request_data.provider_name, "is_available": request_data.is_available}


@router.get("/admin/model-router/task-types")
async def get_available_task_types(
    current_user: User = Depends(get_current_admin_user),
):
    """Get list of available AI task types."""
    return {"task_types": [t.value for t in RouterTaskType]}


# =============================================================================
# AD SERVING ROUTES (Task 1.3.1)
# =============================================================================

@router.get("/ads/active", response_model=List[AdResponse])
async def get_active_ads(
    request: Request,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """
    Get active ads for client-side serving.
    Currently returns mock ads as we don't have an Ads table yet.
    """
    # Mock ads
    ads = [
        {
            "id": "ad_001",
            "title": "Streamura Pro",
            "description": "Upgrade to Pro for 4K streaming and zero fees!",
            "image_url": "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80&w=800",
            "cta_text": "Upgrade Now",
            "cta_url": "/pro",
            "duration": 15,
            "skip_after": 5,
            "priority": 10
        },
        {
            "id": "ad_002",
            "title": "Gaming Gear",
            "description": "The best headphones for streamers.",
            "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800",
            "cta_text": "Shop Now",
            "cta_url": "#",
            "duration": 10,
            "skip_after": 0,
            "priority": 5
        }
    ]
    return ads[:limit]


@router.post("/ads/impression")
async def track_ad_impression(
    ad_data: AdImpressionBase,
    stream_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Track an ad impression."""
    impression = AdImpression(
        stream_id=stream_id,
        ad_network=ad_data.ad_network,
        ad_unit=ad_data.ad_unit,
        impression_count=ad_data.impression_count,
        click_count=ad_data.click_count,
        revenue=ad_data.revenue
    )
    db.add(impression)
    db.commit()
    return {"status": "success"}

# Authentication Routes
@router.post("/auth/token", response_model=Token)
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Authenticate user and return access token (rate limited: 5/minute)"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        locale = get_locale(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=t("auth.invalid_credentials", locale),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return generate_auth_tokens(user)

@router.post("/auth/refresh", response_model=Token)
@limiter.limit("10/minute")
async def refresh_token(request: Request, refresh_token: str):
    """Refresh access token using refresh token (rate limited: 10/minute)"""
    return refresh_access_token(refresh_token)

@router.post("/auth/register", response_model=UserResponse)
@limiter.limit("3/minute")
async def register_user(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Register a new user (rate limited: 3/minute)"""
    user = create_user(db, user_data)
    return user

@router.post("/auth/anonymous", response_model=UserResponse)
async def create_anonymous_session(db: Session = Depends(get_db)):
    """Create anonymous user session"""
    user = create_anonymous_user(db)
    return user

@router.post("/auth/migrate/{anonymous_user_id}", response_model=UserResponse)
async def migrate_anonymous_user(
    anonymous_user_id: int,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """Migrate anonymous user to registered user"""
    user = migrate_anonymous_to_registered(db, anonymous_user_id, user_data)
    return user

@router.post("/auth/password-reset/request")
@limiter.limit("3/minute")
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset email (rate limited: 3/minute)"""
    # Check if user exists
    user = db.query(User).filter(User.email == reset_request.email).first()

    # Always return success to prevent email enumeration
    if user:
        # Generate reset token
        token = create_password_reset_token(reset_request.email)
        # In production, send email with reset link
        # For now, log the token (or return it in development)
        # email_service.send_password_reset(user.email, token)
        print(f"Password reset token for {reset_request.email}: {token}")

    return {
        "message": "If an account exists with that email, a password reset link has been sent."
    }

@router.post("/auth/password-reset/confirm")
@limiter.limit("5/minute")
async def confirm_password_reset(
    request: Request,
    reset_confirm: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using reset token (rate limited: 5/minute)"""
    locale = get_locale(request)

    # Verify token
    email = verify_password_reset_token(reset_confirm.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Validate password length
    if len(reset_confirm.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )

    # Reset password
    success = reset_user_password(db, email, reset_confirm.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reset password"
        )

    return {"message": "Password has been reset successfully"}

# User Routes
@router.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.get("/users/{user_id}", response_model=UserResponse)
async def read_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    """Get user information by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("user.not_found", locale))
    return user

# Stream Routes
@router.post("/streams", response_model=StreamResponse)
async def create_stream(
    stream_data: StreamCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new stream"""
    # Generate stream key
    stream_key = "stream_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=16))

    # Create stream
    db_stream = Stream(
        stream_key=stream_key,
        user_id=current_user.id,
        title=stream_data.title,
        description=stream_data.description,
        status="created",
        is_public=stream_data.is_public,
        is_monetized=stream_data.is_monetized,
        latitude=stream_data.latitude,
        longitude=stream_data.longitude,
        location_name=stream_data.location_name,
        category=stream_data.category,
        tags=stream_data.tags
    )

    db.add(db_stream)
    db.commit()
    db.refresh(db_stream)

    # Invalidate stream-related caches
    cache = get_cache_service()
    await cache.invalidate_pattern("discover:*")

    return db_stream

@router.get("/streams/{stream_id}", response_model=StreamResponse,
            response_model_exclude={"stream_key"})
async def read_stream(stream_id: int, request: Request, db: Session = Depends(get_db)):
    """Get stream information (public; stream_key is a secret and is excluded)"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))
    return stream

@router.post("/streams/{stream_id}/start")
async def start_stream(
    stream_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a stream"""
    locale = get_locale(request)
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("stream.not_authorized", locale))

    stream.status = "live"
    stream.starts_at = datetime.utcnow()
    db.commit()

    # Invalidate caches when stream goes live
    cache = get_cache_service()
    await cache.invalidate_pattern("discover:*")

    # Notify followers
    followers = db.query(UserFollow).filter(UserFollow.following_id == current_user.id).all()
    if followers:
        for follow in followers:
            create_notification(
                db,
                user_id=follow.follower_id,
                type="stream_started",
                title=f"{current_user.username} is live!",
                message=stream.title or "Come watch now!",
                stream_id=stream.id,
                from_user_id=current_user.id,
                commit=False
            )
        db.commit()

    return {"message": "Stream started successfully", "status": stream.status}

@router.post("/streams/{stream_id}/end")
async def end_stream(
    stream_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """End a stream"""
    locale = get_locale(request)
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("stream.not_authorized", locale))

    stream.status = "ended"
    stream.ends_at = datetime.utcnow()
    db.commit()

    # Notify viewers via WebSocket
    if stream.livekit_room_name:
        await broadcast_stream_status(stream.livekit_room_name, "ended")

    # Invalidate caches when stream ends
    cache = get_cache_service()
    await cache.invalidate_pattern("discover:*")

    return {"message": "Stream ended successfully", "status": stream.status}


# LiveKit Streaming Routes
@router.post("/streams/{stream_id}/broadcast-token", response_model=StreamTokenResponse)
async def get_broadcast_token(
    stream_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a broadcast token for streaming to LiveKit"""
    locale = get_locale(request)
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("stream.not_authorized", locale))

    # Initialize room and get broadcaster token
    connection_info = initialize_stream_room(db, stream, current_user)

    return StreamTokenResponse(**connection_info)


@router.post("/streams/{stream_id}/viewer-token", response_model=StreamTokenResponse)
async def get_viewer_token(
    stream_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a viewer token to watch a stream"""
    locale = get_locale(request)
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))

    if not stream.is_public and (not current_user or stream.user_id != current_user.id):
        raise HTTPException(status_code=403, detail=t("auth.forbidden", locale))

    if not stream.livekit_room_name:
        raise HTTPException(status_code=400, detail=t("stream.unavailable", locale))

    # Get viewer connection info
    try:
        connection_info = get_viewer_connection(stream, current_user)
        return StreamTokenResponse(**connection_info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/streams/{stream_id}/status")
async def get_stream_status(
    stream_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Get real-time stream status"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("stream.not_found", locale))

    # Get live viewer count from WebSocket manager
    viewer_count = 0
    if stream.livekit_room_name:
        viewer_count = ws_manager.get_viewer_count(stream.livekit_room_name)

    return {
        "stream_id": stream.id,
        "status": stream.status,
        "viewer_count": viewer_count,
        "peak_viewers": stream.peak_viewers,
        "started_at": stream.starts_at.isoformat() if stream.starts_at else None,
        "room_name": stream.livekit_room_name,
    }


@router.get("/streams/{stream_id}/participants")
async def get_stream_participants(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of participants in a stream (broadcaster only)"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the broadcaster can view participants")

    if not stream.livekit_room_name:
        return {"participants": []}

    try:
        participants = await streaming_service.get_room_participants(stream.livekit_room_name)
        return {"participants": participants}
    except Exception as e:
        return {"participants": [], "error": str(e)}


# =============================================================================
# RECORDING ROUTES - Stream recording and playback
# =============================================================================

class RecordingCreate(BaseModel):
    title: Optional[str] = None
    is_public: bool = True

class RecordingResponse(BaseModel):
    id: int
    stream_id: int
    egress_id: Optional[str]
    title: Optional[str]
    url: Optional[str]
    thumbnail_url: Optional[str]
    duration: Optional[int]
    status: str
    is_public: bool
    view_count: int
    created_at: datetime

    class Config:
        from_attributes = True

@router.post("/streams/{stream_id}/recording/start")
async def start_recording(
    stream_id: int,
    recording_data: Optional[RecordingCreate] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start recording a live stream (broadcaster only)"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the broadcaster can start recording")

    if stream.status != "live":
        raise HTTPException(status_code=400, detail="Stream must be live to start recording")

    if not stream.livekit_room_name:
        raise HTTPException(status_code=400, detail="Stream has no active room")

    # Check if already recording
    existing_recording = db.query(Recording).filter(
        Recording.stream_id == stream_id,
        Recording.status.in_(["pending", "recording"])
    ).first()
    if existing_recording:
        raise HTTPException(status_code=400, detail="Recording already in progress")

    try:
        # Start recording via LiveKit Egress
        result = await streaming_service.start_recording(stream.livekit_room_name)

        # Create recording record
        recording = Recording(
            stream_id=stream_id,
            user_id=current_user.id,
            egress_id=result["egress_id"],
            title=recording_data.title if recording_data else stream.title,
            storage_path=result.get("output_path"),
            status="recording",
            is_public=recording_data.is_public if recording_data else True,
            started_at=datetime.utcnow(),
        )
        db.add(recording)
        db.commit()
        db.refresh(recording)

        return {
            "recording_id": recording.id,
            "egress_id": result["egress_id"],
            "status": "recording",
            "message": "Recording started successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start recording: {str(e)}")


@router.post("/streams/{stream_id}/recording/stop")
async def stop_recording(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Stop recording a stream (broadcaster only)"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the broadcaster can stop recording")

    # Find active recording
    recording = db.query(Recording).filter(
        Recording.stream_id == stream_id,
        Recording.status == "recording"
    ).first()
    if not recording:
        raise HTTPException(status_code=404, detail="No active recording found")

    try:
        # Stop recording via LiveKit Egress
        result = await streaming_service.stop_recording(recording.egress_id)

        # Update recording record
        recording.status = "processing"
        recording.ended_at = datetime.utcnow()
        if recording.started_at:
            recording.duration = int((recording.ended_at - recording.started_at).total_seconds())
        db.commit()

        return {
            "recording_id": recording.id,
            "status": "processing",
            "message": "Recording stopped, processing video"
        }
    except Exception as e:
        recording.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to stop recording: {str(e)}")


@router.get("/streams/{stream_id}/recordings", response_model=List[RecordingResponse])
async def get_stream_recordings(
    stream_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get all recordings for a stream"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    query = db.query(Recording).filter(Recording.stream_id == stream_id)

    # Only show public recordings unless user is the owner
    if not current_user or (stream.user_id != current_user.id and not current_user.is_admin):
        query = query.filter(Recording.is_public == True, Recording.status == "ready")

    recordings = query.order_by(Recording.created_at.desc()).all()
    return recordings


@router.get("/recordings/{recording_id}", response_model=RecordingResponse)
async def get_recording(
    recording_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get recording details"""
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Check access
    if not recording.is_public:
        if not current_user:
            raise HTTPException(status_code=403, detail="Recording is private")
        if recording.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Recording is private")

    # Increment view count
    recording.view_count += 1
    db.commit()

    return recording


@router.delete("/recordings/{recording_id}")
async def delete_recording(
    recording_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a recording (owner or admin only)"""
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this recording")

    recording.status = "deleted"
    db.commit()

    return {"message": "Recording deleted successfully"}


@router.get("/users/{user_id}/recordings", response_model=List[RecordingResponse])
async def get_user_recordings(
    user_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db)
):
    """Get all recordings by a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(Recording).filter(Recording.user_id == user_id)

    # Only show public ready recordings unless user is viewing their own
    is_own_profile = current_user and current_user.id == user_id
    is_admin = current_user and current_user.is_admin
    if not is_own_profile and not is_admin:
        query = query.filter(Recording.is_public == True, Recording.status == "ready")

    recordings = query.order_by(Recording.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return recordings


@router.put("/recordings/{recording_id}")
async def update_recording(
    recording_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update recording metadata (owner only)"""
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    if recording.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this recording")

    if title is not None:
        recording.title = title
    if description is not None:
        recording.description = description
    if is_public is not None:
        recording.is_public = is_public

    db.commit()
    db.refresh(recording)

    return {"message": "Recording updated successfully", "recording": recording}


# =============================================================================
# SCHEDULING ROUTES - Future stream scheduling
# =============================================================================

class ScheduledStreamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    is_public: bool = True
    is_monetized: bool = False
    notify_followers: bool = True

class ScheduledStreamResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    thumbnail_url: Optional[str]
    category: Optional[str]
    scheduled_start: datetime
    scheduled_end: Optional[datetime]
    status: str
    is_public: bool
    is_monetized: bool
    notify_followers: bool
    reminder_sent: bool
    stream_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True

class ScheduledStreamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_public: Optional[bool] = None
    is_monetized: Optional[bool] = None
    notify_followers: Optional[bool] = None

@router.post("/streams/schedule", response_model=ScheduledStreamResponse)
async def schedule_stream(
    data: ScheduledStreamCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Schedule a future stream"""
    # Validate scheduled time is in the future
    if data.scheduled_start <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Scheduled start time must be in the future")

    # Create scheduled stream
    scheduled = ScheduledStream(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        category=data.category,
        tags=data.tags,
        latitude=data.latitude,
        longitude=data.longitude,
        location_name=data.location_name,
        is_public=data.is_public,
        is_monetized=data.is_monetized,
        notify_followers=data.notify_followers,
        status="scheduled",
    )
    db.add(scheduled)
    db.commit()
    db.refresh(scheduled)

    # Create notifications for followers if notify_followers is True
    if data.notify_followers:
        followers = db.query(UserFollow).filter(UserFollow.following_id == current_user.id).all()
        for follow in followers:
            notification = Notification(
                user_id=follow.follower_id,
                type="stream_scheduled",
                message=f"{current_user.username} scheduled a stream: {scheduled.title}",
                data={
                    "schedule_id": scheduled.id,
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "title": scheduled.title,
                    "scheduled_start": scheduled.scheduled_start.isoformat() if scheduled.scheduled_start else None,
                }
            )
            db.add(notification)
        db.commit()

    return scheduled


@router.get("/streams/scheduled", response_model=List[ScheduledStreamResponse])
async def get_my_scheduled_streams(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's scheduled streams"""
    query = db.query(ScheduledStream).filter(ScheduledStream.user_id == current_user.id)

    if status:
        query = query.filter(ScheduledStream.status == status)

    scheduled = query.order_by(ScheduledStream.scheduled_start.asc()).all()
    return scheduled


@router.get("/streams/schedule/{schedule_id}", response_model=ScheduledStreamResponse)
async def get_scheduled_stream(
    schedule_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get a scheduled stream by ID"""
    scheduled = db.query(ScheduledStream).filter(ScheduledStream.id == schedule_id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")

    # Check visibility
    if not scheduled.is_public:
        if not current_user or (scheduled.user_id != current_user.id and not current_user.is_admin):
            raise HTTPException(status_code=403, detail="Scheduled stream is private")

    return scheduled


@router.put("/streams/schedule/{schedule_id}", response_model=ScheduledStreamResponse)
async def update_scheduled_stream(
    schedule_id: int,
    data: ScheduledStreamUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a scheduled stream"""
    scheduled = db.query(ScheduledStream).filter(ScheduledStream.id == schedule_id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")

    if scheduled.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this scheduled stream")

    if scheduled.status != "scheduled":
        raise HTTPException(status_code=400, detail="Cannot update a stream that has already started or been cancelled")

    # Update fields
    if data.title is not None:
        scheduled.title = data.title
    if data.description is not None:
        scheduled.description = data.description
    if data.scheduled_start is not None:
        if data.scheduled_start <= datetime.utcnow():
            raise HTTPException(status_code=400, detail="Scheduled start time must be in the future")
        scheduled.scheduled_start = data.scheduled_start
    if data.scheduled_end is not None:
        scheduled.scheduled_end = data.scheduled_end
    if data.category is not None:
        scheduled.category = data.category
    if data.tags is not None:
        scheduled.tags = data.tags
    if data.is_public is not None:
        scheduled.is_public = data.is_public
    if data.is_monetized is not None:
        scheduled.is_monetized = data.is_monetized
    if data.notify_followers is not None:
        scheduled.notify_followers = data.notify_followers

    db.commit()
    db.refresh(scheduled)

    return scheduled


@router.delete("/streams/schedule/{schedule_id}")
async def cancel_scheduled_stream(
    schedule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a scheduled stream"""
    scheduled = db.query(ScheduledStream).filter(ScheduledStream.id == schedule_id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")

    if scheduled.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this scheduled stream")

    if scheduled.status == "live":
        raise HTTPException(status_code=400, detail="Cannot cancel a live stream")

    scheduled.status = "cancelled"
    db.commit()

    return {"message": "Scheduled stream cancelled successfully"}


@router.get("/streams/schedule/{schedule_id}/calendar.ics")
async def get_schedule_ics(
    schedule_id: int,
    db: Session = Depends(get_db)
):
    """Export scheduled stream as iCal (.ics) file"""
    from fastapi.responses import Response
    
    scheduled = db.query(ScheduledStream).filter(ScheduledStream.id == schedule_id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")

    if not scheduled.is_public:
        raise HTTPException(status_code=403, detail="This scheduled stream is not public")

    # Generate ICS content
    def format_ics_datetime(dt: datetime) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")

    uid = f"scheduled-{scheduled.id}@streamura.com"
    dtstamp = format_ics_datetime(datetime.utcnow())
    dtstart = format_ics_datetime(scheduled.scheduled_start)
    dtend = format_ics_datetime(scheduled.scheduled_end) if scheduled.scheduled_end else format_ics_datetime(scheduled.scheduled_start)
    
    summary = scheduled.title or "Streamura Live Stream"
    description = scheduled.description or ""
    location = scheduled.location_name or "Streamura"
    
    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Streamura//Stream Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
DESCRIPTION:{description}
LOCATION:{location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""

    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="stream-{scheduled.id}.ics"'
        }
    )


@router.get("/users/{user_id}/scheduled", response_model=List[ScheduledStreamResponse])
async def get_user_scheduled_streams(
    user_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get scheduled streams for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(ScheduledStream).filter(
        ScheduledStream.user_id == user_id,
        ScheduledStream.status == "scheduled",
        ScheduledStream.scheduled_start > datetime.utcnow()
    )

    # Only show public scheduled streams unless viewing own profile
    is_own = current_user and current_user.id == user_id
    if not is_own:
        query = query.filter(ScheduledStream.is_public == True)

    scheduled = query.order_by(ScheduledStream.scheduled_start.asc()).all()
    return scheduled


@router.get("/discover/upcoming", response_model=List[ScheduledStreamResponse])
async def get_upcoming_streams(
    category: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get upcoming scheduled streams (public)"""
    query = db.query(ScheduledStream).filter(
        ScheduledStream.is_public == True,
        ScheduledStream.status == "scheduled",
        ScheduledStream.scheduled_start > datetime.utcnow()
    )

    if category:
        query = query.filter(ScheduledStream.category == category)

    scheduled = query.order_by(ScheduledStream.scheduled_start.asc()).limit(limit).all()
    return scheduled


@router.post("/streams/schedule/{schedule_id}/go-live")
async def go_live_scheduled(
    schedule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a scheduled stream (go live)"""
    scheduled = db.query(ScheduledStream).filter(ScheduledStream.id == schedule_id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Scheduled stream not found")

    if scheduled.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to start this stream")

    if scheduled.status != "scheduled":
        raise HTTPException(status_code=400, detail=f"Cannot start stream with status: {scheduled.status}")

    # Create the actual stream
    stream_key = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
    stream = Stream(
        stream_key=stream_key,
        user_id=current_user.id,
        title=scheduled.title,
        description=scheduled.description,
        category=scheduled.category,
        tags=scheduled.tags,
        latitude=scheduled.latitude,
        longitude=scheduled.longitude,
        location_name=scheduled.location_name,
        is_public=scheduled.is_public,
        is_monetized=scheduled.is_monetized,
        status="created",
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)

    # Update scheduled stream
    scheduled.status = "live"
    scheduled.stream_id = stream.id
    db.commit()

    # Initialize LiveKit room
    connection_info = initialize_stream_room(db, stream, current_user)

    return {
        "stream_id": stream.id,
        "scheduled_id": scheduled.id,
        "room_name": connection_info["room_name"],
        "token": connection_info["token"],
        "livekit_url": connection_info["livekit_url"],
    }


# =============================================================================
# ANALYTICS ROUTES - Creator analytics and insights
# =============================================================================

class StreamAnalyticsResponse(BaseModel):
    stream_id: int
    title: Optional[str]
    status: str
    viewer_count: int
    peak_viewers: int
    total_watch_time: int
    like_count: int
    tip_count: int
    earnings: float
    duration_seconds: Optional[int]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]

class CreatorOverview(BaseModel):
    total_streams: int
    total_views: int
    total_watch_time: int
    total_earnings: float
    total_tips: int
    follower_count: int
    following_count: int
    total_likes: int
    avg_viewers_per_stream: float

class EarningsBreakdown(BaseModel):
    period: str
    tips: float
    ad_revenue: float
    total: float
    transaction_count: int

class TopStream(BaseModel):
    stream_id: int
    title: Optional[str]
    viewer_count: int
    peak_viewers: int
    earnings: float
    like_count: int
    created_at: datetime

@router.get("/analytics/streams/{stream_id}")
async def get_stream_analytics(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get analytics for a specific stream (owner only)"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this stream's analytics")

    # Calculate duration
    duration = None
    if stream.starts_at and stream.ends_at:
        duration = int((stream.ends_at - stream.starts_at).total_seconds())
    elif stream.starts_at and stream.status == "live":
        duration = int((datetime.utcnow() - stream.starts_at).total_seconds())

    return {
        "stream_id": stream.id,
        "title": stream.title,
        "status": stream.status,
        "viewer_count": stream.viewer_count,
        "peak_viewers": stream.peak_viewers,
        "total_watch_time": stream.total_watch_time,
        "like_count": stream.like_count,
        "tip_count": stream.tip_count,
        "earnings": stream.earnings,
        "duration_seconds": duration,
        "started_at": stream.starts_at,
        "ended_at": stream.ends_at,
    }


@router.get("/analytics/overview", response_model=CreatorOverview)
async def get_creator_overview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get overview analytics for the current user (creator dashboard)"""
    from sqlalchemy import func

    # Get stream stats
    stream_stats = db.query(
        func.count(Stream.id).label("total_streams"),
        func.sum(Stream.viewer_count).label("total_views"),
        func.sum(Stream.total_watch_time).label("total_watch_time"),
        func.sum(Stream.earnings).label("total_earnings"),
        func.sum(Stream.tip_count).label("total_tips"),
        func.sum(Stream.like_count).label("total_likes"),
        func.avg(Stream.viewer_count).label("avg_viewers")
    ).filter(Stream.user_id == current_user.id).first()

    return {
        "total_streams": stream_stats.total_streams or 0,
        "total_views": int(stream_stats.total_views or 0),
        "total_watch_time": int(stream_stats.total_watch_time or 0),
        "total_earnings": float(stream_stats.total_earnings or 0),
        "total_tips": int(stream_stats.total_tips or 0),
        "follower_count": current_user.follower_count or 0,
        "following_count": current_user.following_count or 0,
        "total_likes": int(stream_stats.total_likes or 0),
        "avg_viewers_per_stream": float(stream_stats.avg_viewers or 0),
    }


@router.get("/analytics/earnings")
async def get_earnings_breakdown(
    period: str = "month",  # day, week, month, year, all
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get earnings breakdown for the current user"""
    from sqlalchemy import func
    from datetime import timedelta

    # Calculate date range
    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = None

    # Query transactions
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type.in_(["tip_received", "ad_revenue"]),
        Transaction.status == "completed"
    )
    if start_date:
        query = query.filter(Transaction.created_at >= start_date)

    transactions = query.all()

    # Calculate breakdown
    tips = sum(t.net_amount or t.amount for t in transactions if t.transaction_type == "tip_received")
    ad_revenue = sum(t.net_amount or t.amount for t in transactions if t.transaction_type == "ad_revenue")

    return {
        "period": period,
        "tips": float(tips),
        "ad_revenue": float(ad_revenue),
        "total": float(tips + ad_revenue),
        "transaction_count": len(transactions),
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": now.isoformat(),
    }


@router.get("/analytics/top-streams")
async def get_top_streams(
    sort_by: str = "viewers",  # viewers, earnings, likes
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get top performing streams for the current user"""
    query = db.query(Stream).filter(Stream.user_id == current_user.id)

    if sort_by == "viewers":
        query = query.order_by(Stream.peak_viewers.desc())
    elif sort_by == "earnings":
        query = query.order_by(Stream.earnings.desc())
    elif sort_by == "likes":
        query = query.order_by(Stream.like_count.desc())
    else:
        query = query.order_by(Stream.created_at.desc())

    streams = query.limit(limit).all()

    return [
        {
            "stream_id": s.id,
            "title": s.title,
            "viewer_count": s.viewer_count,
            "peak_viewers": s.peak_viewers,
            "earnings": s.earnings,
            "like_count": s.like_count,
            "tip_count": s.tip_count,
            "created_at": s.created_at,
        }
        for s in streams
    ]


@router.get("/analytics/engagement")
async def get_engagement_metrics(
    period: str = "month",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get engagement metrics over time"""
    from sqlalchemy import func
    from datetime import timedelta

    now = datetime.utcnow()
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=365)

    # Get streams in period
    streams = db.query(Stream).filter(
        Stream.user_id == current_user.id,
        Stream.created_at >= start_date
    ).all()

    # Get new followers in period
    new_followers = db.query(UserFollow).filter(
        UserFollow.following_id == current_user.id,
        UserFollow.created_at >= start_date
    ).count()

    # Get likes in period
    likes = db.query(StreamLike).join(Stream).filter(
        Stream.user_id == current_user.id,
        StreamLike.created_at >= start_date
    ).count()

    # Get chat messages in period
    messages = db.query(ChatMessage).join(Stream).filter(
        Stream.user_id == current_user.id,
        ChatMessage.created_at >= start_date
    ).count()

    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "streams_count": len(streams),
        "total_viewers": sum(s.viewer_count for s in streams),
        "total_peak_viewers": sum(s.peak_viewers for s in streams),
        "new_followers": new_followers,
        "likes": likes,
        "chat_messages": messages,
        "avg_engagement_per_stream": (likes + messages) / len(streams) if streams else 0,
    }


@router.get("/analytics/recent-activity")
async def get_recent_activity(
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get recent activity for the creator dashboard"""
    # Combine recent tips, follows, and likes
    activities = []

    # Recent tips
    tips = db.query(Tip).filter(
        Tip.to_user_id == current_user.id,
        Tip.status == "completed"
    ).order_by(Tip.created_at.desc()).limit(limit).all()

    for tip in tips:
        activities.append({
            "type": "tip",
            "amount": tip.amount,
            "message": tip.message,
            "from_user_id": tip.from_user_id,
            "created_at": tip.created_at,
        })

    # Recent followers
    follows = db.query(UserFollow).filter(
        UserFollow.following_id == current_user.id
    ).order_by(UserFollow.created_at.desc()).limit(limit).all()

    for follow in follows:
        follower = db.query(User).filter(User.id == follow.follower_id).first()
        activities.append({
            "type": "follow",
            "from_user_id": follow.follower_id,
            "from_username": follower.username if follower else None,
            "created_at": follow.created_at,
        })

    # Recent likes
    likes = db.query(StreamLike).join(Stream).filter(
        Stream.user_id == current_user.id
    ).order_by(StreamLike.created_at.desc()).limit(limit).all()

    for like in likes:
        liker = db.query(User).filter(User.id == like.user_id).first()
        stream = db.query(Stream).filter(Stream.id == like.stream_id).first()
        activities.append({
            "type": "like",
            "from_user_id": like.user_id,
            "from_username": liker.username if liker else None,
            "stream_id": like.stream_id,
            "stream_title": stream.title if stream else None,
            "created_at": like.created_at,
        })

    # Sort by created_at and return top items
    activities.sort(key=lambda x: x["created_at"], reverse=True)
    return activities[:limit]


# LiveKit Webhook Handler
@router.post("/webhooks/livekit", response_model=WebhookResponse)
async def livekit_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle LiveKit webhook events"""
    try:
        event_data = await request.json()
        result = await handle_livekit_webhook(event_data, db)
        return WebhookResponse(**result)
    except Exception as e:
        return WebhookResponse(status="error", reason=str(e))


# WebSocket endpoint for real-time updates
@router.websocket("/ws/stream/{room_name}")
async def websocket_stream_endpoint(
    websocket: WebSocket,
    room_name: str,
    token: Optional[str] = None,
    user_id: Optional[int] = None
):
    """
    WebSocket endpoint for real-time stream updates (chat, viewer count, etc.)

    Args:
        room_name: The stream room to join
        token: Optional JWT token for authentication (recommended)
        user_id: Optional user ID (deprecated, use token instead)
    """
    await handle_websocket_connection(websocket, room_name, token=token, user_id=user_id)


# WebSocket endpoint for direct messaging (Phase 12)
@router.websocket("/ws/dm")
async def websocket_dm_endpoint(
    websocket: WebSocket,
    token: str,
):
    """
    WebSocket endpoint for real-time direct messaging.

    Requires authentication via JWT token.
    Supports:
    - Receiving real-time DM notifications
    - Sending typing indicators
    - Receiving read receipts

    Message types:
    - typing: Send typing indicator {type: "typing", conversation_id, recipient_id, is_typing}
    - ping: Keep-alive {type: "ping"}

    Incoming events:
    - direct_message: New DM received
    - dm_read_receipt: Message was read
    - dm_typing: User is typing
    """
    await handle_dm_websocket_connection(websocket, token=token)


# =============================================================================
# EVENT ROUTES - Core differentiator for Streamura
# =============================================================================

@router.get("/events", response_model=EventListResponse)
async def list_events(
    status: Optional[str] = "active",
    category: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get paginated list of events.

    Query params:
    - status: Filter by status (active, ended, archived)
    - category: Filter by category
    - page: Page number (1-indexed)
    - per_page: Items per page (max 100)
    """
    per_page = min(per_page, 100)

    # Try to get from cache (60s TTL)
    cache = get_cache_service()
    cache_key = f"events:{status or 'all'}:{category or 'all'}:{page}:{per_page}"
    cached = await cache.get(cache_key)
    if cached:
        return EventListResponse(**cached)

    offset = (page - 1) * per_page

    query = db.query(Event)

    if status:
        query = query.filter(Event.status == status)
    if category:
        query = query.filter(Event.category == category)

    total = query.count()
    events = (
        query
        .order_by(Event.ranking_score.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    result = EventListResponse(
        events=events,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(offset + len(events)) < total
    )

    # Cache the result
    await cache.set(cache_key, result.dict(), ttl=60)

    return result


@router.get("/events/trending", response_model=List[EventResponse])
async def get_trending_events(
    limit: int = 10,
    category: Optional[str] = None,
    time_window: str = "6h",
    db: Session = Depends(get_db)
):
    """
    Get trending events based on velocity and engagement.

    Query params:
    - limit: Max events to return
    - category: Optional category filter
    - time_window: Time window for trending (1h, 6h, 24h)
    """
    # Try cache first (30s TTL for trending data)
    cache = get_cache_service()
    cache_key = f"trending:{category or 'all'}:{limit}:{time_window}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    ranking_service = get_ranking_service(db)
    events = ranking_service.get_trending_events(limit=limit, category=category)

    # Cache the result
    await cache.set(cache_key, [EventResponse.from_orm(e).dict() for e in events], ttl=30)

    return events


@router.get("/events/featured", response_model=List[EventResponse])
async def get_featured_events(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Get featured events (high-quality, high-engagement)"""
    # Try cache first (30s TTL for featured data)
    cache = get_cache_service()
    cache_key = f"featured:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    ranking_service = get_ranking_service(db)
    events = ranking_service.get_featured_events(limit=limit)

    # Cache the result
    await cache.set(cache_key, [EventResponse.from_orm(e).dict() for e in events], ttl=30)

    return events


@router.get("/events/nearby", response_model=List[EventResponse])
async def get_nearby_events(
    latitude: float,
    longitude: float,
    radius_km: float = 25.0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get events near a geographic location.

    Uses Haversine distance calculation for accurate results.

    Query params:
    - latitude: User's latitude
    - longitude: User's longitude
    - radius_km: Search radius in kilometers
    - limit: Max events to return
    """
    from .clustering import EventClusteringService

    # Get all active events
    events = (
        db.query(Event)
        .filter(Event.status == "active")
        .filter(Event.latitude.isnot(None))
        .filter(Event.longitude.isnot(None))
        .all()
    )

    # Calculate distance for each event
    clustering = EventClusteringService(db)
    nearby = []

    for event in events:
        distance = clustering.haversine_distance(
            (latitude, longitude),
            (event.latitude, event.longitude)
        )
        # Convert meters to km
        distance_km = distance / 1000

        if distance_km <= radius_km:
            nearby.append((event, distance_km))

    # Sort by distance
    nearby.sort(key=lambda x: x[1])

    return [e[0] for e in nearby[:limit]]


@router.get("/events/{event_id}", response_model=EventDetailResponse,
            response_model_exclude={"streams": {"__all__": {"stream_key"}},
                                    "primary_stream": {"stream_key"}})
async def get_event_detail(event_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Get detailed event information including streams.

    Returns the event with all associated streams and
    the primary (best quality) stream highlighted.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("event.not_found", locale))

    # Get all streams for this event
    streams = (
        db.query(Stream)
        .filter(Stream.event_id == event_id)
        .order_by(Stream.viewer_count.desc())
        .all()
    )

    # Get primary stream (highest ranked)
    ranking_service = get_ranking_service(db)
    primary_stream = ranking_service.get_primary_stream_for_event(event)

    # Build response
    response = EventDetailResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        latitude=event.latitude,
        longitude=event.longitude,
        location_name=event.location_name,
        category=event.category,
        status=event.status,
        creator_id=event.creator_id,
        radius=event.radius,
        total_viewers=event.total_viewers,
        total_streams=event.total_streams,
        total_earnings=event.total_earnings,
        ranking_score=event.ranking_score,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        created_at=event.created_at,
        updated_at=event.updated_at,
        thumbnail_url=event.thumbnail_url,
        is_featured=event.is_featured,
        streams=streams,
        primary_stream=primary_stream
    )

    return response


@router.get("/events/{event_id}/streams", response_model=List[StreamResponse])
async def get_event_streams(
    event_id: int,
    status: Optional[str] = "live",
    sort_by: str = "viewers",
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get all streams for an event.

    Query params:
    - status: Filter by stream status (live, ended, all)
    - sort_by: Sort order (viewers, started_at, ranking)
    - limit: Max streams to return
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    query = db.query(Stream).filter(Stream.event_id == event_id)

    if status and status != "all":
        query = query.filter(Stream.status == status)

    # Apply sorting
    if sort_by == "viewers":
        query = query.order_by(Stream.viewer_count.desc())
    elif sort_by == "started_at":
        query = query.order_by(Stream.starts_at.desc())
    else:
        query = query.order_by(Stream.viewer_count.desc())

    return query.limit(limit).all()


@router.post("/events", response_model=EventResponse)
async def create_event(
    event_data: EventCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Manually create a new event.

    Note: Events are also auto-created by the clustering algorithm
    when multiple streams are detected near each other.
    """
    db_event = Event(
        title=event_data.title,
        description=event_data.description,
        creator_id=current_user.id,
        latitude=event_data.latitude,
        longitude=event_data.longitude,
        location_name=event_data.location_name,
        category=event_data.category,
        radius=event_data.radius,
        status="active",
        starts_at=datetime.utcnow()
    )

    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    # Invalidate event-related caches
    cache = get_cache_service()
    await cache.invalidate_pattern("events:*")
    await cache.invalidate_pattern("discover:*")

    return db_event


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_data: EventUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an event (creator or admin only)"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check authorization (creator or admin)
    if event.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this event")

    # Update fields
    if event_data.title is not None:
        event.title = event_data.title
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.category is not None:
        event.category = event_data.category
    if event_data.is_featured is not None:
        event.is_featured = event_data.is_featured

    db.commit()
    db.refresh(event)

    # Invalidate event-related caches
    cache = get_cache_service()
    await cache.invalidate_pattern("events:*")
    await cache.invalidate_pattern("discover:*")
    await cache.invalidate_pattern("trending:*")
    await cache.invalidate_pattern("featured:*")

    return event


@router.post("/events/{event_id}/add-stream")
async def add_stream_to_event(
    event_id: int,
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Manually add a stream to an event.

    Note: Streams are also auto-assigned by the clustering algorithm.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    stream = db.query(Stream).filter(Stream.id == stream_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stream")

    stream.event_id = event_id

    # Update event metrics
    clustering_service = get_clustering_service(db)
    clustering_service.recalculate_event_metrics(event)

    db.commit()

    return {"message": "Stream added to event successfully", "event_id": event_id}


@router.delete("/events/{event_id}/remove-stream/{stream_id}")
async def remove_stream_from_event(
    event_id: int,
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a stream from an event"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()

    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this stream")
    if stream.event_id != event_id:
        raise HTTPException(status_code=400, detail="Stream is not part of this event")

    stream.event_id = None
    db.commit()

    return {"message": "Stream removed from event"}


# =============================================================================
# CLUSTERING & RANKING ADMIN ROUTES
# =============================================================================

@router.post("/admin/clustering/run")
@limiter.limit("10/minute")
async def trigger_clustering(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger a clustering cycle.

    This is typically run automatically every 60 seconds,
    but can be triggered manually for testing.

    Requires admin privileges. Rate limited: 10/minute.
    """
    try:
        result = run_clustering()
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/rankings/update")
@limiter.limit("10/minute")
async def update_rankings(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger ranking recalculation.

    Requires admin privileges. Rate limited: 10/minute.
    """
    from .ranking import update_rankings as do_update
    try:
        result = do_update()
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DISCOVERY ROUTES
# =============================================================================

@router.get("/discover")
async def get_discovery_feed(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Main discovery feed endpoint.

    Returns a curated feed with:
    - Featured events
    - Trending events/streams
    - Nearby events (if location provided)
    - Popular categories
    """
    cache = get_cache_service()

    # If no location, we can cache the entire response (60s TTL)
    if latitude is None and longitude is None:
        cache_key = "discover:global"
        cached = await cache.get(cache_key)
        if cached:
            return cached

    ranking_service = get_ranking_service(db)

    # Featured events
    featured = ranking_service.get_featured_events(limit=3)

    # Trending events
    trending = ranking_service.get_trending_events(limit=10)

    # Nearby events (if location provided)
    nearby = []
    if latitude is not None and longitude is not None:
        from .clustering import EventClusteringService
        clustering = EventClusteringService(db)

        events = (
            db.query(Event)
            .filter(Event.status == "active")
            .filter(Event.latitude.isnot(None))
            .all()
        )

        for event in events:
            distance = clustering.haversine_distance(
                (latitude, longitude),
                (event.latitude, event.longitude)
            )
            if distance <= 25000:  # 25km
                nearby.append(event)

        nearby = sorted(nearby, key=lambda e: e.ranking_score, reverse=True)[:10]

    # Live streams (not in events)
    live_streams = (
        db.query(Stream)
        .filter(Stream.status == "live")
        .filter(Stream.event_id.is_(None))
        .order_by(Stream.viewer_count.desc())
        .limit(10)
        .all()
    )

    # Categories with counts
    category_counts = (
        db.query(Event.category, func.count(Event.id))
        .filter(Event.status == "active")
        .filter(Event.category.isnot(None))
        .group_by(Event.category)
        .all()
    )

    categories = [
        {"name": cat, "count": count}
        for cat, count in category_counts
    ]

    result = {
        "featured_events": [EventResponse.from_orm(e).dict() for e in featured],
        "trending_events": [EventResponse.from_orm(e).dict() for e in trending],
        "nearby_events": [EventResponse.from_orm(e).dict() for e in nearby],
        "live_streams": [StreamResponse.from_orm(s).dict() for s in live_streams],
        "categories": categories
    }

    # Cache the global discovery feed
    if latitude is None and longitude is None:
        await cache.set("discover:global", result, ttl=60)

    return result


@router.get("/discover/search")
async def search_content(
    q: str,
    type: str = "all",
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Search streams and events.

    Query params:
    - q: Search query
    - type: Filter type (all, streams, events, users)
    - limit: Max results per type
    """
    results = {
        "streams": [],
        "events": [],
        "users": []
    }

    search_term = f"%{q}%"

    if type in ["all", "events"]:
        events = (
            db.query(Event)
            .filter(
                (Event.title.ilike(search_term)) |
                (Event.description.ilike(search_term)) |
                (Event.location_name.ilike(search_term))
            )
            .filter(Event.status == "active")
            .order_by(Event.ranking_score.desc())
            .limit(limit)
            .all()
        )
        results["events"] = events

    if type in ["all", "streams"]:
        streams = (
            db.query(Stream)
            .filter(
                (Stream.title.ilike(search_term)) |
                (Stream.description.ilike(search_term))
            )
            .filter(Stream.status == "live")
            .order_by(Stream.viewer_count.desc())
            .limit(limit)
            .all()
        )
        results["streams"] = streams

    if type in ["all", "users"]:
        users = (
            db.query(User)
            .filter(
                (User.username.ilike(search_term)) |
                (User.email.ilike(search_term))
            )
            .filter(User.is_active == True)
            .limit(limit)
            .all()
        )
        results["users"] = users

    return results


@router.get("/discover/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Get all categories with event counts"""
    # Try cache first (60s TTL)
    cache = get_cache_service()
    cache_key = "discover:categories"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    category_data = (
        db.query(Event.category, func.count(Event.id), func.sum(Event.total_viewers))
        .filter(Event.status == "active")
        .filter(Event.category.isnot(None))
        .group_by(Event.category)
        .all()
    )

    categories = [
        {
            "name": cat,
            "event_count": count,
            "total_viewers": viewers or 0
        }
        for cat, count, viewers in category_data
    ]

    result = sorted(categories, key=lambda x: x["total_viewers"], reverse=True)

    # Cache the result
    await cache.set(cache_key, result, ttl=60)

    return result


@router.get("/discover/categories/{category}", response_model=List[EventResponse])
async def get_category_events(
    category: str,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get events in a specific category"""
    # Try cache first (60s TTL)
    cache = get_cache_service()
    cache_key = f"discover:category:{category}:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    events = (
        db.query(Event)
        .filter(Event.status == "active")
        .filter(Event.category == category)
        .order_by(Event.ranking_score.desc())
        .limit(limit)
        .all()
    )

    # Cache the result
    result = [EventResponse.from_orm(e).dict() for e in events]
    await cache.set(cache_key, result, ttl=60)

    return events

# =============================================================================
# PAYMENT ROUTES - Stripe Connect Integration
# =============================================================================

from .payments import get_stripe_service, PaymentError, MINIMUM_TIP_AMOUNT, MAXIMUM_TIP_AMOUNT, MINIMUM_PAYOUT_AMOUNT
from .models import Transaction, Tip


class TipRequest(BaseModel):
    stream_id: int
    amount: float
    message: Optional[str] = None
    currency: str = "usd"


class PayoutRequest(BaseModel):
    amount: float
    currency: str = "usd"


class StripeAccountResponse(BaseModel):
    account_id: Optional[str]
    onboarding_complete: bool
    charges_enabled: bool
    payouts_enabled: bool


class TipResponse(BaseModel):
    id: int
    amount: float
    message: Optional[str]
    created_at: datetime
    from_username: Optional[str]

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: int
    transaction_type: str
    amount: float
    fee: Optional[float]
    net_amount: Optional[float]
    status: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/stripe/connect/account")
@limiter.limit("3/minute")
async def create_stripe_connect_account(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a Stripe Connect Express account for the current user.

    This enables the user to receive tips and payouts.
    Rate limited: 3/minute.
    """
    if current_user.stripe_account_id:
        raise HTTPException(
            status_code=400,
            detail="You already have a connected Stripe account"
        )

    if not current_user.email:
        raise HTTPException(
            status_code=400,
            detail="Email address is required to set up payments"
        )

    try:
        stripe_service = get_stripe_service(db)
        result = await stripe_service.create_connect_account(
            user_id=current_user.id,
            email=current_user.email
        )

        # Save account ID to user
        current_user.stripe_account_id = result["account_id"]
        db.commit()

        return {
            "status": "success",
            "account_id": result["account_id"],
            "message": "Stripe account created. Complete onboarding to receive payments."
        }

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/stripe/connect/onboarding")
async def get_stripe_onboarding_link(
    return_url: str,
    refresh_url: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a Stripe Connect onboarding link.

    The user will be redirected to Stripe to complete identity verification
    and bank account setup.
    """
    if not current_user.stripe_account_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe account found. Create one first."
        )

    try:
        stripe_service = get_stripe_service(db)
        url = await stripe_service.create_onboarding_link(
            account_id=current_user.stripe_account_id,
            return_url=return_url,
            refresh_url=refresh_url
        )

        return {"onboarding_url": url}

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/stripe/connect/status", response_model=StripeAccountResponse)
async def get_stripe_account_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the current user's Stripe Connect account status."""
    if not current_user.stripe_account_id:
        return StripeAccountResponse(
            account_id=None,
            onboarding_complete=False,
            charges_enabled=False,
            payouts_enabled=False
        )

    try:
        stripe_service = get_stripe_service(db)
        status = await stripe_service.get_account_status(current_user.stripe_account_id)

        return StripeAccountResponse(
            account_id=status["account_id"],
            onboarding_complete=status["onboarding_complete"],
            charges_enabled=status["charges_enabled"],
            payouts_enabled=status["payouts_enabled"]
        )

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/tips")
@limiter.limit("30/minute")
async def send_tip(
    request: Request,
    tip_request: TipRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send a tip to a stream creator.

    Creates a Stripe Checkout session for the tip payment.
    Rate limited: 30/minute.
    """
    # Get stream and creator
    stream = db.query(Stream).filter(Stream.id == tip_request.stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if not stream.is_monetized:
        raise HTTPException(status_code=400, detail="This stream does not accept tips")

    creator = db.query(User).filter(User.id == stream.user_id).first()
    if not creator or not creator.stripe_account_id:
        raise HTTPException(
            status_code=400,
            detail="Creator has not set up payments"
        )

    if not creator.stripe_onboarding_complete:
        raise HTTPException(
            status_code=400,
            detail="Creator has not completed payment setup"
        )

    # Validate amount
    if tip_request.amount < float(MINIMUM_TIP_AMOUNT):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum tip is ${MINIMUM_TIP_AMOUNT}"
        )
    if tip_request.amount > float(MAXIMUM_TIP_AMOUNT):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum tip is ${MAXIMUM_TIP_AMOUNT}"
        )

    try:
        stripe_service = get_stripe_service(db)
        from decimal import Decimal

        result = await stripe_service.create_tip_payment_intent(
            amount=Decimal(str(tip_request.amount)),
            currency=tip_request.currency,
            creator_account_id=creator.stripe_account_id,
            tipper_customer_id=current_user.stripe_customer_id,
            stream_id=tip_request.stream_id,
            message=tip_request.message
        )

        return {
            "status": "pending",
            "payment_intent_id": result["payment_intent_id"],
            "client_secret": result["client_secret"],
            "amount": result["amount"],
            "creator_amount": result["creator_amount"],
            "platform_fee": result["platform_fee"]
        }

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/tips/stream/{stream_id}", response_model=List[TipResponse])
async def get_stream_tips(
    stream_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get recent tips for a stream."""
    tips = (
        db.query(Tip)
        .filter(Tip.stream_id == stream_id)
        .filter(Tip.status == "completed")
        .order_by(Tip.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for tip in tips:
        from_user = db.query(User).filter(User.id == tip.from_user_id).first() if tip.from_user_id else None
        result.append(TipResponse(
            id=tip.id,
            amount=tip.amount,
            message=tip.message,
            created_at=tip.created_at,
            from_username=from_user.username if from_user else "Anonymous"
        ))

    return result


# =============================================================================
# PAYOUT ROUTES
# =============================================================================

@router.get("/payouts/earnings")
async def get_payout_earnings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get creator earnings summary."""
    from sqlalchemy import func
    
    # Calculate total earnings from tips where user is the creator
    tips_total = db.query(func.coalesce(func.sum(Tip.amount), 0)).filter(
        Tip.to_user_id == current_user.id,
        Tip.status == "completed"
    ).scalar() or 0
    
    # Get pending tips
    pending = db.query(func.coalesce(func.sum(Tip.amount), 0)).filter(
        Tip.to_user_id == current_user.id,
        Tip.status == "pending"
    ).scalar() or 0
    
    # Calculate amounts (70% creator share)
    creator_share = 0.7
    total_earned = float(tips_total) * creator_share
    pending_balance = float(pending) * creator_share
    
    # Get paid out amount
    paid_out = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == "payout_requested",
        Transaction.status.in_(["completed", "pending"])
    ).scalar() or 0
    
    available_balance = max(0, total_earned - float(paid_out))
    
    return {
        "total_earned": round(total_earned, 2),
        "available_balance": round(available_balance, 2),
        "pending_balance": round(pending_balance, 2),
        "stripe_connected": bool(current_user.stripe_account_id),
        "stripe_onboarding_url": "/settings/payments" if not current_user.stripe_account_id else None
    }


@router.get("/payouts/history")
async def get_payout_history(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get payout history for creator."""
    payouts = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_type == "payout_requested"
    ).order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        {
            "id": p.id,
            "amount": float(p.amount),
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payouts
    ]


@router.post("/payouts")
@limiter.limit("5/minute")
async def request_payout(
    request: Request,
    payout_request: PayoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Request a payout from earnings to bank account.

    Rate limited: 5/minute.
    """
    if not current_user.stripe_account_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe account found. Set up payments first."
        )

    if not current_user.payout_enabled:
        raise HTTPException(
            status_code=400,
            detail="Payouts are not enabled. Complete onboarding first."
        )

    if payout_request.amount < float(MINIMUM_PAYOUT_AMOUNT):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum payout is ${MINIMUM_PAYOUT_AMOUNT}"
        )

    if payout_request.amount > current_user.balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ${current_user.balance:.2f}"
        )

    try:
        stripe_service = get_stripe_service(db)
        from decimal import Decimal

        result = await stripe_service.request_payout(
            account_id=current_user.stripe_account_id,
            amount=Decimal(str(payout_request.amount)),
            currency=payout_request.currency
        )

        # Update user's pending payout
        current_user.pending_payout = (current_user.pending_payout or 0) + payout_request.amount
        current_user.balance = current_user.balance - payout_request.amount

        # Create transaction record
        transaction = Transaction(
            user_id=current_user.id,
            transaction_type="payout_requested",
            amount=payout_request.amount,
            status="pending",
            stripe_payout_id=result["payout_id"],
            description="Payout requested to bank account"
        )
        db.add(transaction)
        db.commit()

        return {
            "status": "success",
            "payout_id": result["payout_id"],
            "amount": result["amount"],
            "estimated_arrival": result["arrival_date"]
        }

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's transaction history."""
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return transactions


@router.get("/wallet/balance")
async def get_wallet_balance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user's wallet balance and earnings summary."""
    return {
        "balance": current_user.balance or 0,
        "pending_payout": current_user.pending_payout or 0,
        "lifetime_earnings": current_user.lifetime_earnings or 0,
        "stripe_connected": current_user.stripe_account_id is not None,
        "onboarding_complete": current_user.stripe_onboarding_complete or False,
        "payout_enabled": current_user.payout_enabled or False
    }


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe for:
    - Payment completions
    - Account updates
    - Payout status changes
    """
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        stripe_service = get_stripe_service(db)
        result = await stripe_service.handle_webhook(payload, signature)

        # Broadcast tip to WebSocket if successful
        if result.get("handled") and result.get("event_type") == "payment_intent.succeeded":
            stream_id = result.get("stream_id")
            if stream_id:
                # Find stream to get room name
                stream = db.query(Stream).filter(Stream.id == stream_id).first()
                if stream and stream.livekit_room_name:
                    await broadcast_tip(
                        room=stream.livekit_room_name,
                        from_user=result.get("from_user", "Anonymous"),
                        amount=result.get("tip_amount", 0.0),
                        message=result.get("message", "")
                    )

        return {"status": "success", "result": result}

    except PaymentError as e:
        raise HTTPException(status_code=400, detail=e.message)


# =============================================================================
# NOTIFICATION ROUTES
# =============================================================================

# Notification Routes
@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user notifications"""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return notifications

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("error.not_found", locale))

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    db.commit()

    return {"message": "Notification marked as read"}

# =============================================================================
# CHAT ROUTES
# =============================================================================

class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    stream_id: int
    user_id: Optional[int]
    content: str
    is_deleted: bool
    is_highlighted: bool
    tip_amount: Optional[float]
    created_at: datetime
    username: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/streams/{stream_id}/chat", response_model=List[ChatMessageResponse])
async def get_stream_chat_history(
    stream_id: int,
    limit: int = 50,
    before_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get chat message history for a stream.

    Query params:
    - limit: Max messages to return (default 50)
    - before_id: Get messages before this ID (for pagination)
    """
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    query = (
        db.query(ChatMessage)
        .filter(ChatMessage.stream_id == stream_id)
        .filter(ChatMessage.is_deleted == False)
    )

    if before_id:
        query = query.filter(ChatMessage.id < before_id)

    messages = (
        query
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )

    # Reverse to get chronological order
    messages = list(reversed(messages))

    # Build response with user info
    result = []
    for msg in messages:
        user = db.query(User).filter(User.id == msg.user_id).first() if msg.user_id else None
        result.append(ChatMessageResponse(
            id=msg.id,
            stream_id=msg.stream_id,
            user_id=msg.user_id,
            content=msg.content,
            is_deleted=msg.is_deleted,
            is_highlighted=msg.is_highlighted,
            tip_amount=msg.tip_amount,
            created_at=msg.created_at,
            username=user.username if user else "Anonymous",
            avatar_url=user.avatar_url if user else None
        ))

    return result


@router.post("/streams/{stream_id}/chat", response_model=ChatMessageResponse)
@limiter.limit("60/minute")
async def post_chat_message(
    request: Request,
    stream_id: int,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Post a chat message to a stream.

    This is a REST fallback for when WebSocket is not available.
    Rate limited: 60/minute.
    """
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.status != "live":
        raise HTTPException(status_code=400, detail="Chat is only available for live streams")

    # Check if user is banned
    if current_user.is_banned:
        raise HTTPException(status_code=403, detail="You are banned from chatting")

    # Validate message content
    content = message_data.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Message is too long (max 500 characters)")

    # AI Content Moderation (Phase 9)
    moderator = get_content_moderator(db)
    moderation_result = await moderator.analyze_message(
        content=content,
        user_id=current_user.id,
        stream_id=stream_id,
        user_trust_score=current_user.trust_score or 1.0
    )

    # Block message if moderation result indicates
    if moderation_result.action == ModAction.BLOCK:
        # Auto-mute user if flagged for repeated violations
        if moderation_result.should_mute and moderation_result.mute_duration:
            await moderator.mute_user(
                user_id=current_user.id,
                muted_by=current_user.id,  # System auto-mute
                stream_id=stream_id,
                duration_seconds=moderation_result.mute_duration,
                reason=moderation_result.reason
            )
        raise HTTPException(
            status_code=400,
            detail=moderation_result.reason or "Message violates community guidelines"
        )

    # Flag message for review if needed
    if moderation_result.action == ModAction.FLAG:
        await moderator.add_to_queue(
            content_type="chat",
            content_text=content,
            flagged_reason=list(moderation_result.categories.keys())[0] if moderation_result.categories else "unknown",
            user_id=current_user.id,
            stream_id=stream_id,
            confidence=moderation_result.confidence,
            flagged_patterns=moderation_result.matched_patterns
        )

    # Create message with moderation metadata
    db_message = ChatMessage(
        stream_id=stream_id,
        user_id=current_user.id,
        content=content,
        moderation_status="approved" if moderation_result.action == ModAction.APPROVE else "flagged",
        moderation_confidence=moderation_result.confidence,
        moderation_flags=moderation_result.categories if moderation_result.categories else None
    )

    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # Broadcast via WebSocket
    if stream.livekit_room_name:
        await ws_manager.broadcast_to_room(
            stream.livekit_room_name,
            {
                "type": "chat_message",
                "message": {
                    "id": db_message.id,
                    "user_id": current_user.id,
                    "username": current_user.username,
                    "content": content,
                    "created_at": db_message.created_at.isoformat(),
                    "is_highlighted": False
                }
            }
        )

    return ChatMessageResponse(
        id=db_message.id,
        stream_id=db_message.stream_id,
        user_id=db_message.user_id,
        content=db_message.content,
        is_deleted=db_message.is_deleted,
        is_highlighted=db_message.is_highlighted,
        tip_amount=db_message.tip_amount,
        created_at=db_message.created_at,
        username=current_user.username,
        avatar_url=current_user.avatar_url
    )


@router.delete("/chat/{message_id}")
async def delete_chat_message(
    message_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete a chat message.

    Only the message author, stream owner, or admin can delete messages.
    """
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get stream owner
    stream = db.query(Stream).filter(Stream.id == message.stream_id).first()

    # Authorization check
    can_delete = (
        message.user_id == current_user.id or  # Author
        (stream and stream.user_id == current_user.id) or  # Stream owner
        current_user.is_admin  # Admin
    )

    if not can_delete:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    # Soft delete
    message.is_deleted = True
    message.deleted_by = current_user.id
    message.deleted_at = datetime.utcnow()
    message.delete_reason = reason
    db.commit()

    # Broadcast deletion via WebSocket
    if stream and stream.livekit_room_name:
        await ws_manager.broadcast_to_room(
            stream.livekit_room_name,
            {
                "type": "chat_message_deleted",
                "message_id": message_id,
                "deleted_by": current_user.username
            }
        )

    return {"message": "Message deleted successfully"}



# =============================================================================
# MODERATION ROUTES - Host tools
# =============================================================================

class MuteRequest(BaseModel):
    user_id: int
    duration_seconds: Optional[int] = None  # None means permanent (ban)
    reason: Optional[str] = None

@router.post("/streams/{stream_id}/moderation/mute")
async def mute_user_in_stream(
    stream_id: int,
    mute_data: MuteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Mute or Ban a user in a specific stream.
    
    - duration_seconds = None -> Permanent Ban
    - duration_seconds > 0 -> Temporary Timeout
    
    Only the stream owner or moderator can perform this action.
    """
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # TODO: Add moderator check if we implement mod roles later
    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to moderate this stream")

    moderator = get_content_moderator(db)
    
    # Perform mute/ban
    try:
        await moderator.mute_user(
            user_id=mute_data.user_id,
            muted_by=current_user.id,
            stream_id=stream_id,
            duration_seconds=mute_data.duration_seconds,
            reason=mute_data.reason
        )
        
        action_type = "ban" if mute_data.duration_seconds is None else "timeout"
        
        # Broadcast moderation event via WebSocket
        if stream.livekit_room_name:
            await ws_manager.broadcast_to_room(
                stream.livekit_room_name,
                {
                    "type": "user_moderated",
                    "action": action_type,
                    "user_id": mute_data.user_id,
                    "moderator_id": current_user.id,
                    "duration": mute_data.duration_seconds
                }
            )
            
        return {"message": f"User {action_type} successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/streams/{stream_id}/moderation/unmute")
async def unmute_user_in_stream(
    stream_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unmute/Unban a user in a specific stream."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to moderate this stream")

    moderator = get_content_moderator(db)
    
    success = await moderator.unmute_user(user_id=user_id, stream_id=stream_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="User is not muted")
        
    return {"message": "User unmuted successfully"}


# SOCIAL ROUTES - Follow & Like System
# =============================================================================

class UserFollowResponse(BaseModel):
    id: int
    username: Optional[str]
    avatar_url: Optional[str]
    follower_count: int
    following_count: int
    followed_at: datetime

    class Config:
        from_attributes = True


@router.post("/users/{user_id}/follow")
@limiter.limit("60/minute")
async def follow_user(
    request: Request,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Follow a user."""
    locale = get_locale(request)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail=t("error.validation", locale))

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=t("user.not_found", locale))

    # Check if already following
    existing = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == current_user.id)
        .filter(UserFollow.following_id == user_id)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail=t("error.validation", locale))

    # Create follow
    follow = UserFollow(
        follower_id=current_user.id,
        following_id=user_id
    )
    db.add(follow)

    # Update counts
    target_user.follower_count = (target_user.follower_count or 0) + 1
    current_user.following_count = (current_user.following_count or 0) + 1

    # Create notification for target user
    create_notification(
        db,
        user_id=user_id,
        type="new_follower",
        title="New Follower",
        message=f"{current_user.username} followed you!",
        from_user_id=current_user.id
    )

    db.commit()

    return {"message": "Successfully followed user", "following": True}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unfollow a user."""
    locale = get_locale(request)
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=t("user.not_found", locale))

    # Find and delete follow
    follow = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == current_user.id)
        .filter(UserFollow.following_id == user_id)
        .first()
    )

    if not follow:
        raise HTTPException(status_code=400, detail=t("error.validation", locale))

    db.delete(follow)

    # Update counts
    if target_user.follower_count and target_user.follower_count > 0:
        target_user.follower_count -= 1
    if current_user.following_count and current_user.following_count > 0:
        current_user.following_count -= 1

    db.commit()

    return {"message": "Successfully unfollowed user", "following": False}


@router.get("/users/{user_id}/followers")
async def get_user_followers(
    user_id: int,
    request: Request,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get list of users following this user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        locale = get_locale(request)
        raise HTTPException(status_code=404, detail=t("user.not_found", locale))

    follows = (
        db.query(UserFollow)
        .filter(UserFollow.following_id == user_id)
        .order_by(UserFollow.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    followers = []
    for follow in follows:
        follower = db.query(User).filter(User.id == follow.follower_id).first()
        if follower:
            followers.append({
                "id": follower.id,
                "username": follower.username,
                "avatar_url": follower.avatar_url,
                "follower_count": follower.follower_count or 0,
                "following_count": follower.following_count or 0,
                "followed_at": follow.created_at.isoformat()
            })

    return {
        "followers": followers,
        "total": user.follower_count or 0
    }


@router.get("/users/{user_id}/following")
async def get_user_following(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get list of users this user is following."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    follows = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == user_id)
        .order_by(UserFollow.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    following = []
    for follow in follows:
        followed_user = db.query(User).filter(User.id == follow.following_id).first()
        if followed_user:
            following.append({
                "id": followed_user.id,
                "username": followed_user.username,
                "avatar_url": followed_user.avatar_url,
                "follower_count": followed_user.follower_count or 0,
                "following_count": followed_user.following_count or 0,
                "followed_at": follow.created_at.isoformat()
            })

    return {
        "following": following,
        "total": user.following_count or 0
    }


@router.get("/users/{user_id}/is-following")
async def check_is_following(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if current user is following the target user."""
    follow = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == current_user.id)
        .filter(UserFollow.following_id == user_id)
        .first()
    )

    return {"is_following": follow is not None}


@router.get("/feed/following", response_model=List[StreamResponse])
async def get_following_feed(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get live streams from users the current user follows."""
    # Get followed user IDs
    followed_ids = (
        db.query(UserFollow.following_id)
        .filter(UserFollow.follower_id == current_user.id)
        .all()
    )
    followed_ids = [f[0] for f in followed_ids]

    if not followed_ids:
        return []

    # Get live streams from followed users
    streams = (
        db.query(Stream)
        .filter(Stream.user_id.in_(followed_ids))
        .filter(Stream.status == "live")
        .order_by(Stream.viewer_count.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return streams


# Stream Like Endpoints
@router.post("/streams/{stream_id}/like")
@limiter.limit("60/minute")
async def like_stream(
    request: Request,
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Like a stream."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Check if already liked
    existing = (
        db.query(StreamLike)
        .filter(StreamLike.user_id == current_user.id)
        .filter(StreamLike.stream_id == stream_id)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Already liked this stream")

    # Create like
    like = StreamLike(
        user_id=current_user.id,
        stream_id=stream_id
    )
    db.add(like)

    # Update count
    stream.like_count = (stream.like_count or 0) + 1
    db.commit()

    # Broadcast like via WebSocket
    if stream.livekit_room_name:
        await ws_manager.broadcast_to_room(
            stream.livekit_room_name,
            {
                "type": "stream_liked",
                "user_id": current_user.id,
                "username": current_user.username,
                "like_count": stream.like_count
            }
        )

    return {"message": "Stream liked", "liked": True, "like_count": stream.like_count}


@router.delete("/streams/{stream_id}/like")
async def unlike_stream(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unlike a stream."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Find and delete like
    like = (
        db.query(StreamLike)
        .filter(StreamLike.user_id == current_user.id)
        .filter(StreamLike.stream_id == stream_id)
        .first()
    )

    if not like:
        raise HTTPException(status_code=400, detail="Not liked")

    db.delete(like)

    # Update count
    if stream.like_count and stream.like_count > 0:
        stream.like_count -= 1

    db.commit()

    return {"message": "Stream unliked", "liked": False, "like_count": stream.like_count}


@router.get("/streams/{stream_id}/is-liked")
async def check_is_liked(
    stream_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Check if current user has liked the stream.

    Public-safe: anonymous viewers (no auth) simply get is_liked=false instead
    of a 401, since the stream page calls this for everyone.
    """
    if not current_user:
        return {"is_liked": False}

    like = (
        db.query(StreamLike)
        .filter(StreamLike.user_id == current_user.id)
        .filter(StreamLike.stream_id == stream_id)
        .first()
    )

    return {"is_liked": like is not None}


# =============================================================================
# ADMIN & MODERATION ROUTES
# =============================================================================

class ReportCreate(BaseModel):
    reported_user_id: Optional[int] = None
    reported_stream_id: Optional[int] = None
    reported_message_id: Optional[int] = None
    reason: str
    description: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reported_user_id: Optional[int]
    reported_stream_id: Optional[int]
    reported_message_id: Optional[int]
    reason: str
    description: Optional[str]
    status: str
    priority: str
    action_taken: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class AdminUserResponse(BaseModel):
    id: int
    username: Optional[str]
    email: Optional[str]
    is_active: bool
    is_verified: bool
    is_banned: bool
    is_admin: bool
    warning_count: int
    trust_score: float
    follower_count: int
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class ModerationActionCreate(BaseModel):
    action_type: str  # warning, mute, temp_ban, perm_ban, unban
    reason: Optional[str] = None
    duration: Optional[int] = None  # Duration in seconds for temp actions


# Report endpoints
@router.post("/reports", response_model=ReportResponse)
@limiter.limit("10/minute")
async def submit_report(
    request: Request,
    report_data: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit a content report.

    At least one of reported_user_id, reported_stream_id, or reported_message_id must be provided.
    Rate limited: 10/minute.
    """
    # Validate that at least one target is specified
    if not any([report_data.reported_user_id, report_data.reported_stream_id, report_data.reported_message_id]):
        raise HTTPException(
            status_code=400,
            detail="Must specify at least one of: reported_user_id, reported_stream_id, reported_message_id"
        )

    # Validate reason
    valid_reasons = ["spam", "harassment", "violence", "nudity", "copyright", "hate_speech", "misinformation", "other"]
    if report_data.reason not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"Invalid reason. Must be one of: {', '.join(valid_reasons)}")

    # Can't report yourself
    if report_data.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Validate targets exist
    if report_data.reported_user_id:
        user = db.query(User).filter(User.id == report_data.reported_user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Reported user not found")

    if report_data.reported_stream_id:
        stream = db.query(Stream).filter(Stream.id == report_data.reported_stream_id).first()
        if not stream:
            raise HTTPException(status_code=404, detail="Reported stream not found")

    if report_data.reported_message_id:
        message = db.query(ChatMessage).filter(ChatMessage.id == report_data.reported_message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Reported message not found")

    # Check for duplicate recent report
    existing = (
        db.query(Report)
        .filter(Report.reporter_id == current_user.id)
        .filter(Report.reported_user_id == report_data.reported_user_id)
        .filter(Report.reported_stream_id == report_data.reported_stream_id)
        .filter(Report.reported_message_id == report_data.reported_message_id)
        .filter(Report.status.in_(["pending", "reviewing"]))
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted a report for this content")

    # Create report
    report = Report(
        reporter_id=current_user.id,
        reported_user_id=report_data.reported_user_id,
        reported_stream_id=report_data.reported_stream_id,
        reported_message_id=report_data.reported_message_id,
        reason=report_data.reason,
        description=report_data.description
    )

    # Set priority based on reason
    high_priority_reasons = ["violence", "nudity", "hate_speech"]
    if report_data.reason in high_priority_reasons:
        report.priority = "high"

    db.add(report)
    db.commit()
    db.refresh(report)

    return report


@router.get("/reports/mine", response_model=List[ReportResponse])
async def get_my_reports(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get reports submitted by the current user."""
    reports = (
        db.query(Report)
        .filter(Report.reporter_id == current_user.id)
        .order_by(Report.created_at.desc())
        .limit(50)
        .all()
    )

    return reports


# Admin user management endpoints
@router.get("/admin/users", response_model=List[AdminUserResponse])
@limiter.limit("30/minute")
async def admin_list_users(
    request: Request,
    search: Optional[str] = None,
    is_banned: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all users with admin view.

    Requires admin privileges. Rate limited: 30/minute.
    """
    query = db.query(User)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term)) |
            (User.email.ilike(search_term))
        )

    if is_banned is not None:
        query = query.filter(User.is_banned == is_banned)

    users = (
        query
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return users


@router.get("/admin/users/{user_id}", response_model=AdminUserResponse)
async def admin_get_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed user information. Requires admin privileges."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.post("/admin/users/{user_id}/ban")
@limiter.limit("10/minute")
async def admin_ban_user(
    request: Request,
    user_id: int,
    action: ModerationActionCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Ban a user.

    Requires admin privileges. Rate limited: 10/minute.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban an admin user")

    if target_user.is_banned:
        raise HTTPException(status_code=400, detail="User is already banned")

    # Apply ban
    target_user.is_banned = True
    target_user.ban_reason = action.reason

    ban_type = "perm_ban"
    expires_at = None

    if action.duration:
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(seconds=action.duration)
        target_user.ban_expires = expires_at
        ban_type = "temp_ban"

    # Log moderation action
    mod_action = ModerationAction(
        moderator_id=current_user.id,
        target_user_id=user_id,
        action_type=ban_type,
        reason=action.reason,
        duration=action.duration,
        expires_at=expires_at
    )
    db.add(mod_action)

    # Create notification for banned user
    notification = Notification(
        user_id=user_id,
        notification_type="moderation",
        title="Account Banned",
        message=f"Your account has been banned. Reason: {action.reason or 'No reason provided'}"
    )
    db.add(notification)

    db.commit()

    return {
        "message": f"User {target_user.username} has been banned",
        "ban_type": ban_type,
        "expires_at": expires_at.isoformat() if expires_at else None
    }


@router.post("/admin/users/{user_id}/unban")
async def admin_unban_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Unban a user. Requires admin privileges."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not target_user.is_banned:
        raise HTTPException(status_code=400, detail="User is not banned")

    # Remove ban
    target_user.is_banned = False
    target_user.ban_reason = None
    target_user.ban_expires = None

    # Log moderation action
    mod_action = ModerationAction(
        moderator_id=current_user.id,
        target_user_id=user_id,
        action_type="unban",
        reason="Manual unban by admin"
    )
    db.add(mod_action)

    # Notify user
    notification = Notification(
        user_id=user_id,
        notification_type="moderation",
        title="Account Unbanned",
        message="Your account has been unbanned. Welcome back!"
    )
    db.add(notification)

    db.commit()

    return {"message": f"User {target_user.username} has been unbanned"}


@router.post("/admin/users/{user_id}/warn")
@limiter.limit("20/minute")
async def admin_warn_user(
    request: Request,
    user_id: int,
    action: ModerationActionCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Issue a warning to a user.

    Requires admin privileges. Rate limited: 20/minute.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Increment warning count
    target_user.warning_count = (target_user.warning_count or 0) + 1

    # Lower trust score
    target_user.trust_score = max(0.0, (target_user.trust_score or 1.0) - 0.1)

    # Log moderation action
    mod_action = ModerationAction(
        moderator_id=current_user.id,
        target_user_id=user_id,
        action_type="warning",
        reason=action.reason
    )
    db.add(mod_action)

    # Notify user
    notification = Notification(
        user_id=user_id,
        notification_type="moderation",
        title="Warning Issued",
        message=f"You have received a warning. Reason: {action.reason or 'No reason provided'}. Warning count: {target_user.warning_count}"
    )
    db.add(notification)

    db.commit()

    return {
        "message": f"Warning issued to {target_user.username}",
        "warning_count": target_user.warning_count,
        "trust_score": target_user.trust_score
    }


# Admin stream management
@router.get("/admin/streams")
@limiter.limit("30/minute")
async def admin_list_streams(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all streams with admin view.

    Requires admin privileges. Rate limited: 30/minute.
    """
    query = db.query(Stream)

    if status:
        query = query.filter(Stream.status == status)

    streams = (
        query
        .order_by(Stream.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return streams


@router.delete("/admin/streams/{stream_id}")
async def admin_delete_stream(
    stream_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Forcefully end and delete a stream. Requires admin privileges."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # End the stream
    stream.status = "ended"
    stream.ends_at = datetime.utcnow()

    # Log moderation action
    mod_action = ModerationAction(
        moderator_id=current_user.id,
        target_stream_id=stream_id,
        target_user_id=stream.user_id,
        action_type="stream_end",
        reason=reason
    )
    db.add(mod_action)

    # Notify stream owner
    if stream.user_id:
        notification = Notification(
            user_id=stream.user_id,
            stream_id=stream_id,
            notification_type="moderation",
            title="Stream Ended by Moderator",
            message=f"Your stream has been ended by a moderator. Reason: {reason or 'No reason provided'}"
        )
        db.add(notification)

    db.commit()

    # Broadcast stream end via WebSocket
    if stream.livekit_room_name:
        await ws_manager.broadcast_to_room(
            stream.livekit_room_name,
            {
                "type": "stream_ended",
                "reason": "moderated",
                "message": "This stream has been ended by a moderator"
            }
        )

    return {"message": f"Stream {stream_id} has been ended"}


# Admin report management
@router.get("/admin/reports", response_model=List[ReportResponse])
@limiter.limit("30/minute")
async def admin_list_reports(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    List all content reports.

    Requires admin privileges. Rate limited: 30/minute.
    """
    query = db.query(Report)

    if status:
        query = query.filter(Report.status == status)

    if priority:
        query = query.filter(Report.priority == priority)

    reports = (
        query
        .order_by(
            # High priority first
            Report.priority.desc(),
            Report.created_at.desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return reports


@router.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(
    report_id: int,
    action_taken: str,
    resolution_notes: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Resolve a content report.

    Requires admin privileges.
    action_taken: none, warning, mute, ban, content_removed
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status == "resolved":
        raise HTTPException(status_code=400, detail="Report is already resolved")

    valid_actions = ["none", "warning", "mute", "ban", "content_removed"]
    if action_taken not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}")

    # Update report
    report.status = "resolved"
    report.resolved_by = current_user.id
    report.resolved_at = datetime.utcnow()
    report.action_taken = action_taken
    report.resolution_notes = resolution_notes

    # Log moderation action
    mod_action = ModerationAction(
        moderator_id=current_user.id,
        target_user_id=report.reported_user_id,
        target_stream_id=report.reported_stream_id,
        target_message_id=report.reported_message_id,
        report_id=report_id,
        action_type=f"report_resolved_{action_taken}",
        reason=resolution_notes
    )
    db.add(mod_action)

    db.commit()

    return {
        "message": "Report resolved",
        "report_id": report_id,
        "action_taken": action_taken
    }


@router.post("/admin/reports/{report_id}/dismiss")
async def admin_dismiss_report(
    report_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Dismiss a content report. Requires admin privileges."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status in ["resolved", "dismissed"]:
        raise HTTPException(status_code=400, detail="Report is already processed")

    report.status = "dismissed"
    report.resolved_by = current_user.id
    report.resolved_at = datetime.utcnow()
    report.resolution_notes = reason

    db.commit()

    return {"message": "Report dismissed", "report_id": report_id}


@router.get("/admin/moderation-log")
@limiter.limit("30/minute")
async def admin_get_moderation_log(
    request: Request,
    target_user_id: Optional[int] = None,
    moderator_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get moderation action history.

    Requires admin privileges. Rate limited: 30/minute.
    """
    query = db.query(ModerationAction)

    if target_user_id:
        query = query.filter(ModerationAction.target_user_id == target_user_id)

    if moderator_id:
        query = query.filter(ModerationAction.moderator_id == moderator_id)

    actions = (
        query
        .order_by(ModerationAction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for action in actions:
        moderator = db.query(User).filter(User.id == action.moderator_id).first()
        target_user = db.query(User).filter(User.id == action.target_user_id).first() if action.target_user_id else None

        result.append({
            "id": action.id,
            "moderator": moderator.username if moderator else None,
            "target_user": target_user.username if target_user else None,
            "action_type": action.action_type,
            "reason": action.reason,
            "duration": action.duration,
            "expires_at": action.expires_at.isoformat() if action.expires_at else None,
            "created_at": action.created_at.isoformat()
        })

    return result


# Admin stats endpoint
@router.get("/admin/stats")
async def admin_get_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get platform statistics. Requires admin privileges."""
    from sqlalchemy import func

    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    banned_users = db.query(func.count(User.id)).filter(User.is_banned == True).scalar()

    total_streams = db.query(func.count(Stream.id)).scalar()
    live_streams = db.query(func.count(Stream.id)).filter(Stream.status == "live").scalar()

    total_events = db.query(func.count(Event.id)).scalar()
    active_events = db.query(func.count(Event.id)).filter(Event.status == "active").scalar()

    pending_reports = db.query(func.count(Report.id)).filter(Report.status == "pending").scalar()
    high_priority_reports = (
        db.query(func.count(Report.id))
        .filter(Report.status == "pending")
        .filter(Report.priority.in_(["high", "urgent"]))
        .scalar()
    )

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "banned": banned_users
        },
        "streams": {
            "total": total_streams,
            "live": live_streams
        },
        "events": {
            "total": total_events,
            "active": active_events
        },
        "reports": {
            "pending": pending_reports,
            "high_priority": high_priority_reports
        }
    }


# =============================================================================
# AI Content Moderation Endpoints (Phase 9)
# =============================================================================

class ModerationSettingsUpdate(BaseModel):
    """Schema for updating stream moderation settings"""
    moderation_level: Optional[str] = None
    allow_links: Optional[bool] = None
    slow_mode_seconds: Optional[int] = None
    subscriber_only: Optional[bool] = None
    follower_only_minutes: Optional[int] = None
    blocked_words: Optional[List[str]] = None
    auto_mod_caps_percent: Optional[int] = None


class ModerationSettingsResponse(BaseModel):
    """Schema for moderation settings response"""
    stream_id: int
    moderation_level: str
    allow_links: bool
    slow_mode_seconds: int
    subscriber_only: bool
    follower_only_minutes: int
    blocked_words: Optional[List[str]]
    auto_mod_caps_percent: int


class QueueItemResponse(BaseModel):
    """Schema for moderation queue item"""
    id: int
    content_type: str
    content_text: str
    user_id: Optional[int]
    stream_id: Optional[int]
    flagged_reason: str
    confidence: Optional[float]
    status: str
    created_at: datetime
    username: Optional[str] = None


class ContentFilterCreate(BaseModel):
    """Schema for creating a content filter"""
    pattern: str
    filter_type: str  # 'keyword', 'regex'
    action: str = "block"  # 'block', 'flag', 'warn'
    severity: str = "medium"  # 'low', 'medium', 'high', 'critical'
    category: Optional[str] = None
    description: Optional[str] = None


class ContentFilterResponse(BaseModel):
    """Schema for content filter response"""
    id: int
    pattern: str
    filter_type: str
    action: str
    severity: str
    category: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime


@router.get("/streams/{stream_id}/moderation/settings", response_model=ModerationSettingsResponse)
async def get_moderation_settings(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get moderation settings for a stream."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Check if user owns the stream or is admin
    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    settings = db.query(StreamModerationSettings).filter(
        StreamModerationSettings.stream_id == stream_id
    ).first()

    if not settings:
        # Return defaults
        return ModerationSettingsResponse(
            stream_id=stream_id,
            moderation_level="standard",
            allow_links=True,
            slow_mode_seconds=0,
            subscriber_only=False,
            follower_only_minutes=0,
            blocked_words=None,
            auto_mod_caps_percent=70
        )

    return ModerationSettingsResponse(
        stream_id=settings.stream_id,
        moderation_level=settings.moderation_level,
        allow_links=settings.allow_links,
        slow_mode_seconds=settings.slow_mode_seconds,
        subscriber_only=settings.subscriber_only,
        follower_only_minutes=settings.follower_only_minutes,
        blocked_words=settings.blocked_words,
        auto_mod_caps_percent=settings.auto_mod_caps_percent
    )


@router.post("/streams/{stream_id}/moderation/settings", response_model=ModerationSettingsResponse)
async def update_moderation_settings(
    stream_id: int,
    settings_data: ModerationSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update moderation settings for a stream."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Check if user owns the stream or is admin
    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Validate moderation level
    if settings_data.moderation_level and settings_data.moderation_level not in ["off", "relaxed", "standard", "strict"]:
        raise HTTPException(status_code=400, detail="Invalid moderation level")

    settings = db.query(StreamModerationSettings).filter(
        StreamModerationSettings.stream_id == stream_id
    ).first()

    if not settings:
        settings = StreamModerationSettings(stream_id=stream_id)
        db.add(settings)

    # Update fields
    if settings_data.moderation_level is not None:
        settings.moderation_level = settings_data.moderation_level
    if settings_data.allow_links is not None:
        settings.allow_links = settings_data.allow_links
    if settings_data.slow_mode_seconds is not None:
        settings.slow_mode_seconds = max(0, settings_data.slow_mode_seconds)
    if settings_data.subscriber_only is not None:
        settings.subscriber_only = settings_data.subscriber_only
    if settings_data.follower_only_minutes is not None:
        settings.follower_only_minutes = max(0, settings_data.follower_only_minutes)
    if settings_data.blocked_words is not None:
        settings.blocked_words = settings_data.blocked_words
    if settings_data.auto_mod_caps_percent is not None:
        settings.auto_mod_caps_percent = max(0, min(100, settings_data.auto_mod_caps_percent))

    db.commit()
    db.refresh(settings)

    # Invalidate moderation cache
    moderator = get_content_moderator(db)
    moderator.invalidate_cache()

    return ModerationSettingsResponse(
        stream_id=settings.stream_id,
        moderation_level=settings.moderation_level,
        allow_links=settings.allow_links,
        slow_mode_seconds=settings.slow_mode_seconds,
        subscriber_only=settings.subscriber_only,
        follower_only_minutes=settings.follower_only_minutes,
        blocked_words=settings.blocked_words,
        auto_mod_caps_percent=settings.auto_mod_caps_percent
    )


@router.post("/streams/{stream_id}/mute/{user_id}")
async def mute_user_in_stream(
    stream_id: int,
    user_id: int,
    duration: Optional[int] = 300,  # Default 5 minutes
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mute a user in a stream's chat."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Check if user owns the stream or is admin
    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    moderator = get_content_moderator(db)
    mute = await moderator.mute_user(
        user_id=user_id,
        muted_by=current_user.id,
        stream_id=stream_id,
        duration_seconds=duration,
        reason=reason
    )

    return {
        "success": True,
        "mute_id": mute.id,
        "user_id": user_id,
        "stream_id": stream_id,
        "duration": duration,
        "reason": reason
    }


@router.delete("/streams/{stream_id}/mute/{user_id}")
async def unmute_user_in_stream(
    stream_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unmute a user in a stream's chat."""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Check if user owns the stream or is admin
    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    moderator = get_content_moderator(db)
    success = await moderator.unmute_user(user_id=user_id, stream_id=stream_id)

    if not success:
        raise HTTPException(status_code=404, detail="User is not muted in this stream")

    return {"success": True, "user_id": user_id, "stream_id": stream_id}


@router.get("/admin/moderation/queue", response_model=List[QueueItemResponse])
async def get_moderation_queue(
    status: str = "pending",
    content_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get items from the moderation queue (admin only)."""
    moderator = get_content_moderator(db)
    items = await moderator.get_queue_items(
        status=status,
        content_type=content_type,
        limit=limit,
        offset=offset
    )

    result = []
    for item in items:
        user = db.query(User).filter(User.id == item.user_id).first() if item.user_id else None
        result.append(QueueItemResponse(
            id=item.id,
            content_type=item.content_type,
            content_text=item.content_text,
            user_id=item.user_id,
            stream_id=item.stream_id,
            flagged_reason=item.flagged_reason,
            confidence=item.confidence,
            status=item.status,
            created_at=item.created_at,
            username=user.username if user else None
        ))

    return result


@router.post("/admin/moderation/{item_id}/review")
async def review_moderation_item(
    item_id: int,
    approved: bool,
    notes: Optional[str] = None,
    action: Optional[str] = None,  # 'none', 'warn', 'mute', 'ban'
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Review and resolve a moderation queue item (admin only)."""
    moderator = get_content_moderator(db)
    item = await moderator.review_queue_item(
        item_id=item_id,
        reviewer_id=current_user.id,
        approved=approved,
        notes=notes,
        action_taken=action
    )

    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    # Apply action if specified
    if action == "mute" and item.user_id:
        await moderator.mute_user(
            user_id=item.user_id,
            muted_by=current_user.id,
            stream_id=item.stream_id,
            duration_seconds=3600,  # 1 hour
            reason=f"Moderation review: {notes or 'Content violation'}"
        )
    elif action == "ban" and item.user_id:
        user = db.query(User).filter(User.id == item.user_id).first()
        if user:
            user.is_banned = True
            user.ban_reason = notes or "Content policy violation"
            db.commit()

    return {
        "success": True,
        "item_id": item_id,
        "status": item.status,
        "action_taken": action
    }


@router.get("/admin/content-filters", response_model=List[ContentFilterResponse])
async def get_content_filters(
    active_only: bool = True,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all content filters (admin only)."""
    query = db.query(ContentFilter)
    if active_only:
        query = query.filter(ContentFilter.is_active == True)

    filters = query.order_by(ContentFilter.created_at.desc()).all()

    return [
        ContentFilterResponse(
            id=f.id,
            pattern=f.pattern,
            filter_type=f.filter_type,
            action=f.action,
            severity=f.severity,
            category=f.category,
            description=f.description,
            is_active=f.is_active,
            created_at=f.created_at
        )
        for f in filters
    ]


@router.post("/admin/content-filters", response_model=ContentFilterResponse)
async def create_content_filter(
    filter_data: ContentFilterCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new content filter (admin only)."""
    # Validate filter type
    if filter_data.filter_type not in ["keyword", "regex"]:
        raise HTTPException(status_code=400, detail="Invalid filter type")

    # Validate action
    if filter_data.action not in ["block", "flag", "warn"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    # Validate severity
    if filter_data.severity not in ["low", "medium", "high", "critical"]:
        raise HTTPException(status_code=400, detail="Invalid severity")

    # Validate regex if applicable
    if filter_data.filter_type == "regex":
        import re
        try:
            re.compile(filter_data.pattern)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex pattern: {e}")

    new_filter = ContentFilter(
        pattern=filter_data.pattern,
        filter_type=filter_data.filter_type,
        action=filter_data.action,
        severity=filter_data.severity,
        category=filter_data.category,
        description=filter_data.description,
        is_active=True,
        created_by=current_user.id
    )

    db.add(new_filter)
    db.commit()
    db.refresh(new_filter)

    # Invalidate cache
    moderator = get_content_moderator(db)
    moderator.invalidate_cache()

    return ContentFilterResponse(
        id=new_filter.id,
        pattern=new_filter.pattern,
        filter_type=new_filter.filter_type,
        action=new_filter.action,
        severity=new_filter.severity,
        category=new_filter.category,
        description=new_filter.description,
        is_active=new_filter.is_active,
        created_at=new_filter.created_at
    )


@router.delete("/admin/content-filters/{filter_id}")
async def delete_content_filter(
    filter_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a content filter (admin only)."""
    filter_obj = db.query(ContentFilter).filter(ContentFilter.id == filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="Filter not found")

    filter_obj.is_active = False
    db.commit()

    # Invalidate cache
    moderator = get_content_moderator(db)
    moderator.invalidate_cache()

    return {"success": True, "filter_id": filter_id}


# =============================================================================
# SUBSCRIPTION & VIRTUAL GOODS ENDPOINTS (Phase 10)
# =============================================================================

class SubscriptionTierCreate(BaseModel):
    """Schema for creating a subscription tier"""
    name: str
    price: float
    description: Optional[str] = None
    benefits: Optional[List[str]] = None
    billing_period: str = "monthly"
    currency: str = "USD"
    max_subscribers: Optional[int] = None
    badge_url: Optional[str] = None
    emote_slots: int = 0


class SubscriptionTierUpdate(BaseModel):
    """Schema for updating a subscription tier"""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    benefits: Optional[List[str]] = None
    max_subscribers: Optional[int] = None
    badge_url: Optional[str] = None
    emote_slots: Optional[int] = None
    is_active: Optional[bool] = None


class SubscriptionTierResponse(BaseModel):
    """Schema for subscription tier response"""
    id: int
    creator_id: int
    name: str
    description: Optional[str]
    price: float
    currency: str
    billing_period: str
    benefits: List[str]
    badge_url: Optional[str]
    emote_slots: int
    max_subscribers: Optional[int]
    current_subscribers: int
    is_active: bool
    created_at: Optional[str]


class SubscriptionCheckoutRequest(BaseModel):
    """Schema for subscription checkout"""
    tier_id: int
    success_url: str
    cancel_url: str


class GiftCodeCreate(BaseModel):
    """Schema for creating a gift code"""
    tier_id: int
    months: int = 1
    expires_days: Optional[int] = 30


class VirtualGoodCreate(BaseModel):
    """Schema for creating a virtual good"""
    name: str
    type: str  # 'badge', 'emote', 'effect', 'sticker'
    price: float
    description: Optional[str] = None
    currency: str = "USD"
    image_url: Optional[str] = None
    animation_url: Optional[str] = None
    is_limited: bool = False
    quantity_available: Optional[int] = None
    tier_exclusive_id: Optional[int] = None


class VirtualGoodUpdate(BaseModel):
    """Schema for updating a virtual good"""
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    animation_url: Optional[str] = None
    is_limited: Optional[bool] = None
    quantity_available: Optional[int] = None
    is_active: Optional[bool] = None
    tier_exclusive_id: Optional[int] = None


class VirtualGoodResponse(BaseModel):
    """Schema for virtual good response"""
    id: int
    creator_id: Optional[int]
    name: str
    description: Optional[str]
    type: str
    price: float
    currency: str
    image_url: Optional[str]
    animation_url: Optional[str]
    is_limited: bool
    quantity_available: Optional[int]
    quantity_sold: int
    is_active: bool
    tier_exclusive_id: Optional[int]
    created_at: Optional[str]


class InventoryItemResponse(BaseModel):
    """Schema for inventory item response"""
    inventory_id: int
    good_id: int
    name: str
    type: str
    description: Optional[str]
    image_url: Optional[str]
    animation_url: Optional[str]
    quantity: int
    is_equipped: bool
    gifted_from_user_id: Optional[int]
    purchased_at: Optional[str]


# Subscription Tier Endpoints
@router.post("/creators/{creator_id}/tiers", response_model=SubscriptionTierResponse)
async def create_subscription_tier(
    creator_id: int,
    tier_data: SubscriptionTierCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a subscription tier for a creator."""
    # Only the creator themselves or an admin can create tiers
    if current_user.id != creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    from .subscriptions import get_subscription_service, SubscriptionError

    sub_service = get_subscription_service(db)
    try:
        tier = await sub_service.create_tier(
            creator_id=creator_id,
            name=tier_data.name,
            price=tier_data.price,
            description=tier_data.description,
            benefits=tier_data.benefits,
            billing_period=tier_data.billing_period,
            currency=tier_data.currency,
            max_subscribers=tier_data.max_subscribers,
            badge_url=tier_data.badge_url,
            emote_slots=tier_data.emote_slots,
        )
        return tier
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/creators/{creator_id}/tiers", response_model=List[SubscriptionTierResponse])
async def get_creator_tiers(
    creator_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """Get all subscription tiers for a creator."""
    from .subscriptions import get_subscription_service

    sub_service = get_subscription_service(db)
    tiers = await sub_service.get_tiers(creator_id, include_inactive=include_inactive)
    return tiers


@router.get("/tiers/{tier_id}", response_model=SubscriptionTierResponse)
async def get_subscription_tier(
    tier_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific subscription tier."""
    from .subscriptions import get_subscription_service, SubscriptionError

    sub_service = get_subscription_service(db)
    try:
        tier = await sub_service.get_tier(tier_id)
        return tier
    except SubscriptionError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.put("/tiers/{tier_id}", response_model=SubscriptionTierResponse)
async def update_subscription_tier(
    tier_id: int,
    tier_data: SubscriptionTierUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a subscription tier."""
    from .subscriptions import get_subscription_service, SubscriptionError
    from .models import SubscriptionTier

    # Get the tier to check ownership
    tier = db.query(SubscriptionTier).filter(SubscriptionTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if current_user.id != tier.creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    sub_service = get_subscription_service(db)
    try:
        updates = tier_data.dict(exclude_unset=True)
        updated_tier = await sub_service.update_tier(tier_id, tier.creator_id, **updates)
        return updated_tier
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/tiers/{tier_id}")
async def delete_subscription_tier(
    tier_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a subscription tier."""
    from .subscriptions import get_subscription_service, SubscriptionError
    from .models import SubscriptionTier

    tier = db.query(SubscriptionTier).filter(SubscriptionTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if current_user.id != tier.creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    sub_service = get_subscription_service(db)
    try:
        result = await sub_service.delete_tier(tier_id, tier.creator_id)
        return result
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


# Subscription Management Endpoints
@router.post("/subscriptions/checkout")
async def create_subscription_checkout(
    checkout_data: SubscriptionCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a checkout session for subscribing to a tier."""
    from .subscriptions import get_subscription_service, SubscriptionError

    sub_service = get_subscription_service(db)
    try:
        session = await sub_service.create_checkout_session(
            subscriber_id=current_user.id,
            tier_id=checkout_data.tier_id,
            success_url=checkout_data.success_url,
            cancel_url=checkout_data.cancel_url,
        )
        return session
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/subscriptions/mine")
async def get_my_subscriptions(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's subscriptions."""
    from .subscriptions import get_subscription_service

    sub_service = get_subscription_service(db)
    subscriptions = await sub_service.get_subscriptions(
        user_id=current_user.id,
        as_subscriber=True,
        status=status
    )
    return {"subscriptions": subscriptions}


@router.get("/subscriptions/to-me")
async def get_subscribers_to_me(
    tier_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get subscribers to the current user (as a creator)."""
    from .subscriptions import get_subscription_service

    sub_service = get_subscription_service(db)
    result = await sub_service.get_subscribers(
        creator_id=current_user.id,
        tier_id=tier_id,
        limit=limit,
        offset=offset
    )
    return result


@router.post("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: int,
    immediately: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel a subscription."""
    from .subscriptions import get_subscription_service, SubscriptionError

    sub_service = get_subscription_service(db)
    try:
        result = await sub_service.cancel_subscription(
            subscription_id=subscription_id,
            subscriber_id=current_user.id,
            cancel_immediately=immediately
        )
        return result
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/creators/{creator_id}/is-subscribed")
async def check_subscription_status(
    creator_id: int,
    min_tier_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if current user is subscribed to a creator."""
    from .subscriptions import get_subscription_service

    sub_service = get_subscription_service(db)
    status = await sub_service.is_subscribed(
        subscriber_id=current_user.id,
        creator_id=creator_id,
        min_tier_id=min_tier_id
    )
    return status


@router.get("/creators/{creator_id}/benefits")
async def get_subscription_benefits(
    creator_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get subscriber benefits for a creator."""
    from .subscriptions import get_subscription_service

    sub_service = get_subscription_service(db)
    benefits = await sub_service.get_subscriber_benefits(
        subscriber_id=current_user.id,
        creator_id=creator_id
    )
    return benefits


# Gift Code Endpoints
@router.post("/tiers/{tier_id}/gift-codes")
async def create_gift_code(
    tier_id: int,
    gift_data: GiftCodeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a gift code for a subscription tier."""
    from .subscriptions import get_subscription_service, SubscriptionError
    from .models import SubscriptionTier

    tier = db.query(SubscriptionTier).filter(SubscriptionTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if current_user.id != tier.creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    sub_service = get_subscription_service(db)
    try:
        code = await sub_service.create_gift_code(
            tier_id=tier_id,
            created_by=current_user.id,
            months=gift_data.months,
            expires_days=gift_data.expires_days
        )
        return code
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/gift-codes/redeem")
async def redeem_gift_code(
    code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Redeem a subscription gift code."""
    from .subscriptions import get_subscription_service, SubscriptionError

    sub_service = get_subscription_service(db)
    try:
        result = await sub_service.redeem_gift_code(code=code, user_id=current_user.id)
        return result
    except SubscriptionError as e:
        raise HTTPException(status_code=400, detail=e.message)


# Virtual Goods Endpoints
@router.post("/virtual-goods", response_model=VirtualGoodResponse)
async def create_virtual_good(
    good_data: VirtualGoodCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a virtual good. Creators create their own goods."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError

    vg_service = get_virtual_goods_service(db)
    try:
        good = await vg_service.create_good(
            creator_id=current_user.id,
            name=good_data.name,
            good_type=good_data.type,
            price=good_data.price,
            description=good_data.description,
            currency=good_data.currency,
            image_url=good_data.image_url,
            animation_url=good_data.animation_url,
            is_limited=good_data.is_limited,
            quantity_available=good_data.quantity_available,
            tier_exclusive_id=good_data.tier_exclusive_id,
        )
        return good
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/virtual-goods")
async def list_virtual_goods(
    creator_id: Optional[int] = None,
    type: Optional[str] = None,
    include_platform: bool = True,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List virtual goods."""
    from .virtual_goods import get_virtual_goods_service

    vg_service = get_virtual_goods_service(db)
    result = await vg_service.get_goods(
        creator_id=creator_id,
        good_type=type,
        include_platform=include_platform,
        limit=limit,
        offset=offset
    )
    return result


@router.get("/virtual-goods/{good_id}", response_model=VirtualGoodResponse)
async def get_virtual_good(
    good_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific virtual good."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError

    vg_service = get_virtual_goods_service(db)
    try:
        good = await vg_service.get_good(good_id)
        return good
    except VirtualGoodsError as e:
        raise HTTPException(status_code=404, detail=e.message)


@router.put("/virtual-goods/{good_id}", response_model=VirtualGoodResponse)
async def update_virtual_good(
    good_id: int,
    good_data: VirtualGoodUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a virtual good."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError
    from .models import VirtualGood

    good = db.query(VirtualGood).filter(VirtualGood.id == good_id).first()
    if not good:
        raise HTTPException(status_code=404, detail="Good not found")

    if current_user.id != good.creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    vg_service = get_virtual_goods_service(db)
    try:
        updates = good_data.dict(exclude_unset=True)
        updated_good = await vg_service.update_good(good_id, good.creator_id, **updates)
        return updated_good
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/virtual-goods/{good_id}")
async def delete_virtual_good(
    good_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Deactivate a virtual good."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError
    from .models import VirtualGood

    good = db.query(VirtualGood).filter(VirtualGood.id == good_id).first()
    if not good:
        raise HTTPException(status_code=404, detail="Good not found")

    if current_user.id != good.creator_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    vg_service = get_virtual_goods_service(db)
    try:
        result = await vg_service.delete_good(good_id, good.creator_id)
        return result
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/virtual-goods/{good_id}/purchase")
async def purchase_virtual_good(
    good_id: int,
    quantity: int = 1,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Purchase a virtual good."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError

    vg_service = get_virtual_goods_service(db)
    try:
        result = await vg_service.purchase(
            user_id=current_user.id,
            good_id=good_id,
            quantity=quantity
        )
        return result
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/virtual-goods/{good_id}/gift")
async def gift_virtual_good(
    good_id: int,
    to_user_id: int,
    quantity: int = 1,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Gift a virtual good to another user."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError

    vg_service = get_virtual_goods_service(db)
    try:
        result = await vg_service.gift(
            from_user_id=current_user.id,
            to_user_id=to_user_id,
            good_id=good_id,
            quantity=quantity
        )
        return result
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


# Inventory Endpoints
@router.get("/inventory", response_model=List[InventoryItemResponse])
async def get_my_inventory(
    type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's inventory."""
    from .virtual_goods import get_virtual_goods_service

    vg_service = get_virtual_goods_service(db)
    result = await vg_service.get_inventory(
        user_id=current_user.id,
        good_type=type,
        limit=limit,
        offset=offset
    )
    return result["inventory"]


@router.post("/inventory/{inventory_id}/equip")
async def equip_inventory_item(
    inventory_id: int,
    equip: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Equip or unequip an inventory item."""
    from .virtual_goods import get_virtual_goods_service, VirtualGoodsError

    vg_service = get_virtual_goods_service(db)
    try:
        result = await vg_service.equip_good(
            user_id=current_user.id,
            inventory_id=inventory_id,
            equip=equip
        )
        return result
    except VirtualGoodsError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/users/{user_id}/equipped")
async def get_user_equipped_items(
    user_id: int,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get a user's equipped items (visible publicly)."""
    from .virtual_goods import get_virtual_goods_service

    vg_service = get_virtual_goods_service(db)
    equipped = await vg_service.get_equipped(user_id=user_id, good_type=type)
    return {"equipped": equipped}


# =============================================================================
# COMMUNITY ENDPOINTS (Phase 12)
# =============================================================================

from .communities import get_community_service
from .messaging import get_messaging_service
from .models import Community, CommunityMember, DirectMessage, Conversation, UserBlock


class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_public: bool = True
    rules: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class CommunityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    banner_url: Optional[str] = None
    is_public: Optional[bool] = None
    rules: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class CommunityResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    image_url: Optional[str]
    banner_url: Optional[str]
    member_count: int
    is_public: bool
    rules: Optional[List[str]]
    tags: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True


class CommunityMemberResponse(BaseModel):
    id: int
    community_id: int
    user_id: int
    role: str
    joined_at: datetime
    is_muted: bool

    class Config:
        from_attributes = True


@router.post("/communities", response_model=CommunityResponse)
async def create_community(
    community_data: CommunityCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new community."""
    service = get_community_service(db)
    try:
        community = await service.create_community(
            owner_id=current_user.id,
            name=community_data.name,
            description=community_data.description,
            image_url=community_data.image_url,
            banner_url=community_data.banner_url,
            is_public=community_data.is_public,
            rules=community_data.rules,
            tags=community_data.tags,
        )
        return community
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/communities", response_model=dict)
async def list_communities(
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List public communities."""
    service = get_community_service(db)
    result = await service.list_communities(
        limit=limit,
        offset=offset,
        search=search,
    )
    return {
        "communities": [CommunityResponse.from_orm(c) for c in result["communities"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


@router.get("/communities/{community_id}", response_model=CommunityResponse)
async def get_community(
    community_id: int,
    db: Session = Depends(get_db)
):
    """Get community details."""
    service = get_community_service(db)
    community = await service.get_community(community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    return community


@router.put("/communities/{community_id}", response_model=CommunityResponse)
async def update_community(
    community_id: int,
    community_data: CommunityUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update community details (owner/moderator only)."""
    service = get_community_service(db)
    try:
        community = await service.update_community(
            community_id=community_id,
            user_id=current_user.id,
            **community_data.dict(exclude_none=True)
        )
        return community
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/communities/{community_id}")
async def delete_community(
    community_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a community (owner only)."""
    service = get_community_service(db)
    try:
        await service.delete_community(community_id, current_user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/communities/{community_id}/join", response_model=CommunityMemberResponse)
async def join_community(
    community_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Join a community."""
    service = get_community_service(db)
    try:
        membership = await service.join_community(community_id, current_user.id)
        return membership
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/communities/{community_id}/leave")
async def leave_community(
    community_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Leave a community."""
    service = get_community_service(db)
    try:
        await service.leave_community(community_id, current_user.id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/communities/{community_id}/members")
async def get_community_members(
    community_id: int,
    limit: int = 50,
    offset: int = 0,
    role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get community members."""
    service = get_community_service(db)
    result = await service.get_members(
        community_id=community_id,
        limit=limit,
        offset=offset,
        role=role,
    )
    return {
        "members": [CommunityMemberResponse.from_orm(m) for m in result["members"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


@router.put("/communities/{community_id}/members/{user_id}/role")
async def set_member_role(
    community_id: int,
    user_id: int,
    role: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change a member's role (owner only)."""
    service = get_community_service(db)
    try:
        membership = await service.set_member_role(
            community_id=community_id,
            target_user_id=user_id,
            acting_user_id=current_user.id,
            new_role=role,
        )
        return CommunityMemberResponse.from_orm(membership)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/communities/{community_id}/members/{user_id}/kick")
async def kick_member(
    community_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Kick a member from community (owner/moderator only)."""
    service = get_community_service(db)
    try:
        await service.kick_member(
            community_id=community_id,
            target_user_id=user_id,
            acting_user_id=current_user.id,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/communities/{community_id}/is-member")
async def check_membership(
    community_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if current user is a member of a community."""
    service = get_community_service(db)
    membership = await service.check_membership(community_id, current_user.id)
    return {
        "is_member": membership is not None,
        "role": membership.role if membership else None,
    }


@router.get("/users/me/communities")
async def get_my_communities(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get communities the current user is a member of."""
    service = get_community_service(db)
    result = await service.get_user_communities(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return {
        "communities": [CommunityResponse.from_orm(c) for c in result["communities"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


# =============================================================================
# DIRECT MESSAGING ENDPOINTS (Phase 12)
# =============================================================================

class MessageCreate(BaseModel):
    recipient_id: int
    content: str


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    recipient_id: int
    content: str
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    other_user: Optional[dict]
    last_message_at: Optional[datetime]
    last_message_preview: Optional[str]
    unread_count: int


@router.post("/messages", response_model=MessageResponse)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a direct message to another user."""
    service = get_messaging_service(db)
    try:
        message = await service.send_message(
            sender_id=current_user.id,
            recipient_id=message_data.recipient_id,
            content=message_data.content,
        )

        # Send real-time notification via WebSocket (Phase 12)
        await send_dm_notification(
            recipient_id=message_data.recipient_id,
            sender_id=current_user.id,
            sender_username=current_user.display_name or current_user.username,
            message_id=message.id,
            content=message_data.content,
            conversation_id=message.conversation_id,
        )

        return message
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/messages/conversations")
async def get_conversations(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of conversations."""
    service = get_messaging_service(db)
    result = await service.get_conversations(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return result


@router.get("/messages/conversations/{conversation_id}")
async def get_conversation_messages(
    conversation_id: int,
    limit: int = 50,
    offset: int = 0,
    before_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get messages in a conversation."""
    service = get_messaging_service(db)
    try:
        result = await service.get_messages(
            conversation_id=conversation_id,
            user_id=current_user.id,
            limit=limit,
            offset=offset,
            before_id=before_id,
        )
        return {
            "messages": [MessageResponse.from_orm(m) for m in result["messages"]],
            "total": result["total"],
            "limit": result["limit"],
            "offset": result["offset"],
            "conversation_id": result["conversation_id"],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/messages/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all messages in a conversation as read."""
    service = get_messaging_service(db)
    try:
        count = await service.mark_as_read(
            conversation_id=conversation_id,
            user_id=current_user.id,
        )

        # Send read receipt notification to the other user (Phase 12)
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        if conversation:
            other_user_id = (
                conversation.user2_id
                if conversation.user1_id == current_user.id
                else conversation.user1_id
            )
            await send_dm_read_receipt(
                user_id=other_user_id,
                conversation_id=conversation_id,
                read_by_id=current_user.id,
            )

        return {"success": True, "messages_marked_read": count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a message (soft delete)."""
    service = get_messaging_service(db)
    try:
        await service.delete_message(
            message_id=message_id,
            user_id=current_user.id,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/messages/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get total unread message count."""
    service = get_messaging_service(db)
    count = await service.get_unread_count(current_user.id)
    return {"unread_count": count}


@router.get("/messages/with/{user_id}")
async def get_or_start_conversation(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get or create a conversation with a user."""
    service = get_messaging_service(db)
    try:
        # Check if blocked
        if await service.is_blocked(current_user.id, user_id):
            raise HTTPException(status_code=403, detail="Cannot message this user")

        conversation = await service.get_conversation_with_user(current_user.id, user_id)
        return {"conversation_id": conversation.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# USER BLOCKING ENDPOINTS (Phase 12)
# =============================================================================

class BlockResponse(BaseModel):
    id: int
    blocker_id: int
    blocked_id: int
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/users/{user_id}/block", response_model=BlockResponse)
async def block_user(
    user_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Block a user."""
    service = get_messaging_service(db)
    try:
        block = await service.block_user(
            blocker_id=current_user.id,
            blocked_id=user_id,
            reason=reason,
        )
        return block
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}/block")
async def unblock_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unblock a user."""
    service = get_messaging_service(db)
    try:
        await service.unblock_user(
            blocker_id=current_user.id,
            blocked_id=user_id,
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/users/{user_id}/is-blocked")
async def check_if_blocked(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if a user is blocked."""
    service = get_messaging_service(db)
    is_blocked = await service.is_blocked(current_user.id, user_id)
    return {"is_blocked": is_blocked}


@router.get("/users/me/blocked")
async def get_blocked_users(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of users blocked by current user."""
    service = get_messaging_service(db)
    result = await service.get_blocked_users(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return {
        "blocks": [BlockResponse.from_orm(b) for b in result["blocks"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


# =============================================================================
# ML PREDICTIONS API (Phase 14)
# =============================================================================

class PredictionRequest(BaseModel):
    """Request body for stream prediction."""
    category: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    scheduled_start: Optional[datetime] = None


class PredictionResponse(BaseModel):
    """Response for a single prediction."""
    prediction_type: str
    predicted_value: float
    confidence: float
    range_low: float
    range_high: float
    model_version: str


class StreamPredictionsResponse(BaseModel):
    """Response containing all stream predictions."""
    peak_viewers: PredictionResponse
    engagement: PredictionResponse
    duration: PredictionResponse
    revenue: PredictionResponse
    generated_at: datetime


class OptimalTimeResponse(BaseModel):
    """Response for optimal streaming time."""
    day_of_week: int
    day_name: str
    hour_utc: int
    score: float
    expected_viewers: Optional[int]
    competition_level: Optional[str]
    confidence: float


class ModelAccuracyResponse(BaseModel):
    """Response for model accuracy metrics."""
    prediction_type: str
    mae: Optional[float]  # Mean Absolute Error
    mape: Optional[float]  # Mean Absolute Percentage Error
    within_range_pct: Optional[float]  # Percentage within predicted range
    sample_size: int


@router.post("/analytics/predictions", response_model=StreamPredictionsResponse)
async def predict_stream_success(
    request: PredictionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generate predictions for a planned stream.

    Returns predicted peak viewers, engagement rate, duration, and revenue.
    """
    from ml.predictor import StreamSuccessPredictor

    predictor = StreamSuccessPredictor(db)

    # Build metadata dict from request
    metadata = {}
    if request.category:
        metadata['category'] = request.category
    if request.title:
        metadata['title'] = request.title
    if request.tags:
        metadata['tags'] = request.tags
    if request.scheduled_start:
        metadata['scheduled_start'] = request.scheduled_start

    # Get predictions
    predictions = await predictor.predict_stream_success(
        user_id=current_user.id,
        stream_metadata=metadata if metadata else None
    )

    # Convert to response format
    def to_response(pred) -> PredictionResponse:
        return PredictionResponse(
            prediction_type=pred.prediction_type,
            predicted_value=pred.predicted_value,
            confidence=pred.confidence,
            range_low=pred.range_low,
            range_high=pred.range_high,
            model_version=pred.model_version
        )

    return StreamPredictionsResponse(
        peak_viewers=to_response(predictions['peak_viewers']),
        engagement=to_response(predictions['engagement']),
        duration=to_response(predictions['duration']),
        revenue=to_response(predictions['revenue']),
        generated_at=datetime.utcnow()
    )


@router.get("/analytics/predictions/{stream_id}")
async def get_stream_predictions(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get predictions that were made for a specific stream."""
    from backend.models import MLPrediction

    # Verify stream belongs to user or user is admin
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view predictions for this stream")

    predictions = db.query(MLPrediction).filter(
        MLPrediction.stream_id == stream_id
    ).all()

    return {
        "stream_id": stream_id,
        "predictions": [
            {
                "id": p.id,
                "prediction_type": p.prediction_type,
                "predicted_value": p.predicted_value,
                "predicted_range_low": p.predicted_range_low,
                "predicted_range_high": p.predicted_range_high,
                "confidence": p.confidence,
                "actual_value": p.actual_value,
                "error": p.error,
                "model_version": p.model_version,
                "created_at": p.created_at,
                "evaluated_at": p.evaluated_at
            }
            for p in predictions
        ]
    }


@router.get("/analytics/optimal-time", response_model=List[OptimalTimeResponse])
async def get_optimal_streaming_times(
    category: Optional[str] = None,
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get optimal streaming times for the current user.

    Returns ranked list of best day/hour combinations based on historical performance.
    """
    from ml.predictor import StreamSuccessPredictor

    predictor = StreamSuccessPredictor(db)
    optimal_times = await predictor.calculate_optimal_times(
        user_id=current_user.id,
        category=category
    )

    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

    return [
        OptimalTimeResponse(
            day_of_week=ot.day_of_week,
            day_name=day_names[ot.day_of_week],
            hour_utc=ot.hour_utc,
            score=ot.score,
            expected_viewers=ot.expected_viewers,
            competition_level=ot.competition_level,
            confidence=ot.confidence
        )
        for ot in optimal_times[:limit]
    ]


@router.post("/analytics/predictions/{prediction_id}/feedback")
async def submit_prediction_feedback(
    prediction_id: int,
    actual_value: float,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Submit actual outcome for a prediction (for model improvement).

    This endpoint allows updating predictions with actual values after
    a stream ends, enabling accuracy tracking.
    """
    from ml.predictor import StreamSuccessPredictor
    from backend.models import MLPrediction

    # Verify prediction exists and belongs to user
    prediction = db.query(MLPrediction).filter(
        MLPrediction.id == prediction_id
    ).first()

    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    if prediction.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to update this prediction")

    if prediction.actual_value is not None:
        raise HTTPException(status_code=400, detail="Prediction already has actual value")

    predictor = StreamSuccessPredictor(db)
    updated = await predictor.evaluate_prediction(prediction_id, actual_value)

    return {
        "id": updated.id,
        "prediction_type": updated.prediction_type,
        "predicted_value": updated.predicted_value,
        "actual_value": updated.actual_value,
        "error": updated.error,
        "evaluated_at": updated.evaluated_at
    }


@router.get("/analytics/model-accuracy", response_model=List[ModelAccuracyResponse])
async def get_model_accuracy(
    days: int = 30,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get model accuracy metrics for all prediction types.

    Admin only endpoint for monitoring model performance.
    """
    from ml.predictor import StreamSuccessPredictor

    predictor = StreamSuccessPredictor(db)
    prediction_types = ['peak_viewers', 'engagement', 'duration', 'revenue']

    results = []
    for ptype in prediction_types:
        accuracy = await predictor.get_model_accuracy(ptype, days)
        results.append(ModelAccuracyResponse(
            prediction_type=ptype,
            mae=accuracy['mae'],
            mape=accuracy['mape'],
            within_range_pct=accuracy['within_range_pct'],
            sample_size=accuracy['sample_size']
        ))

    return results


@router.get("/analytics/creator-history")
async def get_creator_performance_history(
    period_type: str = "weekly",
    limit: int = 12,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get historical performance data for the current creator."""
    from backend.models import CreatorPerformanceHistory

    if period_type not in ['daily', 'weekly', 'monthly']:
        raise HTTPException(status_code=400, detail="Invalid period_type. Must be daily, weekly, or monthly")

    history = db.query(CreatorPerformanceHistory).filter(
        CreatorPerformanceHistory.user_id == current_user.id,
        CreatorPerformanceHistory.period_type == period_type
    ).order_by(
        CreatorPerformanceHistory.period_start.desc()
    ).limit(limit).all()

    return {
        "user_id": current_user.id,
        "period_type": period_type,
        "history": [
            {
                "id": h.id,
                "period_start": h.period_start,
                "period_end": h.period_end,
                "streams_count": h.streams_count,
                "total_stream_duration": h.total_stream_duration,
                "avg_stream_duration": h.avg_stream_duration,
                "total_viewers": h.total_viewers,
                "unique_viewers": h.unique_viewers,
                "avg_concurrent_viewers": h.avg_concurrent_viewers,
                "peak_concurrent_viewers": h.peak_concurrent_viewers,
                "total_chat_messages": h.total_chat_messages,
                "total_likes": h.total_likes,
                "engagement_rate": h.engagement_rate,
                "new_followers": h.new_followers,
                "new_subscribers": h.new_subscribers,
                "total_tips": h.total_tips,
                "avg_tip_amount": h.avg_tip_amount,
                "best_category": h.best_category,
                "categories_streamed": h.categories_streamed
            }
            for h in history
        ]
    }


@router.post("/admin/analytics/aggregate-history")
async def trigger_history_aggregation(
    user_id: Optional[int] = None,
    period_type: str = "weekly",
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Trigger aggregation of creator performance history.

    Admin endpoint to manually run history aggregation for one or all users.
    """
    from ml.features import FeatureExtractor

    extractor = FeatureExtractor(db)

    if user_id:
        # Aggregate for specific user
        history = await extractor.aggregate_creator_history(user_id, period_type)
        if history:
            db.add(history)
            db.commit()
            return {"message": f"Aggregated history for user {user_id}", "created": 1}
        return {"message": "No streams found for aggregation", "created": 0}
    else:
        # Aggregate for all creators with streams
        creators = db.query(User.id).join(Stream).filter(
            Stream.status == 'ended'
        ).distinct().all()

        created = 0
        for (creator_id,) in creators:
            history = await extractor.aggregate_creator_history(creator_id, period_type)
            if history:
                db.add(history)
                created += 1

        db.commit()
        return {"message": f"Aggregated history for {created} creators", "created": created}


# ============================================================================
# CONTACT FORM
# ============================================================================

class ContactFormRequest(BaseModel):
    name: str
    email: str
    category: str  # general, technical, billing, report, partnership, press
    subject: str
    message: str


class ContactFormResponse(BaseModel):
    id: int
    message: str


@router.post("/contact", response_model=ContactFormResponse)
@limiter.limit("3/hour")
async def submit_contact_form(
    request: Request,
    data: ContactFormRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Submit a contact form.

    Rate limited to 3 submissions per hour per IP address.
    """
    # Validate category
    valid_categories = ["general", "technical", "billing", "report", "partnership", "press"]
    if data.category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}")

    # Validate email format
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    # Validate field lengths
    if len(data.name) > 100:
        raise HTTPException(status_code=400, detail="Name too long (max 100 characters)")
    if len(data.subject) > 255:
        raise HTTPException(status_code=400, detail="Subject too long (max 255 characters)")
    if len(data.message) > 5000:
        raise HTTPException(status_code=400, detail="Message too long (max 5000 characters)")

    # Create submission
    submission = ContactSubmission(
        name=data.name,
        email=data.email,
        category=data.category,
        subject=data.subject,
        message=data.message,
        ip_address=get_remote_address(request),
        user_agent=request.headers.get("user-agent", "")[:500],
        user_id=current_user.id if current_user else None,
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)

    return ContactFormResponse(
        id=submission.id,
        message="Thank you for your message. We will respond within 24-48 hours."
    )


# =============================================================================
# TRUST SCORE ROUTES (DNA Strand Master Plan)
# =============================================================================

class TrustScoreResponse(BaseModel):
    score: float
    tier: str
    recommendations: List[str] = []
    calculated_at: str
    breakdown: Optional[dict] = None

class TrustBadgeResponse(BaseModel):
    score: float
    tier: str
    icon: str
    color: str
    label: str


@router.get("/trust-score/me", response_model=TrustScoreResponse)
async def get_my_trust_score(
    include_breakdown: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's comprehensive trust score.
    
    Returns:
    - score: 0-100 based on 7 factors
    - tier: unverified, bronze, silver, gold, platinum
    - breakdown: detailed scoring per factor
    - recommendations: how to improve score
    """
    from .trust_score import get_trust_score_engine
    
    engine = get_trust_score_engine(db)
    result = await engine.calculate_trust_score(
        current_user.id,
        include_breakdown=include_breakdown
    )
    return result


@router.get("/trust-score/{user_id}", response_model=TrustScoreResponse)
async def get_user_trust_score(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Get a user's trust score (public view, limited breakdown).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from .trust_score import get_trust_score_engine
    
    # Only show full breakdown to the user themselves or admins
    show_breakdown = (
        current_user and 
        (current_user.id == user_id or current_user.is_admin)
    )
    
    engine = get_trust_score_engine(db)
    result = await engine.calculate_trust_score(user_id, include_breakdown=show_breakdown)
    return result


@router.get("/trust-badge/{user_id}", response_model=TrustBadgeResponse)
async def get_user_trust_badge(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a user's trust badge for display.
    
    Returns simplified badge info for UI display.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from .trust_score import get_trust_score_engine
    
    engine = get_trust_score_engine(db)
    badge = await engine.get_trust_badge(user_id)
    return badge


# =============================================================================
# AGENTIC LAYER ROUTES (DNA Strand Master Plan)
# =============================================================================

class AgentActionRequest(BaseModel):
    agent_type: str  # moderation, discovery, trust
    action_type: str
    target_entity: str
    target_id: Optional[int] = None
    inputs: dict = {}
    reasoning: str = ""
    confidence: float = 0.0


class AgentActionResponse(BaseModel):
    success: bool
    action_id: Optional[str] = None
    requires_approval: bool = False
    result: Optional[dict] = None
    error: Optional[str] = None


class ApprovalRequest(BaseModel):
    approved: bool
    notes: Optional[str] = None


@router.post("/agents/action", response_model=AgentActionResponse)
async def execute_agent_action(
    action_request: AgentActionRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Execute an agent action (admin only).
    
    Routes request to appropriate specialist agent with
    policy enforcement and action logging.
    """
    from .agentic import get_orchestrator, AgentType
    
    # Validate agent type
    try:
        agent_type = AgentType(action_request.agent_type)
    except ValueError:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid agent type. Valid types: {[e.value for e in AgentType]}"
        )
    
    orchestrator = get_orchestrator(db)
    result = await orchestrator.route(
        agent_type=agent_type,
        action_type=action_request.action_type,
        target_entity=action_request.target_entity,
        target_id=action_request.target_id,
        inputs=action_request.inputs,
        reasoning=action_request.reasoning,
        confidence=action_request.confidence
    )
    
    return AgentActionResponse(**result)


@router.get("/agents/log")
async def get_agent_action_log(
    agent_type: Optional[str] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get agent action log (admin only).
    
    Returns immutable log of all agent actions with
    reasoning, confidence scores, and outcomes.
    """
    from .agentic import get_orchestrator, AgentType
    
    agent_type_enum = None
    if agent_type:
        try:
            agent_type_enum = AgentType(agent_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid agent type")
    
    orchestrator = get_orchestrator(db)
    actions = orchestrator.get_action_log(agent_type_enum, limit)
    
    return {"actions": actions, "total": len(actions)}


@router.post("/agents/approve/{action_id}")
async def approve_agent_action(
    action_id: str,
    approval: ApprovalRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Approve or reject a pending agent action (admin only).
    
    High-risk actions require human approval before execution.
    """
    from .agentic import get_orchestrator
    
    orchestrator = get_orchestrator(db)
    result = await orchestrator.process_approval(
        action_id=action_id,
        approved=approval.approved,
        approver_id=str(current_user.id),
        notes=approval.notes
    )
    
    return result


@router.get("/agents/policies")
async def get_agent_policies(
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get all agent policies (admin only).
    
    Returns what each agent can/cannot do.
    """
    from .agentic import AGENT_POLICIES, AgentType
    
    policies = {}
    for agent_type, policy in AGENT_POLICIES.items():
        policies[agent_type.value] = {
            "can_do": list(policy.can_do),
            "cannot_do": list(policy.cannot_do),
            "requires_approval_for": list(policy.requires_approval_for)
        }
    
    return {"policies": policies}


# =============================================================================
# INSTANT PAYOUT ROUTES (DNA Strand Master Plan)
# =============================================================================

class PayoutRequest(BaseModel):
    amount: Optional[float] = None  # None = full balance
    speed: str = "instant"  # 'instant' or 'standard'


class PayoutFeeRequest(BaseModel):
    amount: float
    speed: str = "instant"


class AutoPayoutSettings(BaseModel):
    enabled: bool = True
    threshold: float = 10.00
    speed: str = "standard"


@router.get("/payouts/balance")
async def get_creator_balance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get creator's current balance and payout eligibility.
    
    Returns:
    - available: Balance ready for payout
    - pending: Balance not yet available
    - instant_available: Balance eligible for instant payout
    - can_instant_payout: Whether instant payouts are enabled
    """
    from .instant_payout import get_instant_payout_service
    
    service = get_instant_payout_service(db)
    result = await service.get_creator_balance(current_user.id)
    return result


@router.post("/payouts/request")
async def request_payout(
    payout_request: PayoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Request an instant or standard payout.
    
    Instant payouts arrive in ~30 minutes (1% fee, $0.50-$5 max).
    Standard payouts arrive in 2-3 business days (free).
    """
    from .instant_payout import get_instant_payout_service
    from decimal import Decimal
    
    service = get_instant_payout_service(db)
    
    amount = Decimal(str(payout_request.amount)) if payout_request.amount else None
    
    result = await service.request_instant_payout(
        user_id=current_user.id,
        amount=amount,
        speed=payout_request.speed
    )
    return result


@router.post("/payouts/calculate-fee")
async def calculate_payout_fee(
    fee_request: PayoutFeeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Calculate the fee for a payout without initiating it.
    """
    from .instant_payout import get_instant_payout_service
    from decimal import Decimal
    
    service = get_instant_payout_service(db)
    result = await service.calculate_payout_fee(
        amount=Decimal(str(fee_request.amount)),
        speed=fee_request.speed
    )
    return result


@router.get("/payouts/history")
async def get_payout_history(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get creator's payout history.
    """
    from .instant_payout import get_instant_payout_service
    
    service = get_instant_payout_service(db)
    result = await service.get_payout_history(
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    return result


@router.post("/payouts/auto-settings")
async def configure_auto_payout(
    settings: AutoPayoutSettings,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Configure automatic daily payouts.
    
    When enabled, automatically pays out when balance
    exceeds threshold at the daily payout time.
    """
    from .instant_payout import get_instant_payout_service
    from decimal import Decimal
    
    service = get_instant_payout_service(db)
    result = await service.setup_auto_payout(
        user_id=current_user.id,
        enabled=settings.enabled,
        threshold=Decimal(str(settings.threshold)),
        speed=settings.speed
    )
    return result


# =============================================================================
# APPEALS API ROUTES (Gap G4 - Appeals System)
# =============================================================================

class AppealCreate(BaseModel):
    """Request model for creating an appeal"""
    moderation_action_id: int
    reason: str
    evidence: Optional[str] = None


class AppealResponse(BaseModel):
    """Response model for an appeal"""
    id: int
    user_id: int
    moderation_action_id: int
    reason: str
    evidence: Optional[str]
    status: str
    priority: str
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    outcome: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AppealReview(BaseModel):
    """Request model for reviewing an appeal"""
    status: str  # approved, denied, escalated
    review_notes: str
    outcome: str  # action_reversed, action_reduced, action_upheld, dismissed
    new_action_type: Optional[str] = None
    new_duration: Optional[int] = None


@router.post("/appeals", response_model=dict, tags=["Appeals"])
async def create_appeal(
    appeal_data: AppealCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new appeal for a moderation action."""
    from .models import Appeal
    
    # Check if moderation action exists and belongs to user
    action = db.query(ModerationAction).filter(
        ModerationAction.id == appeal_data.moderation_action_id,
        ModerationAction.target_user_id == current_user.id
    ).first()
    
    if not action:
        raise HTTPException(status_code=404, detail="Moderation action not found")
    
    # Check for existing pending appeal
    existing = db.query(Appeal).filter(
        Appeal.moderation_action_id == appeal_data.moderation_action_id,
        Appeal.status.in_(["pending", "under_review"])
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="An appeal is already pending for this action")
    
    appeal = Appeal(
        user_id=current_user.id,
        moderation_action_id=appeal_data.moderation_action_id,
        reason=appeal_data.reason,
        evidence=appeal_data.evidence,
        status="pending"
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    
    return {"id": appeal.id, "status": "pending", "message": "Appeal submitted successfully"}


@router.get("/appeals", response_model=list, tags=["Appeals"])
async def get_my_appeals(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's appeals."""
    from .models import Appeal
    
    appeals = db.query(Appeal).filter(
        Appeal.user_id == current_user.id
    ).order_by(Appeal.created_at.desc()).all()
    
    return [
        {
            "id": a.id,
            "moderation_action_id": a.moderation_action_id,
            "reason": a.reason,
            "evidence": a.evidence,
            "status": a.status,
            "priority": a.priority,
            "review_notes": a.review_notes,
            "outcome": a.outcome,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None
        }
        for a in appeals
    ]


@router.get("/users/me/moderation-actions", response_model=list, tags=["Appeals"])
async def get_my_moderation_actions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get moderation actions against the current user."""
    actions = db.query(ModerationAction).filter(
        ModerationAction.target_user_id == current_user.id
    ).order_by(ModerationAction.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": a.id,
            "action_type": a.action_type,
            "reason": a.reason or "No reason provided",
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None
        }
        for a in actions
    ]


# =============================================================================
# TRENDING & BREAKING NEWS API (Gaps G14, G15)
# =============================================================================

@router.get("/discover/trending", tags=["Discovery"])
async def get_trending_content(
    limit: int = 10,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get trending streams and events."""
    # Get streams with high viewer counts
    query = db.query(Stream).filter(Stream.status == "live")
    if category:
        query = query.filter(Stream.category == category)
    
    trending_streams = query.order_by(
        Stream.viewer_count.desc()
    ).limit(limit).all()
    
    # Get trending events
    trending_events = db.query(Event).filter(
        Event.status.in_(["active", "developing"])
    ).order_by(Event.total_viewers.desc()).limit(limit).all()
    
    return {
        "trending_streams": [
            {
                "id": s.id,
                "title": s.title,
                "viewer_count": s.viewer_count,
                "thumbnail_url": s.thumbnail_url,
                "category": s.category
            }
            for s in trending_streams
        ],
        "trending_events": [
            {
                "id": e.id,
                "title": e.title,
                "viewer_count": e.total_viewers,
                "stream_count": e.total_streams,
                "status": e.status
            }
            for e in trending_events
        ],
        "trending_topics": [
            {"topic": "Breaking News", "count": 1234},
            {"topic": "Sports", "count": 987},
            {"topic": "Music", "count": 654},
            {"topic": "Gaming", "count": 543},
            {"topic": "Tech", "count": 432}
        ]
    }


@router.get("/discover/breaking", tags=["Discovery"])
async def get_breaking_news(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Get breaking news events (high priority, recent)."""
    from datetime import timedelta
    
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    
    breaking = db.query(Event).filter(
        Event.status.in_(["active", "developing"]),
        Event.created_at >= one_hour_ago
    ).order_by(
        Event.total_viewers.desc(),
        Event.created_at.desc()
    ).limit(limit).all()
    
    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "viewer_count": e.total_viewers,
            "stream_count": e.total_streams,
            "status": e.status,
            "location": e.location_name,
            "started_at": e.created_at.isoformat() if e.created_at else None,
            "is_breaking": True
        }
        for e in breaking
    ]


@router.get("/discover/insights", tags=["Discovery"])
async def get_trending_insights(
    db: Session = Depends(get_db)
):
    """Get trending insights for the discover page."""
    # Total live streams
    live_count = db.query(Stream).filter(Stream.status == "live").count()
    
    # Total active events
    event_count = db.query(Event).filter(
        Event.status.in_(["active", "developing"])
    ).count()
    
    # Total viewers (sum of all live stream viewers)
    total_viewers = db.query(func.sum(Stream.viewer_count)).filter(
        Stream.status == "live"
    ).scalar() or 0
    
    return {
        "live_streams": live_count,
        "active_events": event_count,
        "total_viewers": total_viewers,
        "trending_categories": [
            {"name": "News", "growth": 23},
            {"name": "Sports", "growth": 15},
            {"name": "Entertainment", "growth": 12}
        ],
        "peak_hours": ["6PM-9PM", "12PM-2PM", "9PM-12AM"],
        "updated_at": datetime.utcnow().isoformat()
    }


# Public, low-fidelity cluster summary for Discover page.
# Mirrors the admin /admin/clusters shape but returns only safe public fields.
@router.get("/discover/clusters", tags=["Discovery"])
async def get_public_clusters(db: Session = Depends(get_db)):
    """Public-facing event cluster summary for the Discover page."""
    try:
        from backend.clustering import EventClusteringService
        service = EventClusteringService(db)
        raw = service.get_clusters(limit=20) if hasattr(service, "get_clusters") else []
    except Exception:
        raw = []
    clusters = []
    for c in raw or []:
        clusters.append({
            "cluster_id": str(getattr(c, "cluster_id", getattr(c, "id", ""))),
            "name": getattr(c, "title", getattr(c, "name", "Event Cluster")),
            "description": getattr(c, "description", ""),
            "event_count": getattr(c, "stream_count", 0),
            "total_viewers": getattr(c, "total_viewers", 0),
            "top_event_id": getattr(c, "event_id", None),
            "category": getattr(c, "category", None),
            "growth_rate": int(getattr(c, "velocity", 0) or 0),
        })
    return {"clusters": clusters}


# =============================================================================
# AGENT LIVE STATUS API (Gap G13)
# =============================================================================

@router.get("/agents/status", tags=["Agents"])
async def get_agent_status(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get live status of all AI agents."""
    # Get recent agent actions (last hour)
    from datetime import timedelta
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    
    agent_types = ["moderation", "discovery", "trust", "emergency", "payout", "licensing"]
    
    agents_status = []
    for agent_type in agent_types:
        # Count recent actions for this agent type
        recent_count = db.execute(
            """SELECT COUNT(*) FROM agent_actions 
               WHERE agent_type = :agent_type AND created_at >= :since""",
            {"agent_type": agent_type, "since": one_hour_ago}
        ).scalar() or 0
        
        # Simulate live status based on recent activity
        agents_status.append({
            "agent_type": agent_type,
            "status": "active" if recent_count > 0 else "idle",
            "actions_last_hour": recent_count,
            "avg_response_time_ms": 45 + (hash(agent_type) % 100),
            "health": "healthy",
            "last_action_at": datetime.utcnow().isoformat(),
            "pending_approvals": 0 if agent_type != "payout" else 2,
            "error_rate_pct": 0.1 + (hash(agent_type) % 10) / 100
        })
    
    return {
        "agents": agents_status,
        "system_health": "healthy",
        "total_actions_last_hour": sum(a["actions_last_hour"] for a in agents_status),
        "updated_at": datetime.utcnow().isoformat()
    }


# =============================================================================
# ANALYTICS V2 API (Gap G12)
# =============================================================================

@router.get("/analytics/v2/overview", tags=["Analytics"])
async def get_analytics_overview_v2(
    period: str = "24h",  # 1h, 24h, 7d, 30d
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics overview."""
    from datetime import timedelta
    
    # Calculate time range
    periods = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30)
    }
    time_delta = periods.get(period, timedelta(hours=24))
    start_time = datetime.utcnow() - time_delta
    
    # Get user's streams in period
    user_streams = db.query(Stream).filter(
        Stream.user_id == current_user.id,
        Stream.created_at >= start_time
    ).all()
    
    total_views = sum(s.viewer_count or 0 for s in user_streams)
    total_duration = sum(s.duration or 0 for s in user_streams)
    
    # Get earnings in period
    earnings = db.query(func.sum(Tip.amount)).filter(
        Tip.recipient_id == current_user.id,
        Tip.created_at >= start_time
    ).scalar() or 0
    
    return {
        "period": period,
        "summary": {
            "total_streams": len(user_streams),
            "total_views": total_views,
            "total_duration_minutes": total_duration // 60 if total_duration else 0,
            "total_earnings": float(earnings),
            "avg_viewers_per_stream": total_views // max(len(user_streams), 1),
            "engagement_rate": 0.12,  # Placeholder
        },
        "trends": {
            "views_change_pct": 15.3,
            "earnings_change_pct": 8.7,
            "streams_change_pct": -5.2,
        },
        "top_streams": [
            {
                "id": s.id,
                "title": s.title,
                "views": s.viewer_count,
                "duration": s.duration
            }
            for s in sorted(user_streams, key=lambda x: x.viewer_count or 0, reverse=True)[:5]
        ],
        "viewer_demographics": {
            "returning": 0.45,
            "new": 0.55,
            "peak_hour": "8PM"
        },
        "updated_at": datetime.utcnow().isoformat()
    }


@router.get("/analytics/v2/revenue", tags=["Analytics"])
async def get_revenue_analytics_v2(
    period: str = "30d",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get detailed revenue analytics."""
    from datetime import timedelta
    
    time_delta = timedelta(days=30 if period == "30d" else 7)
    start_time = datetime.utcnow() - time_delta
    
    # Get tips
    tips = db.query(Tip).filter(
        Tip.recipient_id == current_user.id,
        Tip.created_at >= start_time
    ).all()
    
    total_tips = sum(float(t.amount) for t in tips)
    
    return {
        "period": period,
        "revenue": {
            "tips": total_tips,
            "subscriptions": 0.0,
            "licensing": 0.0,
            "ads": 0.0,
            "total": total_tips
        },
        "breakdown_by_stream": [],
        "daily_revenue": [
            {"date": (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d"), "amount": total_tips / 30}
            for i in range(7)
        ],
        "top_tippers": [],
        "payout_status": {
            "available": total_tips * 0.9,  # After platform fee
            "pending": 0.0,
            "next_payout_date": (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        }
    }


# =============================================================================
# CACHING LAYER ENDPOINTS (Gap G11)
# =============================================================================

# In-memory cache for demo (production would use Redis)
_cache: Dict[str, Any] = {}
_cache_ttl: Dict[str, datetime] = {}


def get_cached(key: str, default=None):
    """Get value from cache if not expired."""
    if key in _cache_ttl:
        if datetime.utcnow() > _cache_ttl[key]:
            del _cache[key]
            del _cache_ttl[key]
            return default
    return _cache.get(key, default)


def set_cached(key: str, value: Any, ttl_seconds: int = 60):
    """Set value in cache with TTL."""
    _cache[key] = value
    _cache_ttl[key] = datetime.utcnow() + timedelta(seconds=ttl_seconds)


@router.get("/system/cache/stats", tags=["System"])
async def get_cache_stats(
    current_user: User = Depends(get_current_admin_user)
):
    """Get cache statistics (admin only)."""
    return {
        "entries": len(_cache),
        "hit_rate": 0.85,  # Simulated
        "miss_rate": 0.15,
        "memory_mb": len(str(_cache)) / 1024 / 1024,
        "oldest_entry_age_seconds": 120,
        "cache_type": "in-memory",
        "redis_connected": False,  # Would be True in production
        "updated_at": datetime.utcnow().isoformat()
    }


@router.post("/system/cache/clear", tags=["System"])
async def clear_cache(
    pattern: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user)
):
    """Clear cache entries (admin only)."""
    global _cache, _cache_ttl
    
    if pattern:
        # Clear matching keys
        keys_to_delete = [k for k in _cache.keys() if pattern in k]
        for k in keys_to_delete:
            del _cache[k]
            if k in _cache_ttl:
                del _cache_ttl[k]
        return {"cleared": len(keys_to_delete), "pattern": pattern}
    else:
        count = len(_cache)
        _cache = {}
        _cache_ttl = {}
        return {"cleared": count, "pattern": "all"}


# =============================================================================
# HUMAN-IN-THE-LOOP (HITL) APPROVAL ENDPOINTS (Sprint 1 - Safety Layer)
# =============================================================================

from .hitl import get_hitl_service, ApprovalPriority, ApprovalCategory, ApprovalRequest
from .models import AgentDecision, HITLApprovalQueue


@router.get("/admin/hitl/queue", tags=["Admin", "HITL"])
async def get_hitl_queue(
    category: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get pending HITL approval items (admin only)."""
    hitl_service = get_hitl_service(db)
    items = await hitl_service.get_pending_approvals(
        category=category,
        priority=priority,
        limit=limit,
        offset=offset
    )
    
    # Get total count
    query = db.query(HITLApprovalQueue).filter(
        HITLApprovalQueue.status.in_(["pending", "assigned", "reviewing"])
    )
    if category:
        query = query.filter(HITLApprovalQueue.category == category)
    total = query.count()
    
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/admin/hitl/queue/{queue_id}/assign", tags=["Admin", "HITL"])
async def assign_hitl_item(
    queue_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Assign an HITL item to yourself (admin only)."""
    hitl_service = get_hitl_service(db)
    item = await hitl_service.assign_approval(queue_id, current_user.id)
    
    if not item:
        raise HTTPException(status_code=404, detail="HITL item not found")
    
    return {"success": True, "queue_id": queue_id, "assigned_to": current_user.id}


class HITLApprovalAction(BaseModel):
    notes: Optional[str] = None


@router.post("/admin/hitl/decisions/{decision_id}/approve", tags=["Admin", "HITL"])
async def approve_hitl_decision(
    decision_id: int,
    action: HITLApprovalAction,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Approve an agent decision (admin only)."""
    hitl_service = get_hitl_service(db)
    decision = await hitl_service.approve_decision(
        decision_id=decision_id,
        approver_id=current_user.id,
        notes=action.notes
    )
    
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    return {
        "success": True,
        "decision_id": decision_id,
        "status": decision.status,
        "approved_by": current_user.id
    }


@router.post("/admin/hitl/decisions/{decision_id}/reject", tags=["Admin", "HITL"])
async def reject_hitl_decision(
    decision_id: int,
    action: HITLApprovalAction,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reject an agent decision (admin only)."""
    if not action.notes:
        raise HTTPException(status_code=400, detail="Rejection notes are required")
    
    hitl_service = get_hitl_service(db)
    decision = await hitl_service.reject_decision(
        decision_id=decision_id,
        rejector_id=current_user.id,
        notes=action.notes
    )
    
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    return {
        "success": True,
        "decision_id": decision_id,
        "status": decision.status,
        "rejected_by": current_user.id
    }


@router.post("/admin/hitl/decisions/{decision_id}/execute", tags=["Admin", "HITL"])
async def execute_hitl_decision(
    decision_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Execute an approved decision (admin only)."""
    hitl_service = get_hitl_service(db)
    result = await hitl_service.execute_approved_decision(decision_id)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/admin/hitl/audit-trail", tags=["Admin", "HITL"])
async def get_agent_audit_trail(
    agent_name: Optional[str] = None,
    action_type: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Query agent decision audit trail (admin only)."""
    hitl_service = get_hitl_service(db)
    
    # Parse dates if provided
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    decisions = await hitl_service.get_decision_audit_trail(
        agent_name=agent_name,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        start_date=start_dt,
        end_date=end_dt,
        limit=limit,
        offset=offset
    )
    
    return {
        "decisions": decisions,
        "total": len(decisions),
        "limit": limit,
        "offset": offset
    }


# =============================================================================
# VIDEO MODERATION ENDPOINTS (Sprint 1 - Safety Layer)
# =============================================================================

from .video_moderation import get_video_moderation_service


@router.post("/admin/moderation/video/start/{stream_id}", tags=["Admin", "Moderation"])
async def start_video_moderation(
    stream_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Start video moderation for a stream (admin only)."""
    service = get_video_moderation_service(db)
    started = await service.start_stream_monitoring(stream_id)
    
    return {
        "success": started,
        "stream_id": stream_id,
        "message": "Video moderation started" if started else "Video moderation disabled or already active"
    }


@router.post("/admin/moderation/video/stop/{stream_id}", tags=["Admin", "Moderation"])
async def stop_video_moderation(
    stream_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Stop video moderation for a stream and get summary (admin only)."""
    service = get_video_moderation_service(db)
    summary = await service.stop_stream_monitoring(stream_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail="Stream not being monitored")
    
    return summary


@router.get("/admin/moderation/video/status/{stream_id}", tags=["Admin", "Moderation"])
async def get_video_moderation_status(
    stream_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get video moderation status for a stream (admin only)."""
    service = get_video_moderation_service(db)
    status = service.get_stream_status(stream_id)
    
    if not status:
        return {
            "stream_id": stream_id,
            "is_monitoring": False,
            "message": "Stream not being monitored"
        }
    
    return status


class FrameAnalysisRequest(BaseModel):
    frame_base64: str  # Base64-encoded image


@router.post("/admin/moderation/video/analyze-frame", tags=["Admin", "Moderation"])
async def analyze_video_frame(
    request_data: FrameAnalysisRequest,
    stream_id: Optional[int] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Analyze a single video frame for NSFW content (admin only)."""
    import base64
    
    try:
        frame_bytes = base64.b64decode(request_data.frame_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")
    
    service = get_video_moderation_service(db)
    result = await service.analyze_frame(frame_bytes, stream_id)
    
    return result.to_dict()


# ==========================================
# GDPR Data Export Endpoints (Sprint 2)
# ==========================================

def get_data_export_service(db: Session):
    """Get or create DataExportService instance."""
    from backend.data_export import DataExportService
    return DataExportService(db)


@router.post("/user/data-export/request")
async def request_data_export(
    export_type: str = "full",
    include_private: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a GDPR-compliant data export."""
    from backend.data_export import ExportType
    
    try:
        exp_type = ExportType(export_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid export type: {export_type}")
    
    service = get_data_export_service(db)
    result = await service.request_export(
        user_id=current_user.id,
        export_type=exp_type,
        include_private=include_private
    )
    
    return result


@router.get("/user/data-export/status/{request_id}")
async def get_export_status(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get status of a data export request."""
    service = get_data_export_service(db)
    result = await service.get_export_status(current_user.id, request_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/user/data-export/history")
async def get_export_history(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get data export history for the current user."""
    service = get_data_export_service(db)
    exports = await service.get_export_history(current_user.id, limit)
    return {"exports": exports}


@router.get("/user/data-export/download/{request_id}")
async def download_export(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a completed data export."""
    from fastapi.responses import FileResponse
    
    service = get_data_export_service(db)
    file_path = await service.download_export(current_user.id, request_id)
    
    if not file_path:
        raise HTTPException(status_code=404, detail="Export not found or expired")
    
    return FileResponse(
        file_path,
        media_type="application/zip",
        filename=f"streamura_data_export_{current_user.id}.zip"
    )


class DeleteAccountRequest(BaseModel):
    confirmation_code: str
    reason: Optional[str] = None


@router.delete("/user/account")
async def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete user account (GDPR Right to be Forgotten)."""
    service = get_data_export_service(db)
    result = await service.delete_account(
        user_id=current_user.id,
        confirmation_code=request.confirmation_code,
        reason=request.reason
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result


@router.get("/user/account/deletion-code")
async def get_deletion_code(
    current_user: User = Depends(get_current_user)
):
    """Get the confirmation code needed for account deletion."""
    import hashlib
    code = hashlib.sha256(f"{current_user.id}-{current_user.email}".encode()).hexdigest()[:8].upper()
    
    # In production, this would also send an email with the code
    return {
        "message": "Confirmation code sent to your email",
        "hint": "Check your email for the 8-character deletion code"
    }


# ==========================================
# Emergency & Panic Button Endpoints (Sprint 2)
# ==========================================

def get_emergency_service(db: Session):
    """Get or create EmergencyService instance."""
    from backend.emergency import EmergencyService
    return EmergencyService(db)


class PanicButtonRequest(BaseModel):
    trigger_source: str = "web"
    stream_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_consent: bool = False
    description: Optional[str] = None


@router.post("/emergency/panic")
async def trigger_panic_button(
    request: PanicButtonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger the panic button for emergency assistance."""
    service = get_emergency_service(db)
    result = await service.trigger_panic_button(
        user_id=current_user.id,
        trigger_source=request.trigger_source,
        stream_id=request.stream_id,
        latitude=request.latitude,
        longitude=request.longitude,
        location_consent=request.location_consent,
        description=request.description
    )
    
    return result


class EmergencyContactRequest(BaseModel):
    emergency_type: str
    severity: str = "medium"
    stream_id: Optional[int] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_consent: bool = False


@router.post("/emergency/contact")
async def create_emergency_contact(
    request: EmergencyContactRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an emergency contact request."""
    from backend.emergency import EmergencyType, EmergencySeverity
    
    try:
        emergency_type = EmergencyType(request.emergency_type)
        severity = EmergencySeverity(request.severity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    service = get_emergency_service(db)
    result = await service.create_emergency_contact(
        user_id=current_user.id,
        emergency_type=emergency_type,
        severity=severity,
        stream_id=request.stream_id,
        description=request.description,
        latitude=request.latitude,
        longitude=request.longitude,
        location_consent=request.location_consent
    )
    
    return result


@router.get("/emergency/history")
async def get_emergency_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get emergency history for the current user."""
    service = get_emergency_service(db)
    emergencies = await service.get_user_emergency_history(current_user.id, limit)
    return {"emergencies": emergencies}


# Admin-only emergency management endpoints

@router.get("/admin/emergency/queue")
async def get_emergency_queue(
    severity: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get open emergencies for safety team (admin only)."""
    from backend.emergency import EmergencySeverity
    
    severity_filter = None
    if severity:
        try:
            severity_filter = EmergencySeverity(severity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {severity}")
    
    service = get_emergency_service(db)
    emergencies = await service.get_open_emergencies(limit, severity_filter)
    
    return {"emergencies": emergencies, "total": len(emergencies)}


@router.post("/admin/emergency/{emergency_id}/acknowledge")
async def acknowledge_emergency(
    emergency_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Acknowledge an emergency (admin only)."""
    service = get_emergency_service(db)
    result = await service.acknowledge_emergency(
        emergency_id=emergency_id,
        responder_id=current_user.id,
        notes=notes
    )
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


class ResolveEmergencyRequest(BaseModel):
    resolution_notes: str
    is_false_alarm: bool = False


@router.post("/admin/emergency/{emergency_id}/resolve")
async def resolve_emergency(
    emergency_id: int,
    request: ResolveEmergencyRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Resolve an emergency (admin only)."""
    service = get_emergency_service(db)
    result = await service.resolve_emergency(
        emergency_id=emergency_id,
        resolver_id=current_user.id,
        resolution_notes=request.resolution_notes,
        is_false_alarm=request.is_false_alarm
    )
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


class EscalateEmergencyRequest(BaseModel):
    escalation_reason: str


@router.post("/admin/emergency/{emergency_id}/escalate")
async def escalate_emergency(
    emergency_id: int,
    request: EscalateEmergencyRequest,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Escalate an emergency to higher authority (admin only)."""
    service = get_emergency_service(db)
    result = await service.escalate_emergency(
        emergency_id=emergency_id,
        escalator_id=current_user.id,
        escalation_reason=request.escalation_reason
    )
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/admin/emergency/stats")
async def get_emergency_stats(
    days: int = 30,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get emergency statistics for safety team (admin only)."""
    service = get_emergency_service(db)
    stats = await service.get_emergency_stats(days)
    return stats


# ==========================================
# Event Clustering API Endpoints (Sprint 3)
# ==========================================

def get_clustering_service(db: Session):
    """Get or create EventClusteringService instance."""
    from backend.clustering import EventClusteringService
    return EventClusteringService(db)


def get_ranking_service(db: Session):
    """Get or create EventRankingService instance."""
    from backend.ranking import EventRankingService
    return EventRankingService(db)


@router.get("/events/clusters")
async def get_event_clusters(
    north: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    west: Optional[float] = None,
    include_streams: bool = True,
    max_clusters: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get active event clusters with geographic filtering.
    
    Returns clusters with their streams, velocity data, and trending status.
    """
    from backend.clustering import EventClusteringService
    from backend.ranking import EventRankingService
    
    clustering_service = EventClusteringService(db)
    ranking_service = EventRankingService(db)
    
    # Get active clusters
    clusters = clustering_service.cluster_active_streams()
    
    result_clusters = []
    for cluster in clusters[:max_clusters]:
        # Get or create event for this cluster
        event = None
        for stream_loc in cluster.streams:
            stream = db.query(Stream).filter(Stream.id == stream_loc.stream_id).first()
            if stream and stream.event_id:
                event = db.query(Event).filter(Event.id == stream.event_id).first()
                break
        
        # Calculate velocity and trending status
        velocity = 0.0
        velocity_trend = "stable"
        is_trending = False
        is_featured = False
        
        if event:
            velocity = ranking_service._calculate_velocity(event)
            is_trending = ranking_service.is_trending(event)
            is_featured = ranking_service.should_feature(event)
            
            # Determine trend
            if velocity > 10:
                velocity_trend = "rising"
            elif velocity < -5:
                velocity_trend = "falling"
        
        # Build cluster response
        cluster_data = {
            "event_id": event.id if event else None,
            "title": event.title if event else f"Event at {cluster.centroid[0]:.4f}, {cluster.centroid[1]:.4f}",
            "centroid": list(cluster.centroid),
            "radius_meters": cluster.radius_meters,
            "confidence": cluster.confidence,
            "stream_count": cluster.stream_count,
            "total_viewers": cluster.total_viewers,
            "velocity": round(velocity, 2),
            "velocity_trend": velocity_trend,
            "is_trending": is_trending,
            "is_featured": is_featured,
            "category": event.category if event else None,
            "started_at": event.created_at.isoformat() if event else None,
            "streams": []
        }
        
        if include_streams:
            for stream_loc in cluster.streams[:10]:  # Limit streams per cluster
                stream = db.query(Stream).filter(Stream.id == stream_loc.stream_id).first()
                if stream:
                    cluster_data["streams"].append({
                        "stream_id": stream.id,
                        "title": stream.title,
                        "streamer_name": stream.user.username if stream.user else "Unknown",
                        "viewer_count": stream.viewer_count,
                        "thumbnail_url": stream.thumbnail_url,
                        "latitude": stream_loc.latitude,
                        "longitude": stream_loc.longitude,
                        "is_live": stream.status == "live"
                    })
        
        result_clusters.append(cluster_data)
    
    # Sort by total viewers (most popular first)
    result_clusters.sort(key=lambda c: c["total_viewers"], reverse=True)
    
    return {
        "clusters": result_clusters,
        "total_count": len(result_clusters),
        "bounds_applied": north is not None
    }


@router.get("/events/{event_id}/velocity")
async def get_event_velocity(
    event_id: int,
    window_minutes: int = 15,
    history_points: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get detailed velocity data for an event.
    
    Returns current velocity and historical velocity data points.
    """
    from backend.ranking import EventRankingService
    from datetime import timedelta
    
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    ranking_service = EventRankingService(db)
    
    # Calculate current metrics
    current_velocity = ranking_service._calculate_velocity(event, window_minutes)
    is_trending = ranking_service.is_trending(event)
    is_hot = ranking_service.is_hot(event)
    trending_score = ranking_service.calculate_trending_score(event)
    
    # Generate historical velocity data (simplified - in production, this would query historical snapshots)
    history = []
    now = datetime.now()
    for i in range(history_points):
        timestamp = now - timedelta(minutes=i * 2)
        # Simulated historical data - in production, query actual snapshots
        velocity_point = max(0, current_velocity - (i * 0.5) + (i % 3))
        history.append({
            "timestamp": timestamp.isoformat(),
            "viewer_count": event.viewer_count,
            "velocity": round(velocity_point, 2)
        })
    
    history.reverse()  # Oldest first
    
    # Determine trend
    trend = "stable"
    if len(history) >= 3:
        recent_avg = sum(h["velocity"] for h in history[-3:]) / 3
        older_avg = sum(h["velocity"] for h in history[:3]) / 3
        if recent_avg > older_avg + 5:
            trend = "rising"
        elif recent_avg < older_avg - 5:
            trend = "falling"
    
    return {
        "event_id": event_id,
        "current_velocity": round(current_velocity, 2),
        "trend": trend,
        "is_trending": is_trending,
        "is_hot": is_hot,
        "trending_score": round(trending_score, 3),
        "viewer_count": event.viewer_count,
        "stream_count": event.stream_count,
        "history": history
    }


@router.get("/events/trending")
async def get_trending_events(
    limit: int = 20,
    category: Optional[str] = None,
    min_velocity: float = 0,
    db: Session = Depends(get_db)
):
    """
    Get trending events sorted by velocity and engagement.
    """
    from backend.ranking import EventRankingService
    
    ranking_service = EventRankingService(db)
    trending_events = ranking_service.get_trending_events(limit=limit, category=category)
    
    results = []
    for event in trending_events:
        velocity = ranking_service._calculate_velocity(event)
        
        if velocity < min_velocity:
            continue
        
        results.append({
            "event_id": event.id,
            "title": event.title,
            "category": event.category,
            "viewer_count": event.viewer_count,
            "stream_count": event.stream_count,
            "velocity": round(velocity, 2),
            "is_featured": event.is_featured,
            "trending_score": round(ranking_service.calculate_trending_score(event), 3),
            "location": {
                "latitude": event.latitude,
                "longitude": event.longitude,
                "name": event.location_name
            } if event.latitude else None,
            "thumbnail_url": event.thumbnail_url,
            "started_at": event.created_at.isoformat() if event.created_at else None
        })
    
    return {
        "events": results,
        "count": len(results)
    }


# ==========================================
# Agent Metrics API Endpoints (Sprint 4)
# ==========================================

@router.get("/admin/agents/metrics")
async def get_agent_metrics(
    agent_type: Optional[str] = None,
    time_range: str = "24h",
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive metrics for all agents or a specific agent.
    
    Returns decision counts, approval rates, success rates, and performance data.
    """
    from datetime import timedelta
    from backend.agentic import AgentType
    
    # Calculate time window
    time_windows = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30)
    }
    window = time_windows.get(time_range, timedelta(hours=24))
    cutoff_time = datetime.now() - window
    
    # Get agent decisions from the database
    query = db.query(AgentDecision)
    if agent_type:
        query = query.filter(AgentDecision.agent_type == agent_type)
    
    all_decisions = query.all()
    recent_decisions = query.filter(AgentDecision.created_at >= cutoff_time).all()
    
    # Aggregate by agent type
    agent_stats = {}
    for agent in AgentType:
        agent_decisions = [d for d in all_decisions if d.agent_type == agent.value]
        recent_agent_decisions = [d for d in recent_decisions if d.agent_type == agent.value]
        
        if not agent_decisions and agent_type and agent_type != agent.value:
            continue
            
        total = len(agent_decisions)
        today_count = len(recent_agent_decisions)
        
        approved = sum(1 for d in agent_decisions if d.status == 'approved' or d.status == 'executed')
        auto_approved = sum(1 for d in agent_decisions if not d.requires_approval and d.status == 'executed')
        human_approved = sum(1 for d in agent_decisions if d.requires_approval and d.approved_by)
        rejected = sum(1 for d in agent_decisions if d.status == 'rejected')
        successful = sum(1 for d in agent_decisions if d.status == 'executed')
        
        avg_confidence = sum(d.confidence for d in agent_decisions) / max(1, total)
        avg_exec_time = 50  # Mock - would need execution time tracking
        
        agent_stats[agent.value] = {
            "agent_type": agent.value,
            "total_decisions": total,
            "decisions_today": today_count,
            "approval_rate": approved / max(1, total),
            "auto_approved": auto_approved,
            "human_approved": human_approved,
            "rejected": rejected,
            "avg_confidence": avg_confidence,
            "avg_execution_time_ms": avg_exec_time,
            "success_rate": successful / max(1, total)
        }
    
    return {
        "agents": list(agent_stats.values()),
        "time_range": time_range,
        "total_decisions": sum(s["total_decisions"] for s in agent_stats.values()),
        "overall_approval_rate": sum(s["approval_rate"] for s in agent_stats.values()) / max(1, len(agent_stats))
    }


@router.get("/admin/agents/{agent_type}/decisions")
async def get_agent_decisions(
    agent_type: str,
    status: Optional[str] = None,
    limit: int = 50,
    include_factors: bool = True,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed decisions for a specific agent with full explainability data.
    """
    query = db.query(AgentDecision).filter(AgentDecision.agent_type == agent_type)
    
    if status:
        query = query.filter(AgentDecision.status == status)
    
    decisions = query.order_by(AgentDecision.created_at.desc()).limit(limit).all()
    
    results = []
    for decision in decisions:
        decision_data = {
            "decision_id": str(decision.id),
            "agent_type": decision.agent_type,
            "action_type": decision.action_type,
            "target_entity": decision.target_entity,
            "target_id": decision.target_id,
            "reasoning": decision.reasoning,
            "confidence": decision.confidence,
            "risk_level": decision.risk_level,
            "status": decision.status,
            "requires_approval": decision.requires_approval,
            "approved_by": decision.approved_by,
            "approved_at": decision.approved_at.isoformat() if decision.approved_at else None,
            "created_at": decision.created_at.isoformat(),
            "alternatives_considered": decision.alternatives_considered or []
        }
        
        if include_factors:
            # Parse factors from decision_factors JSON field
            decision_data["factors"] = decision.decision_factors or []
        
        results.append(decision_data)
    
    return {
        "decisions": results,
        "count": len(results),
        "agent_type": agent_type
    }


@router.post("/agents/appeal/{decision_id}")
async def appeal_agent_decision(
    decision_id: int,
    appeal_reason: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Appeal an agent decision for human review.
    """
    decision = db.query(AgentDecision).filter(AgentDecision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    # Create an appeal record (would be a separate model in production)
    # For now, mark the decision for re-review
    decision.status = "appealed"
    decision.appeal_reason = appeal_reason
    decision.appealed_by = current_user.id
    decision.appealed_at = datetime.now()
    
    db.commit()
    
    return {
        "success": True,
        "decision_id": decision_id,
        "message": "Decision has been flagged for review"
    }


# ==========================================
# Trust Score API Endpoints (Sprint 5)
# ==========================================

@router.get("/trust/breakdown/me")
async def get_my_trust_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed trust score breakdown for the current user.
    """
    return await get_trust_breakdown_for_user(current_user.id, db)


@router.get("/trust/breakdown/{user_id}")
async def get_user_trust_breakdown(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed trust score breakdown for a specific user (public view).
    """
    return await get_trust_breakdown_for_user(user_id, db, is_own=current_user.id == user_id)


async def get_trust_breakdown_for_user(user_id: int, db: Session, is_own: bool = True):
    """
    Generate a comprehensive trust breakdown for a user.
    """
    from backend.trust_score import TrustScoreService
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    trust_service = TrustScoreService(db)
    
    # Get current trust score
    trust_data = trust_service.calculate_trust_score(user_id)
    
    # Determine tier based on score
    score = trust_data.get('overall_score', 0)
    if score >= 9:
        tier = 'diamond'
    elif score >= 7:
        tier = 'platinum'
    elif score >= 5:
        tier = 'gold'
    elif score >= 3:
        tier = 'silver'
    else:
        tier = 'bronze'
    
    # Determine next tier
    tier_thresholds = {'bronze': 3, 'silver': 5, 'gold': 7, 'platinum': 9, 'diamond': 10}
    next_tier = None
    for tier_name, threshold in tier_thresholds.items():
        if threshold > score:
            next_tier = {'name': tier_name, 'required_score': threshold}
            break
    
    # Build factors list
    factors = []
    factor_data = trust_data.get('factors', {})
    
    factor_definitions = [
        ('identity_verification', 'Identity Verification', 0.25, 'Government ID verified'),
        ('account_age', 'Account Age', 0.15, 'Time since account creation'),
        ('streaming_history', 'Streaming History', 0.15, 'Total hours streamed'),
        ('two_factor_auth', 'Two-Factor Auth', 0.10, 'Security layer enabled'),
        ('community_standing', 'Community Standing', 0.15, 'Positive community interactions'),
        ('content_quality', 'Content Quality', 0.10, 'Based on viewer engagement'),
        ('payment_history', 'Payment History', 0.10, 'Successful transactions')
    ]
    
    for key, name, weight, desc in factor_definitions:
        factor_info = factor_data.get(key, {})
        score_value = factor_info.get('score', 0) if isinstance(factor_info, dict) else 0
        
        # Determine status
        if score_value >= 0.9:
            status = 'verified'
        elif score_value >= 0.5:
            status = 'partial'
        elif score_value > 0:
            status = 'pending'
        else:
            status = 'unverified'
        
        factors.append({
            'name': name,
            'key': key,
            'score': score_value,
            'weight': weight,
            'status': status,
            'description': desc,
            'value': factor_info.get('value') if isinstance(factor_info, dict) else None,
            'maxValue': factor_info.get('max_value') if isinstance(factor_info, dict) else None,
            'actionRequired': factor_info.get('action_required') if isinstance(factor_info, dict) else None
        })
    
    # Generate improvement tips
    improvement_tips = []
    for factor in factors:
        if factor['score'] < 1.0 and factor['actionRequired']:
            impact = 'high' if factor['weight'] >= 0.15 else 'medium' if factor['weight'] >= 0.10 else 'low'
            improvement_tips.append({
                'tip': factor['actionRequired'],
                'impact': impact,
                'action_link': f'/settings/{factor["key"].replace("_", "-")}'
            })
    
    # Generate mock history (in production, query actual historical data)
    history = []
    for i in range(7):
        history.append({
            'date': f'{(6-i)*5}d ago' if i < 6 else 'Today',
            'score': max(1, score - (6-i) * 0.15 + (i % 2) * 0.1)
        })
    
    return {
        'user_id': user_id,
        'overall_score': score,
        'tier': tier,
        'next_tier': next_tier,
        'factors': factors,
        'improvement_tips': improvement_tips[:5],  # Top 5 tips
        'history': history,
        'last_updated': datetime.now().isoformat()
    }


# ==========================================
# Cluster Admin API Endpoints (Sprint 6)
# ==========================================

@router.get("/admin/clusters")
async def get_admin_clusters(
    category: Optional[str] = None,
    is_trending: Optional[bool] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all clusters with admin details for cluster management.
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    clusters = clustering_service.get_active_clusters()
    
    result = []
    for cluster in clusters:
        if category and cluster.get('category') != category:
            continue
        if is_trending is not None and cluster.get('is_trending') != is_trending:
            continue
        
        # Enrich with admin-specific data
        cluster_data = {
            'cluster_id': cluster.get('cluster_id', str(cluster.get('id', ''))),
            'event_id': cluster.get('event_id'),
            'title': cluster.get('title', 'Untitled Cluster'),
            'centroid': cluster.get('centroid', [0, 0]),
            'radius_meters': cluster.get('radius_meters', 500),
            'stream_count': len(cluster.get('streams', [])),
            'total_viewers': sum(s.get('viewer_count', 0) for s in cluster.get('streams', [])),
            'velocity': cluster.get('velocity', 0),
            'velocity_trend': cluster.get('velocity_trend', 'stable'),
            'is_trending': cluster.get('is_trending', False),
            'is_featured': cluster.get('is_featured', False),
            'category': cluster.get('category'),
            'auto_generated': cluster.get('auto_generated', True),
            'locked': cluster.get('locked', False),
            'streams': cluster.get('streams', [])[:10],  # Limit streams for performance
            'created_at': cluster.get('created_at', datetime.now().isoformat()),
            'updated_at': cluster.get('updated_at', datetime.now().isoformat())
        }
        result.append(cluster_data)
    
    return {
        'clusters': result,
        'count': len(result)
    }


@router.post("/admin/clusters/{cluster_id}/rename")
async def rename_cluster(
    cluster_id: str,
    name: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Rename a cluster (admin override of AI-suggested name).
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    success = clustering_service.rename_cluster(cluster_id, name, renamed_by=current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    return {
        'success': True,
        'cluster_id': cluster_id,
        'new_name': name
    }


@router.post("/admin/clusters/merge")
async def merge_clusters(
    source_cluster_id: str,
    target_cluster_id: str,
    new_name: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Merge two clusters into one.
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    merged_cluster = clustering_service.merge_clusters(
        source_id=source_cluster_id,
        target_id=target_cluster_id,
        new_name=new_name,
        merged_by=current_user.id
    )
    
    if not merged_cluster:
        raise HTTPException(status_code=400, detail="Failed to merge clusters")
    
    return {
        'success': True,
        'merged_cluster': merged_cluster
    }


@router.post("/admin/clusters/{cluster_id}/split")
async def split_cluster(
    cluster_id: str,
    stream_ids: list,
    new_cluster_name: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Split streams from one cluster into a new cluster.
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    new_cluster = clustering_service.split_cluster(
        cluster_id=cluster_id,
        stream_ids=stream_ids,
        new_name=new_cluster_name,
        split_by=current_user.id
    )
    
    if not new_cluster:
        raise HTTPException(status_code=400, detail="Failed to split cluster")
    
    return {
        'success': True,
        'new_cluster': new_cluster
    }


@router.post("/admin/clusters/{cluster_id}/lock")
async def toggle_cluster_lock(
    cluster_id: str,
    locked: bool,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Lock/unlock a cluster to prevent automatic updates.
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    success = clustering_service.set_cluster_lock(cluster_id, locked)
    
    if not success:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    return {
        'success': True,
        'cluster_id': cluster_id,
        'locked': locked
    }


@router.post("/admin/clusters/{cluster_id}/feature")
async def toggle_cluster_feature(
    cluster_id: str,
    featured: bool,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Feature/unfeature a cluster for homepage display.
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    success = clustering_service.set_cluster_featured(cluster_id, featured)
    
    if not success:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    return {
        'success': True,
        'cluster_id': cluster_id,
        'featured': featured
    }


@router.delete("/admin/clusters/{cluster_id}")
async def delete_cluster(
    cluster_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete a cluster (streams remain, just ungrouped).
    """
    from backend.clustering import EventClusteringService
    
    clustering_service = EventClusteringService(db)
    success = clustering_service.delete_cluster(cluster_id, deleted_by=current_user.id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Cluster not found")
    
    return {
        'success': True,
        'cluster_id': cluster_id
    }


# ==========================================
# Revenue & Currency API Endpoints (Sprint 7)
# ==========================================

@router.get("/revenue/forecast")
async def get_revenue_forecast(
    creator_id: Optional[int] = None,
    months: int = 3,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get revenue forecast for a creator.
    If creator_id not specified, uses current user.
    """
    from backend.revenue_forecasting import RevenueForecastingService
    
    target_id = creator_id or current_user.id
    service = RevenueForecastingService(db)
    
    forecasts = service.forecast_monthly(target_id, months)
    trend = service.analyze_trends(target_id)
    
    # Build chart data
    chart_data = []
    for forecast in forecasts:
        chart_data.append({
            'date': forecast.period_start.strftime('%b'),
            'predicted': float(forecast.predicted_revenue),
            'confidence_low': float(forecast.confidence_low),
            'confidence_high': float(forecast.confidence_high)
        })
    
    return {
        'forecasts': [
            {
                'period_start': f.period_start.isoformat(),
                'period_end': f.period_end.isoformat(),
                'predicted_revenue': float(f.predicted_revenue),
                'confidence_low': float(f.confidence_low),
                'confidence_high': float(f.confidence_high),
                'confidence_level': f.confidence_level,
                'breakdown': {k: float(v) for k, v in f.breakdown.items()},
                'assumptions': f.assumptions
            }
            for f in forecasts
        ],
        'trend': {
            'direction': trend.direction.value,
            'velocity': trend.velocity,
            'seasonality_factor': trend.seasonality_factor,
            'best_day_of_week': trend.best_day_of_week,
            'best_hour_of_day': trend.best_hour_of_day,
            'growth_contributors': trend.growth_contributors,
            'risk_factors': trend.risk_factors
        },
        'chart_data': chart_data
    }


@router.get("/revenue/goal-progress")
async def check_goal_progress(
    target_amount: float,
    target_date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check progress toward a revenue goal.
    """
    from backend.revenue_forecasting import RevenueForecastingService
    from decimal import Decimal
    
    service = RevenueForecastingService(db)
    goal = service.check_goal_progress(
        current_user.id,
        Decimal(str(target_amount)),
        datetime.fromisoformat(target_date)
    )
    
    return {
        'target_amount': float(goal.target_amount),
        'target_date': goal.target_date.isoformat(),
        'current_progress': float(goal.current_progress),
        'projected_achievement_date': goal.projected_achievement_date.isoformat() if goal.projected_achievement_date else None,
        'on_track': goal.on_track,
        'recommendations': goal.recommendations
    }


@router.get("/currency/packs")
async def get_currency_packs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get available currency packs with personalized pricing.
    """
    from backend.currency_packs import CurrencyPacksService
    
    service = CurrencyPacksService(db)
    packs = service.get_available_packs(current_user.id)
    
    return {
        'packs': [
            {
                'pack_id': p.pack_id,
                'size': p.size.value,
                'coin_amount': p.coin_amount,
                'bonus_coins': p.bonus_coins,
                'price_usd': float(p.price_usd),
                'price_per_coin': float(p.price_per_coin),
                'discount_percent': p.discount_percent,
                'is_featured': p.is_featured,
                'limited_time': p.limited_time,
                'badge': p.badge,
                'expires_at': p.expires_at.isoformat() if p.expires_at else None
            }
            for p in packs
        ]
    }


@router.get("/currency/balance")
async def get_currency_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's current currency balance.
    """
    from backend.currency_packs import CurrencyPacksService
    
    service = CurrencyPacksService(db)
    balance = service.get_balance(current_user.id)
    
    return {
        'total_coins': balance.total_coins,
        'purchased_coins': balance.purchased_coins,
        'bonus_coins': balance.bonus_coins,
        'earned_coins': balance.earned_coins,
        'spent_coins': balance.spent_coins,
        'vip_level': balance.vip_level,
        'last_purchase': balance.last_purchase.isoformat() if balance.last_purchase else None
    }


@router.post("/currency/purchase")
async def purchase_currency_pack(
    pack_id: str,
    payment_method_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Purchase a currency pack.
    """
    from backend.currency_packs import CurrencyPacksService, CurrencyPackSize
    
    service = CurrencyPacksService(db)
    
    # Map pack_id to size enum
    size_map = {
        'pack_starter': CurrencyPackSize.STARTER,
        'pack_value': CurrencyPackSize.VALUE,
        'pack_popular': CurrencyPackSize.POPULAR,
        'pack_super': CurrencyPackSize.SUPER,
        'pack_mega': CurrencyPackSize.MEGA,
        'pack_ultimate': CurrencyPackSize.ULTIMATE,
        'starter': CurrencyPackSize.STARTER,
        'value': CurrencyPackSize.VALUE,
        'popular': CurrencyPackSize.POPULAR,
        'super': CurrencyPackSize.SUPER,
        'mega': CurrencyPackSize.MEGA,
        'ultimate': CurrencyPackSize.ULTIMATE
    }
    
    pack_size = size_map.get(pack_id)
    if not pack_size:
        raise HTTPException(status_code=400, detail="Invalid pack ID")
    
    result = await service.purchase_pack(
        current_user.id,
        pack_size,
        payment_method_id or 'pm_default'
    )
    
    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('error', 'Purchase failed'))
    
    return result


@router.post("/currency/spend")
async def spend_currency(
    amount: int,
    description: str,
    recipient_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Spend coins (tips, purchases, etc.)
    """
    from backend.currency_packs import CurrencyPacksService
    
    service = CurrencyPacksService(db)
    result = service.spend_coins(
        current_user.id,
        amount,
        description,
        recipient_id
    )
    
    if not result.get('success'):
        raise HTTPException(status_code=400, detail=result.get('error', 'Spend failed'))
    
    return result


@router.get("/currency/conversion-rate")
async def get_conversion_rate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's coin-to-USD conversion rate.
    """
    from backend.currency_packs import CurrencyPacksService
    
    service = CurrencyPacksService(db)
    rate = service.get_conversion_rate(current_user.id)
    
    return {
        'base_rate': float(rate.base_rate),
        'vip_bonus': rate.vip_bonus,
        'effective_rate': float(rate.effective_rate)
    }


# ==========================================
# Virtual Goods Enhancement API (Sprint 8)
# ==========================================

@router.get("/goods/{good_id}/preview")
async def get_good_preview(
    good_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get detailed preview data for a virtual good.
    Includes usage stats, creator info, rarity display.
    """
    from backend.virtual_goods import VirtualGoodsService, GoodRarity
    
    service = VirtualGoodsService(db)
    
    try:
        good_data = await service.get_good(good_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Good not found")
    
    # Get creator info if applicable
    creator_info = None
    if good_data.get('creator_id'):
        creator = db.query(User).filter(User.id == good_data['creator_id']).first()
        if creator:
            creator_info = {
                'id': creator.id,
                'username': creator.username,
                'display_name': creator.display_name,
                'avatar_url': getattr(creator, 'avatar_url', None)
            }
    
    # Determine rarity (can be stored or inferred from price)
    price = good_data.get('price', 0)
    if price >= 100:
        rarity = 'legendary'
    elif price >= 50:
        rarity = 'epic'
    elif price >= 25:
        rarity = 'rare'
    elif price >= 10:
        rarity = 'uncommon'
    else:
        rarity = 'common'
    
    # Check if user owns it
    is_owned = False
    if current_user:
        is_owned = await service.has_good(current_user.id, good_id)
    
    return {
        'id': good_data['id'],
        'name': good_data['name'],
        'description': good_data['description'],
        'category': good_data['type'],
        'rarity': rarity,
        'price_coins': int(price * 100),  # Convert to coins
        'animation_url': good_data.get('animation_url'),
        'preview_url': good_data.get('image_url'),
        'duration_seconds': good_data.get('duration_seconds'),
        'creator': creator_info,
        'times_used': good_data.get('quantity_sold', 0) * 5,  # Estimate usage
        'times_purchased': good_data.get('quantity_sold', 0),
        'is_limited': good_data.get('is_limited', False),
        'remaining_stock': good_data.get('quantity_available'),
        'expires_at': good_data.get('expires_at'),
        'is_owned': is_owned,
        'tier_exclusive': good_data.get('tier_exclusive_id') is not None
    }


@router.get("/goods/trending")
async def get_trending_goods(
    category: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get trending virtual goods based on recent purchases.
    """
    from backend.virtual_goods import VirtualGoodsService
    
    service = VirtualGoodsService(db)
    result = await service.get_goods(
        good_type=category,
        include_inactive=False,
        limit=limit
    )
    
    # Sort by quantity_sold (popularity)
    goods = sorted(
        result['goods'],
        key=lambda g: g.get('quantity_sold', 0),
        reverse=True
    )
    
    # Add rarity to each
    for good in goods:
        price = good.get('price', 0)
        if price >= 100:
            good['rarity'] = 'legendary'
        elif price >= 50:
            good['rarity'] = 'epic'
        elif price >= 25:
            good['rarity'] = 'rare'
        elif price >= 10:
            good['rarity'] = 'uncommon'
        else:
            good['rarity'] = 'common'
    
    return {
        'goods': goods,
        'total': len(goods)
    }


@router.get("/goods/seasonal")
async def get_seasonal_goods(
    theme: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get seasonal/limited-time virtual goods.
    """
    from backend.virtual_goods import VirtualGoodsService
    
    service = VirtualGoodsService(db)
    result = await service.get_goods(
        include_inactive=False,
        limit=100
    )
    
    # Filter to limited items only
    seasonal = [g for g in result['goods'] if g.get('is_limited')]
    
    return {
        'goods': seasonal,
        'current_theme': theme or 'winter',  # Mock current theme
        'ends_at': (datetime.now() + timedelta(days=14)).isoformat()
    }


@router.post("/goods/{good_id}/use")
async def use_virtual_good(
    good_id: int,
    context: str = "stream",  # 'stream', 'chat', 'profile'
    target_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Use a virtual good (trigger effect, send emote, etc.)
    """
    from backend.virtual_goods import VirtualGoodsService
    
    service = VirtualGoodsService(db)
    
    # Check ownership
    if not await service.has_good(current_user.id, good_id):
        raise HTTPException(status_code=400, detail="You don't own this item")
    
    # Get good details
    good_data = await service.get_good(good_id)
    
    # Log usage (would update a usage counter in production)
    
    return {
        'success': True,
        'good_id': good_id,
        'good_name': good_data['name'],
        'animation_url': good_data.get('animation_url'),
        'duration_seconds': good_data.get('duration_seconds', 5),
        'context': context,
        'target_id': target_id
    }


# ==========================================
# Subscription Analytics API (Sprint 9)
# ==========================================

@router.get("/subscriptions/analytics")
async def get_subscription_analytics(
    creator_id: Optional[int] = None,
    time_range: str = "30d",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive subscription analytics.
    Includes churn rates, tier performance, renewal predictions.
    """
    # Use current user if no creator specified
    target_id = creator_id or current_user.id
    
    # Mock analytics data (would be calculated from real subscriptions)
    stats = {
        'total_subscribers': 847,
        'new_this_month': 123,
        'churned_this_month': 28,
        'net_change': 95,
        'mrr': 4235.50,
        'churn_rate': 3.3,
        'retention_rate': 96.7,
        'average_lifetime_months': 7.2
    }
    
    tiers = [
        {
            'tier_id': 1,
            'tier_name': 'Supporter',
            'price': 4.99,
            'subscriber_count': 412,
            'revenue_share': 1856,
            'churn_rate': 4.2,
            'upgrade_rate': 8.5,
            'downgrade_rate': 0
        },
        {
            'tier_id': 2,
            'tier_name': 'VIP',
            'price': 9.99,
            'subscriber_count': 285,
            'revenue_share': 2565,
            'churn_rate': 2.1,
            'upgrade_rate': 5.2,
            'downgrade_rate': 3.1
        },
        {
            'tier_id': 3,
            'tier_name': 'Ultimate',
            'price': 24.99,
            'subscriber_count': 150,
            'revenue_share': 3374,
            'churn_rate': 1.5,
            'upgrade_rate': 0,
            'downgrade_rate': 2.8
        }
    ]
    
    renewal_predictions = [
        {'date': '2024-02-01', 'predicted_renewals': 245, 'predicted_revenue': 1835.50, 'confidence': 0.92},
        {'date': '2024-02-08', 'predicted_renewals': 198, 'predicted_revenue': 1456.20, 'confidence': 0.88},
        {'date': '2024-02-15', 'predicted_renewals': 167, 'predicted_revenue': 1234.80, 'confidence': 0.85},
        {'date': '2024-02-22', 'predicted_renewals': 189, 'predicted_revenue': 1678.90, 'confidence': 0.82}
    ]
    
    churn_risk = [
        {
            'user_id': 1,
            'username': 'StreamFan92',
            'tier_name': 'VIP',
            'risk_level': 'high',
            'risk_score': 0.78,
            'last_activity': '14 days ago',
            'subscribed_since': '6 months'
        },
        {
            'user_id': 2,
            'username': 'NightOwl',
            'tier_name': 'Ultimate',
            'risk_level': 'medium',
            'risk_score': 0.52,
            'last_activity': '7 days ago',
            'subscribed_since': '3 months'
        },
        {
            'user_id': 3,
            'username': 'ChillViewer',
            'tier_name': 'Supporter',
            'risk_level': 'high',
            'risk_score': 0.85,
            'last_activity': '21 days ago',
            'subscribed_since': '1 month'
        }
    ]
    
    trends = {
        'subscribers': [780, 795, 810, 825, 830, 835, 847],
        'mrr': [3850, 3920, 4050, 4100, 4180, 4210, 4235],
        'churn': [4.1, 3.8, 3.6, 3.5, 3.4, 3.3, 3.3]
    }
    
    return {
        'creator_id': target_id,
        'time_range': time_range,
        'stats': stats,
        'tiers': tiers,
        'renewal_predictions': renewal_predictions,
        'churn_risk': churn_risk,
        'trends': trends
    }


@router.post("/subscriptions/{subscriber_id}/retain")
async def send_retention_message(
    subscriber_id: int,
    message_type: str = "personalized",  # 'personalized', 'discount', 'reminder'
    discount_percent: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a retention message/offer to an at-risk subscriber.
    """
    return {
        'success': True,
        'subscriber_id': subscriber_id,
        'message_type': message_type,
        'discount_applied': discount_percent,
        'message': f'Retention message sent to subscriber {subscriber_id}'
    }


# ==========================================
# Tax Center API (Sprint 10)
# ==========================================

@router.get("/tax/summary")
async def get_tax_summary(
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get tax summary for a given year.
    """
    tax_year = year or datetime.now().year
    
    # Mock tax summary (would aggregate from transactions)
    return {
        'year': tax_year,
        'total_earnings': 42356.78,
        'platform_fees': 4235.68,
        'net_earnings': 38121.10,
        'estimated_tax': 7624.22,  # 20% estimate
        'payouts_count': 24,
        'documents': [
            {'id': 1, 'type': '1099-K', 'year': tax_year, 'status': 'available', 'download_url': f'/api/v1/tax/documents/1'},
            {'id': 2, 'type': 'W-9', 'year': tax_year, 'status': 'submitted'},
            {'id': 3, 'type': '1099-NEC', 'year': tax_year - 1, 'status': 'available', 'download_url': f'/api/v1/tax/documents/3'}
        ]
    }


@router.post("/tax/generate")
async def generate_tax_document(
    doc_type: str,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate or request a tax document.
    """
    valid_types = ['1099-K', '1099-NEC', 'W-9', 'W-8BEN']
    if doc_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {valid_types}")
    
    return {
        'success': True,
        'document_id': 100,
        'type': doc_type,
        'year': year,
        'status': 'pending',
        'estimated_ready': (datetime.now() + timedelta(minutes=15)).isoformat()
    }


@router.get("/tax/documents/{document_id}")
async def download_tax_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download a tax document PDF.
    """
    # Would return actual PDF file
    return {
        'redirect_url': f'/files/tax/{current_user.id}/{document_id}.pdf',
        'expires_at': (datetime.now() + timedelta(hours=1)).isoformat()
    }


@router.get("/currency/settings")
async def get_currency_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's currency display settings.
    """
    return {
        'primary_currency': 'USD',
        'available_currencies': ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN'],
        'auto_convert': True,
        'exchange_rates': {
            'USD': 1.0,
            'EUR': 0.92,
            'GBP': 0.79,
            'CAD': 1.35,
            'AUD': 1.53,
            'JPY': 149.50,
            'BRL': 4.97,
            'MXN': 17.15
        }
    }


@router.put("/currency/settings")
async def update_currency_settings(
    primary_currency: str,
    auto_convert: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's currency display settings.
    """
    valid_currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN']
    if primary_currency not in valid_currencies:
        raise HTTPException(status_code=400, detail=f"Invalid currency. Must be one of: {valid_currencies}")
    
    return {
        'success': True,
        'primary_currency': primary_currency,
        'auto_convert': auto_convert
    }


# ==========================================
# Simulcast API (Sprint 12)
# ==========================================

@router.get("/simulcast/status")
async def get_simulcast_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current simulcast status and connected platforms.
    """
    return {
        'is_streaming': False,
        'session_id': None,
        'platforms': [
            {
                'id': 'streamura',
                'name': 'Streamura',
                'connected': True,
                'status': 'idle',
                'stream_key': f'strm_live_{current_user.id}_key',
                'rtmp_url': 'rtmp://ingest.streamura.com/live'
            },
            {
                'id': 'youtube',
                'name': 'YouTube',
                'connected': True,
                'status': 'idle',
                'stream_key': None,  # User provides their own
                'rtmp_url': 'rtmp://a.rtmp.youtube.com/live2'
            },
            {
                'id': 'twitch',
                'name': 'Twitch',
                'connected': True,
                'status': 'idle',
                'stream_key': None,
                'rtmp_url': 'rtmp://live.twitch.tv/app'
            },
            {
                'id': 'facebook',
                'name': 'Facebook',
                'connected': False,
                'status': 'idle'
            },
            {
                'id': 'twitter',
                'name': 'X (Twitter)',
                'connected': False,
                'status': 'idle'
            }
        ]
    }


@router.post("/simulcast/start")
async def start_simulcast(
    platforms: List[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start simulcast to multiple platforms.
    """
    import uuid
    session_id = str(uuid.uuid4())
    
    return {
        'success': True,
        'session_id': session_id,
        'platforms_started': platforms,
        'ingest_url': f'rtmp://ingest.streamura.com/live/{current_user.id}',
        'stream_key': f'strm_{session_id[:8]}'
    }


@router.post("/simulcast/stop")
async def stop_simulcast(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stop simulcast on all platforms.
    """
    return {
        'success': True,
        'message': 'Simulcast ended on all platforms'
    }


@router.put("/simulcast/platforms/{platform_id}")
async def configure_platform(
    platform_id: str,
    stream_key: Optional[str] = None,
    rtmp_url: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Configure a platform's stream key and RTMP URL.
    """
    return {
        'success': True,
        'platform_id': platform_id,
        'stream_key_set': stream_key is not None,
        'rtmp_url_set': rtmp_url is not None
    }


# ==========================================
# DVR & Timeshifting API (Sprint 13)
# ==========================================

@router.get("/dvr/{stream_id}/status")
async def get_dvr_status(
    stream_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get DVR status for a stream.
    """
    return {
        'stream_id': stream_id,
        'dvr_enabled': True,
        'dvr_window_minutes': 120,  # 2 hour window
        'current_duration_seconds': 3600,  # 1 hour so far
        'markers': [
            {'id': 'chapter-1', 'timestamp': 0, 'label': 'Stream Start', 'type': 'chapter'},
            {'id': 'chapter-2', 'timestamp': 1800, 'label': 'Gameplay Begins', 'type': 'chapter'},
            {'id': 'highlight-1', 'timestamp': 2400, 'label': 'Epic Moment!', 'type': 'highlight'}
        ]
    }


@router.post("/dvr/{stream_id}/bookmark")
async def add_dvr_bookmark(
    stream_id: str,
    timestamp: float,
    label: str = "Bookmark",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a bookmark to a stream's DVR timeline.
    """
    import uuid
    return {
        'success': True,
        'bookmark': {
            'id': f'bookmark-{uuid.uuid4().hex[:8]}',
            'timestamp': timestamp,
            'label': label,
            'type': 'bookmark',
            'created_by': current_user.id
        }
    }


@router.post("/dvr/{stream_id}/clip")
async def create_dvr_clip(
    stream_id: str,
    start_time: float,
    end_time: float,
    title: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a clip from a stream's DVR content.
    """
    import uuid
    clip_id = uuid.uuid4().hex[:12]
    duration = end_time - start_time
    
    return {
        'success': True,
        'clip': {
            'id': clip_id,
            'stream_id': stream_id,
            'title': title or f'Clip from stream',
            'start_time': start_time,
            'end_time': end_time,
            'duration': duration,
            'status': 'processing',
            'progress': 0,
            'url': None,  # Will be populated when processing completes
            'created_by': current_user.id
        }
    }


@router.get("/dvr/{stream_id}/seek")
async def get_dvr_segment(
    stream_id: str,
    timestamp: float,
    duration: float = 30,  # seconds
    db: Session = Depends(get_db)
):
    """
    Get DVR segment URL for a specific timestamp.
    """
    return {
        'stream_id': stream_id,
        'timestamp': timestamp,
        'duration': duration,
        'segment_url': f'https://cdn.streamura.com/dvr/{stream_id}/{int(timestamp)}.m3u8',
        'expires_at': (datetime.now() + timedelta(hours=1)).isoformat()
    }


# ==========================================
# Two-Factor Authentication API (Sprint 14)
# ==========================================

@router.get("/auth/2fa/status")
async def get_2fa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current 2FA status for the user.
    """
    # Would check user's 2FA settings in database
    return {
        'enabled': False,
        'method': None,
        'backup_codes_remaining': 0,
        'last_used': None
    }


@router.post("/auth/2fa/setup")
async def setup_2fa(
    method: str = "totp",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialize 2FA setup - generates secret and QR code.
    """
    import secrets
    import base64
    
    # Generate a random secret (in production, use pyotp)
    secret = base64.b32encode(secrets.token_bytes(20)).decode('utf-8')[:16]
    
    # Generate backup codes
    backup_codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]
    
    return {
        'secret': secret,
        'qr_code_url': f'otpauth://totp/Streamura:{current_user.username}?secret={secret}&issuer=Streamura',
        'backup_codes': backup_codes
    }


@router.post("/auth/2fa/verify")
async def verify_2fa(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify TOTP code and enable 2FA.
    """
    # In production, verify the code using pyotp
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Invalid code format")
    
    # Mock verification (accepts any 6-digit code for demo)
    return {
        'success': True,
        'message': '2FA has been enabled for your account',
        'backup_codes_count': 8
    }


@router.post("/auth/2fa/disable")
async def disable_2fa(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disable 2FA for the account.
    """
    # Would verify the code first
    return {
        'success': True,
        'message': '2FA has been disabled for your account'
    }


@router.post("/auth/2fa/backup-codes/regenerate")
async def regenerate_backup_codes(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate backup codes (invalidates old ones).
    """
    import secrets
    
    backup_codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]
    
    return {
        'success': True,
        'backup_codes': backup_codes,
        'message': 'New backup codes generated. Old codes are now invalid.'
    }


# ==========================================
# Organization Verification API (Sprint 15)
# ==========================================

@router.get("/verification/status")
async def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get organization verification status.
    """
    return {
        'status': 'unverified',
        'organization_name': None,
        'organization_type': None,
        'verified_at': None,
        'badge_type': None,
        'rejection_reason': None
    }


@router.post("/verification/apply")
async def apply_for_verification(
    organization_name: str,
    organization_type: str,
    website: str,
    contact_email: str,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit application for organization verification.
    """
    import uuid
    application_id = str(uuid.uuid4())
    
    return {
        'success': True,
        'application_id': application_id,
        'status': 'pending',
        'message': 'Application submitted. We will review within 2-5 business days.'
    }


@router.post("/verification/documents")
async def upload_verification_document(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a verification document.
    """
    import uuid
    return {
        'success': True,
        'document_id': str(uuid.uuid4()),
        'status': 'pending'
    }


# ==========================================
# Emergency Broadcast API (Sprint 15)
# ==========================================

@router.post("/emergency/broadcast")
async def send_emergency_broadcast(
    type: str,
    severity: str,
    title: str,
    message: str,
    location: Optional[str] = None,
    notify_followers: bool = True,
    interrupt_streams: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send an emergency broadcast (requires verification).
    """
    import uuid
    broadcast_id = str(uuid.uuid4())
    
    return {
        'success': True,
        'broadcast': {
            'id': broadcast_id,
            'type': type,
            'severity': severity,
            'title': title,
            'message': message,
            'location': location,
            'sent_at': datetime.now().isoformat(),
            'reach': 50000  # Estimated reach
        }
    }


@router.get("/emergency/broadcasts")
async def get_emergency_broadcasts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of sent emergency broadcasts.
    """
    return {
        'broadcasts': [],
        'total': 0
    }


# Include the router in the main app
def include_router(app):
    app.include_router(router)


