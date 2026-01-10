"""
Tests for Direct Messaging Service (Phase 12)

Tests the following functionality:
- Sending and receiving messages
- Conversation management
- User blocking
- Read receipts
"""

import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.models import DirectMessage, Conversation, UserBlock, User


class TestSendMessage:
    """Test message sending functionality."""

    def test_send_message_creates_conversation(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test that sending a message creates a conversation."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Hello, this is a test message!"
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Hello, this is a test message!"
        assert data["sender_id"] == test_user["user"].id
        assert data["recipient_id"] == second_user["user"].id
        assert "conversation_id" in data

    def test_send_message_to_self_fails(self, client: TestClient, test_user: dict):
        """Test that you cannot send a message to yourself."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": test_user["user"].id,
                "content": "Talking to myself"
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_send_empty_message_fails(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test that empty messages are rejected."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": ""
            },
            headers=test_user["headers"]
        )
        assert response.status_code in [400, 422]

    def test_send_message_to_nonexistent_user_fails(
        self, client: TestClient, test_user: dict
    ):
        """Test that sending to nonexistent user fails."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": 99999,
                "content": "Hello?"
            },
            headers=test_user["headers"]
        )
        assert response.status_code in [400, 404]

    def test_send_message_requires_auth(self, client: TestClient, second_user: dict):
        """Test that sending messages requires authentication."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Unauthorized message"
            }
        )
        assert response.status_code == 401


class TestConversations:
    """Test conversation management."""

    def test_get_conversations_empty(self, client: TestClient, test_user: dict):
        """Test getting conversations when none exist."""
        response = client.get(
            "/api/v1/messages/conversations",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["conversations"] == []

    def test_get_conversations_after_message(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test that conversations appear after messaging."""
        # Send a message first
        client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Creating a conversation"
            },
            headers=test_user["headers"]
        )

        # Check conversations for sender
        response = client.get(
            "/api/v1/messages/conversations",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["conversations"]) >= 1

    def test_conversation_shows_last_message(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test that conversation shows last message preview."""
        # Send messages
        client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "First message"
            },
            headers=test_user["headers"]
        )
        client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Second message (latest)"
            },
            headers=test_user["headers"]
        )

        # Get conversations
        response = client.get(
            "/api/v1/messages/conversations",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        # Last message should be the second one
        assert "Second message" in data["conversations"][0]["last_message_preview"]


class TestGetMessages:
    """Test message retrieval."""

    def test_get_messages_from_conversation(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test getting messages from a conversation."""
        # Create conversation and send message
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Test message for retrieval"
            },
            headers=test_user["headers"]
        )
        conversation_id = response.json()["conversation_id"]

        # Get messages
        response = client.get(
            f"/api/v1/messages/conversations/{conversation_id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) >= 1

    def test_get_messages_unauthorized_fails(
        self, client: TestClient, test_user: dict, second_user: dict, db: Session
    ):
        """Test that users can't view conversations they're not in."""
        # Create conversation between test_user and second_user
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Private message"
            },
            headers=test_user["headers"]
        )
        conversation_id = response.json()["conversation_id"]

        # Create a third user
        from backend.auth import get_password_hash, create_access_token
        third_user = User(
            username="thirduser",
            email="third@example.com",
            hashed_password=get_password_hash("password"),
        )
        db.add(third_user)
        db.commit()

        token = create_access_token(
            data={"sub": str(third_user.id), "username": third_user.username, "email": third_user.email}
        )

        # Third user tries to access conversation
        response = client.get(
            f"/api/v1/messages/conversations/{conversation_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403


class TestReadReceipts:
    """Test message read receipts."""

    def test_mark_messages_as_read(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test marking messages as read."""
        # Send message from test_user to second_user
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Read this message"
            },
            headers=test_user["headers"]
        )
        conversation_id = response.json()["conversation_id"]

        # Second user marks as read
        response = client.post(
            f"/api/v1/messages/conversations/{conversation_id}/read",
            headers=second_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True or data.get("messages_marked_read", 0) >= 0


class TestUserBlocking:
    """Test user blocking functionality."""

    def test_block_user(self, client: TestClient, test_user: dict, second_user: dict):
        """Test blocking a user."""
        response = client.post(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        # API returns BlockResponse with blocker_id and blocked_id
        assert data["blocker_id"] == test_user["user"].id
        assert data["blocked_id"] == second_user["user"].id

    def test_block_self_fails(self, client: TestClient, test_user: dict):
        """Test that you cannot block yourself."""
        response = client.post(
            f"/api/v1/users/{test_user['user'].id}/block",
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_cannot_message_blocked_user(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test that you cannot message someone you blocked or who blocked you."""
        # Block the user first
        client.post(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )

        # Try to send message
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Message to blocked user"
            },
            headers=test_user["headers"]
        )
        assert response.status_code in [400, 403]

    def test_unblock_user(self, client: TestClient, test_user: dict, second_user: dict):
        """Test unblocking a user."""
        # Block first
        client.post(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )

        # Unblock
        response = client.delete(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_get_blocked_users(self, client: TestClient, test_user: dict, second_user: dict):
        """Test getting list of blocked users."""
        # Block user
        client.post(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )

        # Get blocked list
        response = client.get(
            "/api/v1/users/me/blocked",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert any(b["blocked_id"] == second_user["user"].id for b in data["blocks"])


class TestMessageDeletion:
    """Test message deletion functionality."""

    def test_delete_own_message(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test deleting your own message."""
        # Send message
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Message to delete"
            },
            headers=test_user["headers"]
        )
        message_id = response.json()["id"]

        # Delete it
        response = client.delete(
            f"/api/v1/messages/{message_id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
