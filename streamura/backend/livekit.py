"""
Streamura LiveKit Integration - Enhanced Demo Mode

When LiveKit is not available, provides a fully functional mock
that simulates streaming behavior for demos.
"""

import os
import uuid
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

# Check if real LiveKit is available
DEMO_MODE = os.getenv("STREAMURA_DEMO_MODE", "true").lower() == "true"

# Mock stream states for demo
_demo_streams: Dict[str, Dict[str, Any]] = {}
_demo_viewers: Dict[str, int] = {}


class MockVideoGrant:
    """Mock video grant for demo mode."""
    def __init__(self, **kwargs):
        self.room_join = kwargs.get("room_join", True)
        self.room = kwargs.get("room", "")
        self.can_publish = kwargs.get("can_publish", False)
        self.can_publish_data = kwargs.get("can_publish_data", False)
        self.can_subscribe = kwargs.get("can_subscribe", True)


class MockAccessToken:
    """Mock access token generator for demo mode."""
    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.identity = None
        self.name = None
        self.ttl = timedelta(hours=6)
        self.grants = None
    
    def with_identity(self, identity: str) -> "MockAccessToken":
        self.identity = identity
        return self
    
    def with_name(self, name: str) -> "MockAccessToken":
        self.name = name
        return self
    
    def with_ttl(self, ttl: timedelta) -> "MockAccessToken":
        self.ttl = ttl
        return self
    
    def with_grants(self, grants: MockVideoGrant) -> "MockAccessToken":
        self.grants = grants
        return self
    
    def to_jwt(self) -> str:
        """Generate a real (signed) JWT encoding identity + video grants.

        Produces a standards-shaped LiveKit-style JWT (3 segments) so clients
        and tests can decode the claims. Signed with the api_secret (HS256).
        """
        import jwt as _jwt

        now = int(time.time())
        ttl_seconds = int(self.ttl.total_seconds()) if self.ttl else 21600
        grants = self.grants
        video = {
            "roomJoin": getattr(grants, "room_join", True) if grants else True,
            "room": getattr(grants, "room", "") if grants else "",
            "canPublish": getattr(grants, "can_publish", False) if grants else False,
            "canPublishData": getattr(grants, "can_publish_data", False) if grants else False,
            "canSubscribe": getattr(grants, "can_subscribe", True) if grants else True,
        }
        claims = {
            "iss": self.api_key,
            "sub": self.identity or "",
            "identity": self.identity or "",
            "name": self.name or "",
            "nbf": now,
            "iat": now,
            "exp": now + ttl_seconds,
            "video": video,
        }
        token = _jwt.encode(claims, self.api_secret or "secret", algorithm="HS256")
        # PyJWT>=2 returns str; older returns bytes
        return token.decode("utf-8") if isinstance(token, bytes) else token


class MockRoomService:
    """Mock room service for managing demo streams."""
    
    def create_room(self, name: str, **kwargs) -> Dict[str, Any]:
        """Create a demo streaming room."""
        room = {
            "name": name,
            "sid": f"RM_{uuid.uuid4().hex[:12]}",
            "created_at": datetime.utcnow().isoformat(),
            "num_participants": 0,
            "active_recording": False,
            "demo_mode": True,
        }
        _demo_streams[name] = room
        _demo_viewers[name] = 0
        return room
    
    def list_rooms(self) -> List[Dict[str, Any]]:
        """List all active demo rooms."""
        return list(_demo_streams.values())
    
    def delete_room(self, name: str) -> bool:
        """End a demo stream."""
        if name in _demo_streams:
            del _demo_streams[name]
            del _demo_viewers[name]
            return True
        return False
    
    def get_room(self, name: str) -> Optional[Dict[str, Any]]:
        """Get room info."""
        return _demo_streams.get(name)
    
    def add_viewer(self, room_name: str) -> int:
        """Add a viewer to a demo stream."""
        if room_name in _demo_viewers:
            _demo_viewers[room_name] += 1
        return _demo_viewers.get(room_name, 0)
    
    def remove_viewer(self, room_name: str) -> int:
        """Remove a viewer from a demo stream."""
        if room_name in _demo_viewers and _demo_viewers[room_name] > 0:
            _demo_viewers[room_name] -= 1
        return _demo_viewers.get(room_name, 0)
    
    def get_viewer_count(self, room_name: str) -> int:
        """Get current viewer count."""
        return _demo_viewers.get(room_name, 0)


