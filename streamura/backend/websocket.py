"""
Streamura WebSocket Manager

Handles real-time updates for viewer counts, chat, and stream status.
"""

import os
import re
import json
import asyncio
from typing import Dict, Set, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
import redis.asyncio as redis

# Try to import profanity filter
try:
    from better_profanity import profanity
    profanity.load_censor_words()
    PROFANITY_AVAILABLE = True
except ImportError:
    PROFANITY_AVAILABLE = False
    profanity = None


# JWT configuration (must match auth.py)
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


class WebSocketModerator:
    """
    Lightweight content moderation for WebSocket chat messages.
    Uses in-memory checks without database access for low latency.
    """

    # Scam patterns
    SCAM_PATTERNS = [
        r'(?i)free\s*(vbucks|robux|nitro|crypto|bitcoin)',
        r'(?i)(click|visit)\s*this\s*link',
        r'(?i)free\s*gift\s*card',
        r'(?i)get\s*rich\s*quick',
        r'(?i)(grabify|iplogger|2no\.co)',
    ]

    # Critical keywords that always block
    CRITICAL_KEYWORDS = ['kys', 'kill yourself']

    def __init__(self):
        self.user_messages: Dict[int, list] = defaultdict(list)
        self.muted_users: Dict[str, Dict[int, datetime]] = defaultdict(dict)  # room -> user_id -> expires_at
        self.message_window = timedelta(seconds=30)
        self.spam_threshold = 5

    def is_muted(self, user_id: int, room: str) -> bool:
        """Check if user is muted in a room."""
        if user_id in self.muted_users.get(room, {}):
            expires = self.muted_users[room][user_id]
            if expires is None or expires > datetime.utcnow():
                return True
            else:
                # Mute expired, remove it
                del self.muted_users[room][user_id]
        return False

    def mute_user(self, user_id: int, room: str, duration_seconds: int = 60):
        """Mute a user in a room."""
        self.muted_users[room][user_id] = datetime.utcnow() + timedelta(seconds=duration_seconds)

    def check_message(self, content: str, user_id: int, room: str) -> Tuple[bool, Optional[str]]:
        """
        Check if a message should be allowed.
        Returns (is_allowed, block_reason).
        """
        if not content or not content.strip():
            return False, "Empty message"

        content_lower = content.lower().strip()

        # Check if user is muted
        if self.is_muted(user_id, room):
            return False, "You are muted"

        # Check critical keywords
        for keyword in self.CRITICAL_KEYWORDS:
            if keyword in content_lower:
                self.mute_user(user_id, room, 300)  # 5 minute mute
                return False, "Message blocked"

        # Check profanity
        if PROFANITY_AVAILABLE and profanity.contains_profanity(content):
            return False, "Message contains inappropriate language"

        # Check scam patterns
        for pattern in self.SCAM_PATTERNS:
            if re.search(pattern, content):
                self.mute_user(user_id, room, 600)  # 10 minute mute
                return False, "Suspicious content detected"

        # Check spam (rate limiting)
        now = datetime.utcnow()
        self.user_messages[user_id] = [
            (ts, msg) for ts, msg in self.user_messages[user_id]
            if now - ts < self.message_window
        ]

        # Check duplicates
        duplicate_count = sum(1 for _, msg in self.user_messages[user_id] if msg == content_lower)
        if duplicate_count >= 3:
            self.mute_user(user_id, room, 60)  # 1 minute mute
            return False, "Duplicate message spam"

        # Check rate limit
        if len(self.user_messages[user_id]) >= self.spam_threshold:
            return False, "Slow down! You're sending messages too fast"

        # Record this message
        self.user_messages[user_id].append((now, content_lower))

        return True, None


# Global moderator instance
ws_moderator = WebSocketModerator()


