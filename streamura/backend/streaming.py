"""
Streamura Streaming Service

Handles LiveKit integration for real-time video streaming.
"""

import os
import time
import uuid
from typing import Optional
from datetime import datetime, timedelta

from livekit import api
from sqlalchemy.orm import Session

from .models import Stream, User, Recording


# LiveKit configuration from environment
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret_dev_key_do_not_use_in_production")


class StreamingService:
    """Service for managing LiveKit streaming operations."""

    def __init__(self):
        self.api_key = LIVEKIT_API_KEY
        self.api_secret = LIVEKIT_API_SECRET
        self.livekit_url = LIVEKIT_URL

    def generate_room_name(self, stream_id: int) -> str:
        """Generate a unique room name for a stream."""
        return f"stream-{stream_id}-{uuid.uuid4().hex[:8]}"

    def create_broadcaster_token(
        self,
        room_name: str,
        user_id: int,
        username: str,
        validity_seconds: int = 3600 * 6,  # 6 hours default
    ) -> str:
        """
        Create a token for a broadcaster (streamer) to publish video.

        Args:
            room_name: The LiveKit room name
            user_id: The user's database ID
            username: Display name for the participant
            validity_seconds: Token validity in seconds

        Returns:
            JWT token string for LiveKit connection
        """
        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity(f"user-{user_id}")
        token.with_name(username)
        token.with_ttl(timedelta(seconds=validity_seconds))

        # Grant broadcaster permissions
        grant = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_publish_data=True,
            can_subscribe=True,
        )
        token.with_grants(grant)

        return token.to_jwt()

    def create_viewer_token(
        self,
        room_name: str,
        user_id: Optional[int] = None,
        username: str = "Anonymous Viewer",
        validity_seconds: int = 3600 * 4,  # 4 hours default
    ) -> str:
        """
        Create a token for a viewer to watch a stream.

        Args:
            room_name: The LiveKit room name
            user_id: Optional user database ID (None for anonymous)
            username: Display name for the participant
            validity_seconds: Token validity in seconds

        Returns:
            JWT token string for LiveKit connection
        """
        identity = f"user-{user_id}" if user_id else f"anon-{uuid.uuid4().hex[:12]}"

        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity(identity)
        token.with_name(username)
        token.with_ttl(timedelta(seconds=validity_seconds))

        # Grant viewer-only permissions
        grant = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,
            can_publish_data=True,  # Allow chat messages
            can_subscribe=True,
        )
        token.with_grants(grant)

        return token.to_jwt()

    async def create_room(self, room_name: str) -> dict:
        """
        Create a new LiveKit room.

        Args:
            room_name: Unique name for the room

        Returns:
            Room creation response
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            room = await lk_api.room.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,  # 5 minutes
                    max_participants=100,
                )
            )

            return {
                "name": room.name,
                "sid": room.sid,
                "creation_time": room.creation_time,
            }

    async def delete_room(self, room_name: str) -> bool:
        """
        Delete a LiveKit room.

        Args:
            room_name: Name of the room to delete

        Returns:
            True if successful
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            await lk_api.room.delete_room(
                api.DeleteRoomRequest(room=room_name)
            )
            return True

    async def get_room_participants(self, room_name: str) -> list:
        """
        Get list of participants in a room.

        Args:
            room_name: Name of the room

        Returns:
            List of participant info dictionaries
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            participants = await lk_api.room.list_participants(
                api.ListParticipantsRequest(room=room_name)
            )

            return [
                {
                    "identity": p.identity,
                    "name": p.name,
                    "state": p.state,
                    "joined_at": p.joined_at,
                    "is_publisher": p.is_publisher,
                }
                for p in participants
            ]

    async def get_participant_count(self, room_name: str) -> int:
        """Get the number of participants in a room."""
        participants = await self.get_room_participants(room_name)
        return len(participants)

    async def remove_participant(self, room_name: str, identity: str) -> bool:
        """
        Remove a participant from a room.

        Args:
            room_name: Name of the room
            identity: Participant identity to remove

        Returns:
            True if successful
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            await lk_api.room.remove_participant(
                api.RoomParticipantIdentity(room=room_name, identity=identity)
            )
            return True

    async def start_recording(
        self,
        room_name: str,
        output_prefix: str = "recordings",
        s3_bucket: Optional[str] = None,
    ) -> dict:
        """
        Start recording a LiveKit room using Egress API.

        Args:
            room_name: Name of the room to record
            output_prefix: Prefix for output file path
            s3_bucket: Optional S3 bucket name (uses env var if not provided)

        Returns:
            Dictionary with egress_id and status
        """
        # Get S3 configuration from environment
        s3_bucket = s3_bucket or os.getenv("S3_BUCKET", "streamura-recordings")
        s3_region = os.getenv("S3_REGION", "us-east-1")
        s3_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        s3_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")

        # Generate unique output path
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_path = f"{output_prefix}/{room_name}/{timestamp}"

        # Configure S3 output
        s3_output = api.S3Upload(
            bucket=s3_bucket,
            region=s3_region,
            access_key=s3_access_key,
            secret=s3_secret_key,
        )

        # Use LiveKitAPI for egress operations
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            # Start room composite egress (records the whole room)
            egress = await lk_api.egress.start_room_composite_egress(
                api.RoomCompositeEgressRequest(
                    room_name=room_name,
                    file_outputs=[
                        api.EncodedFileOutput(
                            file_type=api.EncodedFileType.MP4,
                            filepath=f"{output_path}.mp4",
                            s3=s3_output,
                        )
                    ],
                )
            )

            return {
                "egress_id": egress.egress_id,
                "status": str(egress.status),
                "room_name": room_name,
                "output_path": f"{output_path}.mp4",
            }

    async def stop_recording(self, egress_id: str) -> dict:
        """
        Stop an active recording.

        Args:
            egress_id: The egress ID from start_recording

        Returns:
            Dictionary with final status
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            egress = await lk_api.egress.stop_egress(
                api.StopEgressRequest(egress_id=egress_id)
            )

            return {
                "egress_id": egress.egress_id,
                "status": str(egress.status),
            }

    async def get_recording_status(self, egress_id: str) -> dict:
        """
        Get the status of a recording.

        Args:
            egress_id: The egress ID to check

        Returns:
            Dictionary with current status and info
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            # List all egresses and find the one we want
            egresses = await lk_api.egress.list_egress(
                api.ListEgressRequest(egress_id=egress_id)
            )

            if egresses:
                egress = egresses[0]
                return {
                    "egress_id": egress.egress_id,
                    "status": str(egress.status),
                    "started_at": egress.started_at if hasattr(egress, 'started_at') else None,
                    "ended_at": egress.ended_at if hasattr(egress, 'ended_at') else None,
                }

            return {"egress_id": egress_id, "status": "not_found"}

    async def list_room_recordings(self, room_name: str) -> list:
        """
        List all recordings for a room.

        Args:
            room_name: Name of the room

        Returns:
            List of recording info dictionaries
        """
        async with api.LiveKitAPI(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        ) as lk_api:
            egresses = await lk_api.egress.list_egress(
                api.ListEgressRequest(room_name=room_name)
            )

            return [
                {
                    "egress_id": e.egress_id,
                    "status": str(e.status),
                    "room_name": room_name,
                }
                for e in egresses
            ]


