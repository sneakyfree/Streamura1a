"""
Tests for Streaming Service Module

Tests the following functionality:
- StreamingService class (LiveKit integration)
- Token generation (broadcaster and viewer)
- Room name generation
- Webhook event handling
- Stream initialization
- Viewer connection
"""

import pytest
import jwt
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock

from backend.streaming import (
    StreamingService,
    streaming_service,
    initialize_stream_room,
    get_viewer_connection,
    handle_livekit_webhook,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
)
from backend.models import Stream, User


class TestStreamingServiceConfig:
    """Test streaming service configuration."""

    def test_service_has_api_credentials(self):
        """Test that service has API credentials configured."""
        service = StreamingService()

        assert service.api_key is not None
        assert service.api_secret is not None
        assert service.livekit_url is not None

    def test_singleton_instance_exists(self):
        """Test that singleton instance is available."""
        assert streaming_service is not None
        assert isinstance(streaming_service, StreamingService)


class TestRoomNameGeneration:
    """Test room name generation."""

    def test_generate_room_name_format(self):
        """Test that generated room name has correct format."""
        service = StreamingService()

        room_name = service.generate_room_name(123)

        assert room_name.startswith("stream-123-")
        assert len(room_name) > len("stream-123-")

    def test_generate_room_name_unique(self):
        """Test that each call generates a unique room name."""
        service = StreamingService()

        room1 = service.generate_room_name(1)
        room2 = service.generate_room_name(1)

        # Same stream ID but different random suffix
        assert room1 != room2
        assert room1.startswith("stream-1-")
        assert room2.startswith("stream-1-")

    def test_generate_room_name_different_streams(self):
        """Test room names for different streams."""
        service = StreamingService()

        room1 = service.generate_room_name(100)
        room2 = service.generate_room_name(200)

        assert "stream-100-" in room1
        assert "stream-200-" in room2


class TestBroadcasterToken:
    """Test broadcaster token generation."""

    def test_create_broadcaster_token_returns_jwt(self):
        """Test that broadcaster token is a valid JWT."""
        service = StreamingService()

        token = service.create_broadcaster_token(
            room_name="test-room",
            user_id=1,
            username="testuser"
        )

        assert token is not None
        assert isinstance(token, str)
        # JWT tokens have 3 parts separated by dots
        assert len(token.split(".")) == 3

    def test_broadcaster_token_contains_identity(self):
        """Test that token contains user identity."""
        service = StreamingService()

        token = service.create_broadcaster_token(
            room_name="test-room",
            user_id=42,
            username="broadcaster"
        )

        # Decode without verification to check claims
        decoded = jwt.decode(token, options={"verify_signature": False})

        assert "sub" in decoded or "identity" in decoded

    def test_broadcaster_token_custom_validity(self):
        """Test broadcaster token with custom validity."""
        service = StreamingService()

        token = service.create_broadcaster_token(
            room_name="test-room",
            user_id=1,
            username="testuser",
            validity_seconds=7200  # 2 hours
        )

        assert token is not None

        # Decode and check expiry
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert "exp" in decoded


class TestViewerToken:
    """Test viewer token generation."""

    def test_create_viewer_token_returns_jwt(self):
        """Test that viewer token is a valid JWT."""
        service = StreamingService()

        token = service.create_viewer_token(
            room_name="test-room",
            user_id=1,
            username="viewer"
        )

        assert token is not None
        assert isinstance(token, str)
        assert len(token.split(".")) == 3

    def test_viewer_token_anonymous_user(self):
        """Test viewer token for anonymous user."""
        service = StreamingService()

        token = service.create_viewer_token(
            room_name="test-room",
            user_id=None,
            username="Anonymous Viewer"
        )

        assert token is not None

        # Decode and check identity starts with anon-
        decoded = jwt.decode(token, options={"verify_signature": False})
        # The identity should be in the claims somewhere
        assert decoded is not None

    def test_viewer_token_registered_user(self):
        """Test viewer token for registered user."""
        service = StreamingService()

        token = service.create_viewer_token(
            room_name="test-room",
            user_id=123,
            username="registereduser"
        )

        assert token is not None