class ConnectionManager:
    """
    Manages WebSocket connections and message broadcasting.

    Supports both local connections and Redis pub/sub for horizontal scaling.
    """

    def __init__(self):
        # Room -> Set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> Room mapping for cleanup
        self.connection_rooms: Dict[WebSocket, str] = {}
        # Redis client (initialized lazily)
        self._redis: Optional[redis.Redis] = None
        self._pubsub_task: Optional[asyncio.Task] = None

    async def get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL, decode_responses=True)
        return self._redis

    async def start_pubsub_listener(self):
        """Start listening to Redis pub/sub for cross-instance messages."""
        if self._pubsub_task is not None:
            return

        try:
            r = await self.get_redis()
            pubsub = r.pubsub()
            await pubsub.psubscribe("stream:*")

            async def listen():
                async for message in pubsub.listen():
                    if message["type"] == "pmessage":
                        channel = message["channel"]
                        data = message["data"]
                        # Extract room from channel (e.g., "stream:room-123")
                        room = channel.split(":", 1)[1] if ":" in channel else None
                        if room and room in self.active_connections:
                            await self._broadcast_local(room, data)

            self._pubsub_task = asyncio.create_task(listen())
        except Exception as e:
            print(f"Redis pubsub error: {e}")

    async def connect(self, websocket: WebSocket, room: str):
        """
        Accept a WebSocket connection and add it to a room.

        Args:
            websocket: The WebSocket connection
            room: Room identifier (usually stream room name)
        """
        await websocket.accept()

        if room not in self.active_connections:
            self.active_connections[room] = set()

        self.active_connections[room].add(websocket)
        self.connection_rooms[websocket] = room

        # Broadcast updated viewer count
        viewer_count = len(self.active_connections[room])
        await self.broadcast(room, {
            "type": "viewer_count",
            "count": viewer_count,
            "timestamp": datetime.utcnow().isoformat(),
        })

    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection from its room.

        Args:
            websocket: The WebSocket connection to remove
        """
        room = self.connection_rooms.pop(websocket, None)
        if room and room in self.active_connections:
            self.active_connections[room].discard(websocket)

            # Clean up empty rooms
            if not self.active_connections[room]:
                del self.active_connections[room]

    async def _broadcast_local(self, room: str, message: str):
        """Broadcast message to local connections only."""
        if room not in self.active_connections:
            return

        disconnected = set()
        for connection in self.active_connections[room]:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast(self, room: str, message: dict):
        """
        Broadcast a message to all connections in a room.

        Uses Redis pub/sub for cross-instance messaging if available.

        Args:
            room: Room identifier
            message: Message dictionary to broadcast
        """
        message_str = json.dumps(message)

        # Try to publish via Redis for cross-instance delivery
        try:
            r = await self.get_redis()
            await r.publish(f"stream:{room}", message_str)
        except Exception:
            # Fallback to local broadcast if Redis unavailable
            await self._broadcast_local(room, message_str)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """
        Send a message to a specific connection.

        Args:
            websocket: Target WebSocket connection
            message: Message dictionary to send
        """
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    def get_viewer_count(self, room: str) -> int:
        """Get the number of viewers in a room."""
        return len(self.active_connections.get(room, set()))

    def get_all_rooms(self) -> list:
        """Get list of all active rooms."""
        return list(self.active_connections.keys())


# Singleton instance
manager = ConnectionManager()


# Message types for real-time updates
class MessageType:
    VIEWER_COUNT = "viewer_count"
    CHAT_MESSAGE = "chat_message"
    STREAM_STATUS = "stream_status"
    STREAM_ENDED = "stream_ended"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    TIP_RECEIVED = "tip_received"
    SYSTEM = "system"
    # Direct messaging types (Phase 12)
    DIRECT_MESSAGE = "direct_message"
    DM_READ_RECEIPT = "dm_read_receipt"
    DM_TYPING = "dm_typing"
    MENTION = "mention"
    COMMUNITY_UPDATE = "community_update"


class DMConnectionManager:
    """
    Manages WebSocket connections for direct messaging.

    Unlike stream rooms, DM connections are user-based, not room-based.
    Each authenticated user has their own connection for receiving real-time DMs.
    """

    def __init__(self):
        # User ID -> Set of WebSocket connections (supports multiple devices)
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        # WebSocket -> User ID mapping for cleanup
        self.connection_user: Dict[WebSocket, int] = {}
        # Redis client for cross-instance messaging
        self._redis: Optional[redis.Redis] = None

    async def get_redis(self) -> redis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL, decode_responses=True)
        return self._redis

    async def connect(self, websocket: WebSocket, user_id: int):
        """
        Accept a WebSocket connection for a user's DM channel.

        Args:
            websocket: The WebSocket connection
            user_id: Authenticated user ID
        """
        await websocket.accept()

        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()

        self.user_connections[user_id].add(websocket)
        self.connection_user[websocket] = user_id

        # Start listening for Redis pub/sub messages for this user
        await self._subscribe_user(user_id)

    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection from user's DM channel.

        Args:
            websocket: The WebSocket connection to remove
        """
        user_id = self.connection_user.pop(websocket, None)
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)

            # Clean up if no more connections for this user
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def _subscribe_user(self, user_id: int):
        """Subscribe to Redis channel for user's DMs."""
        # Subscription is handled at the application level
        # Individual messages are delivered via send_to_user
        pass

    async def send_to_user(self, user_id: int, message: dict):
        """
        Send a message to all of a user's connected devices.

        Args:
            user_id: Target user ID
            message: Message dictionary to send
        """
        if user_id not in self.user_connections:
            # User not connected, try Redis for cross-instance delivery
            try:
                r = await self.get_redis()
                await r.publish(f"dm:{user_id}", json.dumps(message))
            except Exception:
                pass  # User might be offline
            return

        disconnected = set()
        for connection in self.user_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_to_users(self, user_ids: list, message: dict):
        """
        Send a message to multiple users.

        Args:
            user_ids: List of target user IDs
            message: Message dictionary to send
        """
        for user_id in user_ids:
            await self.send_to_user(user_id, message)

    def is_user_online(self, user_id: int) -> bool:
        """Check if a user has any active connections."""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

    def get_online_users(self) -> list:
        """Get list of all online user IDs."""
        return list(self.user_connections.keys())


