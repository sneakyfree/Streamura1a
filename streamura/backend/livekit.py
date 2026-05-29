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
        """Generate a mock JWT token that encodes demo stream info."""
        token_id = uuid.uuid4().hex[:16]
        room = self.grants.room if self.grants else "unknown"
        is_publisher = self.grants.can_publish if self.grants else False
        return f"demo_{room}_{token_id}_{'pub' if is_publisher else 'sub'}"


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


class DemoAPI:
    """Demo mode API that simulates LiveKit functionality."""
    
    VideoGrant = MockVideoGrant
    # Real LiveKit SDK exposes `VideoGrants` (plural); streaming.py uses that name.
    VideoGrants = MockVideoGrant
    AccessToken = MockAccessToken
    
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
