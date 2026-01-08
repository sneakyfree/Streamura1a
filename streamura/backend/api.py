"""
Streamura API Routes

This module contains all API endpoints for the Streamura backend.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, WebSocket, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
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
    get_current_active_user,
    get_current_user_optional,
    get_current_admin_user,
    UserCreate,
    UserLogin,
    UserResponse,
    Token
)
from .models import (
    User, Stream, Event, Notification, ChatMessage, UserFollow, StreamLike,
    Report, ModerationAction, Recording, ScheduledStream, StreamAnalytics,
    Tip, Transaction, ContentFilter, ModerationQueueItem, StreamModerationSettings, ChatMute,
    Conversation,
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
from .websocket import (
    manager as ws_manager,
    handle_websocket_connection,
    broadcast_stream_status,
    handle_dm_websocket_connection,
    send_dm_notification,
    send_dm_read_receipt,
    dm_manager,
)
import random
import string


# Pydantic models for streaming API
class StreamTokenResponse(BaseModel):
    room_name: str
    token: str
    livekit_url: str


class WebhookResponse(BaseModel):
    status: str
    action: Optional[str] = None
    reason: Optional[str] = None

router = APIRouter(prefix="/api/v1")

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
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

# User Routes
@router.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.get("/users/{user_id}", response_model=UserResponse)
async def read_user(user_id: int, db: Session = Depends(get_db)):
    """Get user information by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
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

@router.get("/streams/{stream_id}", response_model=StreamResponse)
async def read_stream(stream_id: int, db: Session = Depends(get_db)):
    """Get stream information"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return stream

@router.post("/streams/{stream_id}/start")
async def start_stream(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Start a stream"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to start this stream")

    stream.status = "live"
    stream.starts_at = datetime.utcnow()
    db.commit()

    # Invalidate caches when stream goes live
    cache = get_cache_service()
    await cache.invalidate_pattern("discover:*")

    return {"message": "Stream started successfully", "status": stream.status}

@router.post("/streams/{stream_id}/end")
async def end_stream(
    stream_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """End a stream"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to end this stream")

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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a broadcast token for streaming to LiveKit"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to broadcast on this stream")

    # Initialize room and get broadcaster token
    connection_info = initialize_stream_room(db, stream, current_user)

    return StreamTokenResponse(**connection_info)


@router.post("/streams/{stream_id}/viewer-token", response_model=StreamTokenResponse)
async def get_viewer_token(
    stream_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a viewer token to watch a stream"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if not stream.is_public and (not current_user or stream.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="This stream is private")

    if not stream.livekit_room_name:
        raise HTTPException(status_code=400, detail="Stream has not been initialized for broadcasting")

    # Get viewer connection info
    try:
        connection_info = get_viewer_connection(stream, current_user)
        return StreamTokenResponse(**connection_info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/streams/{stream_id}/status")
async def get_stream_status(
    stream_id: int,
    db: Session = Depends(get_db)
):
    """Get real-time stream status"""
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

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

    # TODO: Create notification job for followers if notify_followers is True

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


@router.get("/events/{event_id}", response_model=EventDetailResponse)
async def get_event_detail(event_id: int, db: Session = Depends(get_db)):
    """
    Get detailed event information including streams.

    Returns the event with all associated streams and
    the primary (best quality) stream highlighted.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

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
        raise HTTPException(status_code=404, detail="Notification not found")

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
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already following
    existing = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == current_user.id)
        .filter(UserFollow.following_id == user_id)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Already following this user")

    # Create follow
    follow = UserFollow(
        follower_id=current_user.id,
        following_id=user_id
    )
    db.add(follow)

    # Update counts
    target_user.follower_count = (target_user.follower_count or 0) + 1
    current_user.following_count = (current_user.following_count or 0) + 1

    db.commit()

    return {"message": "Successfully followed user", "following": True}


@router.delete("/users/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unfollow a user."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Find and delete follow
    follow = (
        db.query(UserFollow)
        .filter(UserFollow.follower_id == current_user.id)
        .filter(UserFollow.following_id == user_id)
        .first()
    )

    if not follow:
        raise HTTPException(status_code=400, detail="Not following this user")

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
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get list of users following this user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check if current user has liked the stream."""
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
    from models import MLPrediction

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
    from models import MLPrediction

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
    from models import CreatorPerformanceHistory

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


# Include the router in the main app
def include_router(app):
    app.include_router(router)