# Singleton DM manager instance
dm_manager = DMConnectionManager()


async def broadcast_viewer_count(room: str, count: int):
    """Broadcast updated viewer count to a room."""
    await manager.broadcast(room, {
        "type": MessageType.VIEWER_COUNT,
        "count": count,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def broadcast_chat_message(
    room: str,
    user_id: int,
    username: str,
    message: str,
    is_broadcaster: bool = False,
    is_authenticated: bool = False,
):
    """Broadcast a chat message to a room."""
    await manager.broadcast(room, {
        "type": MessageType.CHAT_MESSAGE,
        "user_id": user_id,
        "username": username,
        "message": message,
        "is_broadcaster": is_broadcaster,
        "is_authenticated": is_authenticated,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def broadcast_stream_status(room: str, status: str, details: dict = None):
    """Broadcast stream status change."""
    await manager.broadcast(room, {
        "type": MessageType.STREAM_STATUS,
        "status": status,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
    })


async def broadcast_tip(room: str, from_user: str, amount: float, message: str = ""):
    """Broadcast tip notification to a room."""
    await manager.broadcast(room, {
        "type": MessageType.TIP_RECEIVED,
        "from_user": from_user,
        "amount": amount,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
    })


def verify_websocket_token(token: Optional[str]) -> Tuple[Optional[int], Optional[str]]:
    """
    Verify a JWT token for WebSocket authentication.

    Args:
        token: JWT token string (optional)

    Returns:
        Tuple of (user_id, username) if valid, (None, None) if invalid or not provided
    """
    if not token or not JWT_SECRET:
        return None, None

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        if user_id:
            return int(user_id), username
    except (JWTError, ValueError):
        pass

    return None, None


async def handle_websocket_connection(
    websocket: WebSocket,
    room: str,
    token: Optional[str] = None,
    user_id: Optional[int] = None
):
    """
    Handle a WebSocket connection lifecycle.

    Args:
        websocket: The WebSocket connection
        room: Room to join
        token: Optional JWT token for authentication
        user_id: Optional authenticated user ID (deprecated, use token instead)
    """
    # Verify token if provided
    authenticated_user_id, authenticated_username = verify_websocket_token(token)

    # Use authenticated user_id if token was valid, otherwise fall back to provided user_id
    effective_user_id = authenticated_user_id or user_id
    effective_username = authenticated_username

    await manager.connect(websocket, room)

    # Send connection confirmation with auth status
    await manager.send_personal(websocket, {
        "type": "connected",
        "authenticated": authenticated_user_id is not None,
        "user_id": effective_user_id,
        "room": room,
    })

    try:
        while True:
            # Wait for incoming messages
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat":
                # Handle chat message
                username = effective_username or data.get("username", f"User {effective_user_id}" if effective_user_id else "Anonymous")
                message = data.get("message", "")

                if message.strip():
                    # Moderation check (Phase 9)
                    is_allowed, block_reason = ws_moderator.check_message(
                        content=message,
                        user_id=effective_user_id or 0,
                        room=room
                    )

                    if not is_allowed:
                        # Send blocked notification to user only
                        await manager.send_personal(websocket, {
                            "type": "message_blocked",
                            "reason": block_reason
                        })
                        continue  # Skip broadcasting

                    await broadcast_chat_message(
                        room=room,
                        user_id=effective_user_id or 0,
                        username=username,
                        message=message[:500],  # Limit message length
                        is_authenticated=authenticated_user_id is not None,
                    )

            elif message_type == "ping":
                # Keep-alive ping
                await manager.send_personal(websocket, {"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Broadcast updated viewer count
        viewer_count = manager.get_viewer_count(room)
        await broadcast_viewer_count(room, viewer_count)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# =============================================================================
# DIRECT MESSAGING WEBSOCKET HANDLERS (Phase 12)
# =============================================================================

async def send_dm_notification(
    recipient_id: int,
    sender_id: int,
    sender_username: str,
    message_id: int,
    content: str,
    conversation_id: int,
):
    """
    Send a real-time DM notification to a user.

    Args:
        recipient_id: User ID of the message recipient
        sender_id: User ID of the message sender
        sender_username: Display name of sender
        message_id: Database ID of the message
        content: Message content
        conversation_id: Conversation ID
    """
    await dm_manager.send_to_user(recipient_id, {
        "type": MessageType.DIRECT_MESSAGE,
        "message_id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_username": sender_username,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def send_dm_read_receipt(
    user_id: int,
    conversation_id: int,
    read_by_id: int,
):
    """
    Send a read receipt notification to a user.

    Args:
        user_id: User ID to notify
        conversation_id: Conversation that was read
        read_by_id: User ID who read the messages
    """
    await dm_manager.send_to_user(user_id, {
        "type": MessageType.DM_READ_RECEIPT,
        "conversation_id": conversation_id,
        "read_by": read_by_id,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def send_typing_indicator(
    recipient_id: int,
    sender_id: int,
    conversation_id: int,
    is_typing: bool,
):
    """
    Send a typing indicator to a user.

    Args:
        recipient_id: User ID to notify
        sender_id: User ID who is typing
        conversation_id: Conversation where typing is happening
        is_typing: Whether user is typing or stopped
    """
    await dm_manager.send_to_user(recipient_id, {
        "type": MessageType.DM_TYPING,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "is_typing": is_typing,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def send_mention_notification(
    user_id: int,
    mentioner_id: int,
    mentioner_username: str,
    content_type: str,  # 'chat', 'community_post', 'dm'
    content_preview: str,
    content_id: int,
    stream_id: Optional[int] = None,
    community_id: Optional[int] = None,
):
    """
    Send a mention notification to a user.

    Args:
        user_id: User ID who was mentioned
        mentioner_id: User ID who made the mention
        mentioner_username: Display name of mentioner
        content_type: Type of content where mention occurred
        content_preview: Preview of the content
        content_id: ID of the content (message/post)
        stream_id: Optional stream ID if mention was in stream chat
        community_id: Optional community ID if mention was in community
    """
    await dm_manager.send_to_user(user_id, {
        "type": MessageType.MENTION,
        "mentioner_id": mentioner_id,
        "mentioner_username": mentioner_username,
        "content_type": content_type,
        "content_preview": content_preview[:100],  # Limit preview length
        "content_id": content_id,
        "stream_id": stream_id,
        "community_id": community_id,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def send_community_update(
    user_ids: list,
    community_id: int,
    update_type: str,  # 'new_member', 'member_left', 'role_change', 'settings_update'
    details: dict,
):
    """
    Send a community update notification to members.

    Args:
        user_ids: List of user IDs to notify
        community_id: Community ID
        update_type: Type of update
        details: Additional details about the update
    """
    await dm_manager.broadcast_to_users(user_ids, {
        "type": MessageType.COMMUNITY_UPDATE,
        "community_id": community_id,
        "update_type": update_type,
        "details": details,
        "timestamp": datetime.utcnow().isoformat(),
    })


async def handle_dm_websocket_connection(
    websocket: WebSocket,
    token: str,
):
    """
    Handle a WebSocket connection for direct messaging.

    Requires authentication - anonymous connections are not allowed.

    Args:
        websocket: The WebSocket connection
        token: JWT token for authentication (required)
    """
    # Verify token - DM connections require authentication
    user_id, username = verify_websocket_token(token)

    if not user_id:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await dm_manager.connect(websocket, user_id)

    # Send connection confirmation
    await websocket.send_json({
        "type": "dm_connected",
        "user_id": user_id,
        "username": username,
        "timestamp": datetime.utcnow().isoformat(),
    })

    try:
        while True:
            # Wait for incoming messages
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "typing":
                # Handle typing indicator
                conversation_id = data.get("conversation_id")
                recipient_id = data.get("recipient_id")
                is_typing = data.get("is_typing", True)

                if conversation_id and recipient_id:
                    await send_typing_indicator(
                        recipient_id=recipient_id,
                        sender_id=user_id,
                        conversation_id=conversation_id,
                        is_typing=is_typing,
                    )

            elif message_type == "ping":
                # Keep-alive ping
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        dm_manager.disconnect(websocket)
    except Exception as e:
        print(f"DM WebSocket error: {e}")
        dm_manager.disconnect(websocket)