class MockEgressService:
    """Mock egress service for recording streams."""
    
    def start_room_composite_egress(self, room_name: str, **kwargs) -> Dict[str, Any]:
        """Start recording a demo stream."""
        return {
            "egress_id": f"EG_{uuid.uuid4().hex[:12]}",
            "room_name": room_name,
            "status": "recording",
            "started_at": datetime.utcnow().isoformat(),
            "demo_mode": True,
        }
    
    def stop_egress(self, egress_id: str) -> Dict[str, Any]:
        """Stop recording."""
        return {
            "egress_id": egress_id,
            "status": "complete",
            "ended_at": datetime.utcnow().isoformat(),
        }


class _MockRequest:
    """Generic request stub mirroring the real livekit.api request protos.

    Accepts and stores any keyword arguments so service code that constructs
    api.CreateRoomRequest(...), api.S3Upload(...), etc. works unchanged.
    """
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class _MockEncodedFileType:
    MP4 = "MP4"
    OGG = "OGG"


class _MockAsyncRoomService:
    """Async room service used by the mock LiveKitAPI context manager."""
    async def create_room(self, req):
        name = getattr(req, "name", None) or "demo-room"
        info = MockRoomService().create_room(name)
        return _MockRequest(name=info["name"], sid=info["sid"], creation_time=int(time.time()))

    async def delete_room(self, req):
        name = getattr(req, "room", None)
        if name:
            MockRoomService().delete_room(name)
        return None

    async def list_participants(self, req):
        return []

    async def remove_participant(self, req):
        return None


class _MockAsyncEgressService:
    """Async egress service used by the mock LiveKitAPI context manager."""
    async def start_room_composite_egress(self, req):
        return _MockRequest(egress_id=f"EG_{uuid.uuid4().hex[:12]}", status="EGRESS_STARTING")

    async def stop_egress(self, req):
        eid = getattr(req, "egress_id", None) or f"EG_{uuid.uuid4().hex[:12]}"
        return _MockRequest(egress_id=eid, status="EGRESS_COMPLETE")

    async def list_egress(self, req):
        return []


class DemoLiveKitAPI:
    """Async-context-manager mock of livekit.api.LiveKitAPI for demo mode.

    Exists so service code can `async with api.LiveKitAPI(...) as lk:` and so
    tests can patch `backend.streaming.api.LiveKitAPI`.
    """
    def __init__(self, url: str = None, api_key: str = None, api_secret: str = None, *args, **kwargs):
        self.url = url
        self.room = _MockAsyncRoomService()
        self.egress = _MockAsyncEgressService()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def aclose(self):
        return None


class DemoAPI:
    """Demo mode API that simulates LiveKit functionality."""

    VideoGrant = MockVideoGrant
    # Real LiveKit SDK exposes `VideoGrants` (plural); streaming.py uses that name.
    VideoGrants = MockVideoGrant
    AccessToken = MockAccessToken
    # Async API + request protos (mirror livekit.api surface used by streaming.py)
    LiveKitAPI = DemoLiveKitAPI
    CreateRoomRequest = _MockRequest
    DeleteRoomRequest = _MockRequest
    ListParticipantsRequest = _MockRequest
    RoomParticipantIdentity = _MockRequest
    S3Upload = _MockRequest
    RoomCompositeEgressRequest = _MockRequest
    EncodedFileOutput = _MockRequest
    EncodedFileType = _MockEncodedFileType
    ListEgressRequest = _MockRequest
    StopEgressRequest = _MockRequest

    def __init__(self):
        self.room_service = MockRoomService()
        self.egress_service = MockEgressService()

    def create_token(self, api_key: str, api_secret: str) -> MockAccessToken:
        """Create a new access token."""
        return MockAccessToken(api_key, api_secret)


# Export the API - either real LiveKit or demo mode
try:
    if not DEMO_MODE:
        from livekit import api as real_api
        api = real_api
        LIVEKIT_AVAILABLE = True
    else:
        api = DemoAPI()
        LIVEKIT_AVAILABLE = False
except ImportError:
    api = DemoAPI()
    LIVEKIT_AVAILABLE = False


# Utility functions for demo mode
def is_demo_mode() -> bool:
    """Check if running in demo mode."""
    return not LIVEKIT_AVAILABLE or DEMO_MODE


def get_demo_stream_info(room_name: str) -> Optional[Dict[str, Any]]:
    """Get demo stream info."""
    return _demo_streams.get(room_name)


def simulate_viewer_activity(room_name: str, add: bool = True) -> int:
    """Simulate viewer joining/leaving for demo."""
    if add:
        return api.room_service.add_viewer(room_name) if hasattr(api, 'room_service') else 0
    return api.room_service.remove_viewer(room_name) if hasattr(api, 'room_service') else 0