# Singleton instance
streaming_service = StreamingService()


def initialize_stream_room(db: Session, stream: Stream, user: User) -> dict:
    """
    Initialize a LiveKit room for a stream and return connection info.

    Args:
        db: Database session
        stream: Stream model instance
        user: User model instance (the broadcaster)

    Returns:
        Dictionary with room_name and broadcaster_token
    """
    # Generate unique room name if not already set
    if not stream.livekit_room_name:
        stream.livekit_room_name = streaming_service.generate_room_name(stream.id)
        stream.status = "created"
        db.commit()
        db.refresh(stream)

    # Generate broadcaster token
    username = user.username or f"Streamer {user.id}"
    token = streaming_service.create_broadcaster_token(
        room_name=stream.livekit_room_name,
        user_id=user.id,
        username=username,
    )

    return {
        "room_name": stream.livekit_room_name,
        "token": token,
        "livekit_url": LIVEKIT_URL.replace("http://", "ws://").replace("https://", "wss://"),
    }


def get_viewer_connection(stream: Stream, user: Optional[User] = None) -> dict:
    """
    Get viewer connection info for a stream.

    Args:
        stream: Stream model instance
        user: Optional User model instance (None for anonymous)

    Returns:
        Dictionary with room_name and viewer_token
    """
    if not stream.livekit_room_name:
        raise ValueError("Stream has no associated LiveKit room")

    username = "Anonymous Viewer"
    user_id = None

    if user:
        username = user.username or f"Viewer {user.id}"
        user_id = user.id

    token = streaming_service.create_viewer_token(
        room_name=stream.livekit_room_name,
        user_id=user_id,
        username=username,
    )

    return {
        "room_name": stream.livekit_room_name,
        "token": token,
        "livekit_url": LIVEKIT_URL.replace("http://", "ws://").replace("https://", "wss://"),
    }


async def handle_livekit_webhook(event_data: dict, db: Session) -> dict:
    """
    Handle incoming LiveKit webhook events.

    Args:
        event_data: Webhook event payload
        db: Database session

    Returns:
        Processing result
    """
    event_type = event_data.get("event")
    room = event_data.get("room", {})
    participant = event_data.get("participant", {})

    room_name = room.get("name", "")

    # Find the stream by room name
    stream = db.query(Stream).filter(
        Stream.livekit_room_name == room_name
    ).first()

    if not stream:
        return {"status": "ignored", "reason": "stream not found"}

    if event_type == "room_started":
        stream.status = "live"
        stream.starts_at = datetime.utcnow()
        stream.livekit_room_id = room.get("sid")
        db.commit()
        return {"status": "ok", "action": "stream_started"}

    elif event_type == "room_finished":
        stream.status = "ended"
        stream.ends_at = datetime.utcnow()
        db.commit()
        return {"status": "ok", "action": "stream_ended"}

    elif event_type == "participant_joined":
        stream.viewer_count = stream.viewer_count + 1
        if stream.viewer_count > stream.peak_viewers:
            stream.peak_viewers = stream.viewer_count
        db.commit()
        return {"status": "ok", "action": "viewer_joined"}

    elif event_type == "participant_left":
        stream.viewer_count = max(0, stream.viewer_count - 1)
        db.commit()
        return {"status": "ok", "action": "viewer_left"}

    elif event_type == "track_published":
        # Track when broadcaster starts publishing
        if participant.get("is_publisher"):
            stream.status = "live"
            if not stream.starts_at:
                stream.starts_at = datetime.utcnow()
            db.commit()
        return {"status": "ok", "action": "track_published"}

    return {"status": "ignored", "reason": f"unhandled event: {event_type}"}