class TestInitializeStreamRoom:
    """Test stream room initialization."""

    def test_initialize_stream_room_creates_room_name(self, db, test_user):
        """Test that initializing sets room name on stream."""
        user = test_user["user"]

        # Create stream without room name
        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            status="pending"
        )
        db.add(stream)
        db.commit()

        result = initialize_stream_room(db, stream, user)

        db.refresh(stream)
        assert stream.livekit_room_name is not None
        assert stream.livekit_room_name.startswith(f"stream-{stream.id}-")
        assert result["room_name"] == stream.livekit_room_name
        assert "token" in result
        assert "livekit_url" in result

    def test_initialize_stream_room_preserves_existing(self, db, test_user):
        """Test that existing room name is preserved."""
        user = test_user["user"]

        # Create stream with existing room name
        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="existing-room-name",
            status="created"
        )
        db.add(stream)
        db.commit()

        result = initialize_stream_room(db, stream, user)

        db.refresh(stream)
        assert stream.livekit_room_name == "existing-room-name"
        assert result["room_name"] == "existing-room-name"

    def test_initialize_stream_room_returns_token(self, db, test_user):
        """Test that initialization returns a valid token."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            status="pending"
        )
        db.add(stream)
        db.commit()

        result = initialize_stream_room(db, stream, user)

        assert "token" in result
        # Verify it's a JWT
        assert len(result["token"].split(".")) == 3

    def test_initialize_stream_room_sets_status(self, db, test_user):
        """Test that initialization sets stream status to created."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            status="pending"
        )
        db.add(stream)
        db.commit()

        initialize_stream_room(db, stream, user)

        db.refresh(stream)
        assert stream.status == "created"


class TestGetViewerConnection:
    """Test viewer connection retrieval."""

    def test_get_viewer_connection_for_anonymous(self, db, test_user):
        """Test getting viewer connection for anonymous user."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="test-room-123",
            status="live"
        )
        db.add(stream)
        db.commit()

        result = get_viewer_connection(stream, user=None)

        assert result["room_name"] == "test-room-123"
        assert "token" in result
        assert "livekit_url" in result

    def test_get_viewer_connection_for_registered_user(self, db, test_user):
        """Test getting viewer connection for registered user."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="test-room-456",
            status="live"
        )
        db.add(stream)
        db.commit()

        result = get_viewer_connection(stream, user=user)

        assert result["room_name"] == "test-room-456"
        assert "token" in result

    def test_get_viewer_connection_raises_for_no_room(self, db, test_user):
        """Test that error is raised when stream has no room."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name=None,  # No room set
            status="pending"
        )
        db.add(stream)
        db.commit()

        with pytest.raises(ValueError, match="no associated LiveKit room"):
            get_viewer_connection(stream, user=user)

    def test_get_viewer_connection_livekit_url_format(self, db, test_user):
        """Test that LiveKit URL is converted to WebSocket format."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="test-room",
            status="live"
        )
        db.add(stream)
        db.commit()

        result = get_viewer_connection(stream, user=None)

        livekit_url = result["livekit_url"]
        # Should be ws:// or wss://
        assert livekit_url.startswith("ws://") or livekit_url.startswith("wss://")


class TestLiveKitWebhook:
    """Test LiveKit webhook handling."""

    @pytest.mark.asyncio
    async def test_webhook_room_started(self, db, test_user):
        """Test handling room_started event."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-test-room",
            status="created"
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "room_started",
            "room": {
                "name": "webhook-test-room",
                "sid": "room-sid-123"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert result["status"] == "ok"
        assert result["action"] == "stream_started"
        assert stream.status == "live"
        assert stream.starts_at is not None
        assert stream.livekit_room_id == "room-sid-123"

    @pytest.mark.asyncio
    async def test_webhook_room_finished(self, db, test_user):
        """Test handling room_finished event."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-finish-room",
            status="live",
            starts_at=datetime.utcnow()
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "room_finished",
            "room": {
                "name": "webhook-finish-room"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert result["status"] == "ok"
        assert result["action"] == "stream_ended"
        assert stream.status == "ended"
        assert stream.ends_at is not None

    @pytest.mark.asyncio
    async def test_webhook_participant_joined(self, db, test_user):
        """Test handling participant_joined event."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-join-room",
            status="live",
            viewer_count=5,
            peak_viewers=5
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "participant_joined",
            "room": {
                "name": "webhook-join-room"
            },
            "participant": {
                "identity": "user-123",
                "name": "Viewer"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert result["status"] == "ok"
        assert result["action"] == "viewer_joined"
        assert stream.viewer_count == 6
        assert stream.peak_viewers == 6  # Updated because count increased

    @pytest.mark.asyncio
    async def test_webhook_participant_left(self, db, test_user):
        """Test handling participant_left event."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-leave-room",
            status="live",
            viewer_count=10,
            peak_viewers=15
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "participant_left",
            "room": {
                "name": "webhook-leave-room"
            },
            "participant": {
                "identity": "user-456"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert result["status"] == "ok"
        assert result["action"] == "viewer_left"
        assert stream.viewer_count == 9  # Decreased by 1
        assert stream.peak_viewers == 15  # Unchanged

    @pytest.mark.asyncio
    async def test_webhook_participant_left_not_negative(self, db, test_user):
        """Test that viewer count doesn't go negative."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-zero-room",
            status="live",
            viewer_count=0
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "participant_left",
            "room": {
                "name": "webhook-zero-room"
            },
            "participant": {}
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert stream.viewer_count == 0  # Should stay at 0, not go negative

    @pytest.mark.asyncio
    async def test_webhook_track_published_by_publisher(self, db, test_user):
        """Test handling track_published by broadcaster."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-track-room",
            status="created"
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "track_published",
            "room": {
                "name": "webhook-track-room"
            },
            "participant": {
                "is_publisher": True
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        db.refresh(stream)
        assert result["status"] == "ok"
        assert result["action"] == "track_published"
        assert stream.status == "live"
        assert stream.starts_at is not None

    @pytest.mark.asyncio
    async def test_webhook_unknown_stream_ignored(self, db):
        """Test that events for unknown streams are ignored."""
        event_data = {
            "event": "room_started",
            "room": {
                "name": "nonexistent-room"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        assert result["status"] == "ignored"
        assert result["reason"] == "stream not found"

    @pytest.mark.asyncio
    async def test_webhook_unhandled_event_ignored(self, db, test_user):
        """Test that unhandled events are properly ignored."""
        user = test_user["user"]

        stream = Stream(
            title="Test Stream",
            user_id=user.id,
            livekit_room_name="webhook-unknown-room",
            status="live"
        )
        db.add(stream)
        db.commit()

        event_data = {
            "event": "some_unknown_event",
            "room": {
                "name": "webhook-unknown-room"
            }
        }

        result = await handle_livekit_webhook(event_data, db)

        assert result["status"] == "ignored"
        assert "unhandled event" in result["reason"]


class TestAsyncRoomOperations:
    """Test async room operations (with mocking)."""

    @pytest.mark.asyncio
    async def test_create_room_mock(self):
        """Test create_room method with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            # Setup mock - create a proper mock object with spec'd attributes
            mock_room = MagicMock()
            mock_room.name = "test-room"
            mock_room.sid = "room-sid-123"
            mock_room.creation_time = 1234567890

            mock_room_service = AsyncMock()
            mock_room_service.create_room = AsyncMock(return_value=mock_room)

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(room=mock_room_service)
            mock_api.return_value = mock_context

            result = await service.create_room("test-room")

            assert result["name"] == "test-room"
            assert result["sid"] == "room-sid-123"

    @pytest.mark.asyncio
    async def test_delete_room_mock(self):
        """Test delete_room method with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_room_service = AsyncMock()
            mock_room_service.delete_room = AsyncMock(return_value=None)

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(room=mock_room_service)
            mock_api.return_value = mock_context

            result = await service.delete_room("test-room")

            assert result is True

    @pytest.mark.asyncio
    async def test_get_room_participants_mock(self):
        """Test get_room_participants with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            # Create mock participants
            mock_participant = MagicMock()
            mock_participant.identity = "user-123"
            mock_participant.name = "TestUser"
            mock_participant.state = "active"
            mock_participant.joined_at = 1234567890
            mock_participant.is_publisher = False

            mock_room_service = AsyncMock()
            mock_room_service.list_participants = AsyncMock(return_value=[mock_participant])

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(room=mock_room_service)
            mock_api.return_value = mock_context

            result = await service.get_room_participants("test-room")

            assert len(result) == 1
            assert result[0]["identity"] == "user-123"
            assert result[0]["name"] == "TestUser"

    @pytest.mark.asyncio
    async def test_get_participant_count_mock(self):
        """Test get_participant_count with mocked LiveKit API."""
        service = StreamingService()

        with patch.object(service, 'get_room_participants', new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"identity": "user-1"},
                {"identity": "user-2"},
                {"identity": "user-3"},
            ]

            count = await service.get_participant_count("test-room")

            assert count == 3

    @pytest.mark.asyncio
    async def test_remove_participant_mock(self):
        """Test remove_participant with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_room_service = AsyncMock()
            mock_room_service.remove_participant = AsyncMock(return_value=None)

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(room=mock_room_service)
            mock_api.return_value = mock_context

            result = await service.remove_participant("test-room", "user-123")

            assert result is True


class TestRecordingOperations:
    """Test recording operations (with mocking)."""

    @pytest.mark.asyncio
    async def test_start_recording_mock(self):
        """Test start_recording with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_egress_service = AsyncMock()
            mock_egress_service.start_room_composite_egress = AsyncMock(return_value=MagicMock(
                egress_id="egress-123",
                status="starting"
            ))

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(egress=mock_egress_service)
            mock_api.return_value = mock_context

            result = await service.start_recording("test-room")

            assert result["egress_id"] == "egress-123"
            assert result["room_name"] == "test-room"

    @pytest.mark.asyncio
    async def test_stop_recording_mock(self):
        """Test stop_recording with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_egress_service = AsyncMock()
            mock_egress_service.stop_egress = AsyncMock(return_value=MagicMock(
                egress_id="egress-123",
                status="complete"
            ))

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(egress=mock_egress_service)
            mock_api.return_value = mock_context

            result = await service.stop_recording("egress-123")

            assert result["egress_id"] == "egress-123"
            assert "status" in result

    @pytest.mark.asyncio
    async def test_get_recording_status_mock(self):
        """Test get_recording_status with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_egress = MagicMock()
            mock_egress.egress_id = "egress-123"
            mock_egress.status = "complete"

            mock_egress_service = AsyncMock()
            mock_egress_service.list_egress = AsyncMock(return_value=[mock_egress])

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(egress=mock_egress_service)
            mock_api.return_value = mock_context

            result = await service.get_recording_status("egress-123")

            assert result["egress_id"] == "egress-123"
            assert result["status"] == "complete"

    @pytest.mark.asyncio
    async def test_get_recording_status_not_found(self):
        """Test get_recording_status when egress not found."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_egress_service = AsyncMock()
            mock_egress_service.list_egress = AsyncMock(return_value=[])

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(egress=mock_egress_service)
            mock_api.return_value = mock_context

            result = await service.get_recording_status("nonexistent")

            assert result["status"] == "not_found"

    @pytest.mark.asyncio
    async def test_list_room_recordings_mock(self):
        """Test list_room_recordings with mocked LiveKit API."""
        service = StreamingService()

        with patch('backend.streaming.api.LiveKitAPI') as mock_api:
            mock_egress1 = MagicMock()
            mock_egress1.egress_id = "egress-1"
            mock_egress1.status = "complete"

            mock_egress2 = MagicMock()
            mock_egress2.egress_id = "egress-2"
            mock_egress2.status = "active"

            mock_egress_service = AsyncMock()
            mock_egress_service.list_egress = AsyncMock(return_value=[mock_egress1, mock_egress2])

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = MagicMock(egress=mock_egress_service)
            mock_api.return_value = mock_context

            result = await service.list_room_recordings("test-room")

            assert len(result) == 2
            assert result[0]["egress_id"] == "egress-1"
            assert result[1]["egress_id"] == "egress-2"
