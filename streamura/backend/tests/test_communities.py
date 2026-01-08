"""
Tests for Community Features (Phase 12)

Tests the following functionality:
- Community CRUD
- Community membership
- Role management
- Direct messaging
- User blocking
"""

import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.models import Community, CommunityMember, DirectMessage, Conversation, UserBlock, User
from backend.auth import get_password_hash, create_access_token


class TestCommunityCreation:
    """Test community creation and retrieval."""

    def test_create_community(self, client: TestClient, test_user: dict):
        """Test creating a community."""
        response = client.post(
            "/api/v1/communities",
            json={
                "name": "Gaming Community",
                "description": "A community for gamers",
                "is_public": True,
                "tags": ["gaming", "esports"],
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Gaming Community"
        assert data["description"] == "A community for gamers"
        assert data["owner_id"] == test_user["user"].id
        assert data["member_count"] == 1  # Owner is first member
        assert data["is_public"] is True

    def test_create_community_unauthorized(self, client: TestClient):
        """Test that unauthenticated users cannot create communities."""
        response = client.post(
            "/api/v1/communities",
            json={"name": "Test Community"},
        )
        assert response.status_code == 401

    def test_get_community(self, client: TestClient, test_community: Community):
        """Test getting a community by ID."""
        response = client.get(f"/api/v1/communities/{test_community.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_community.id
        assert data["name"] == "Test Community"

    def test_get_nonexistent_community(self, client: TestClient):
        """Test getting a community that doesn't exist."""
        response = client.get("/api/v1/communities/99999")
        assert response.status_code == 404

    def test_list_communities(self, client: TestClient, test_community: Community):
        """Test listing public communities."""
        response = client.get("/api/v1/communities")
        assert response.status_code == 200
        data = response.json()
        assert "communities" in data
        assert len(data["communities"]) >= 1
        assert any(c["name"] == "Test Community" for c in data["communities"])

    def test_list_communities_with_search(self, client: TestClient, test_community: Community):
        """Test searching communities by name."""
        response = client.get("/api/v1/communities", params={"search": "Test"})
        assert response.status_code == 200
        data = response.json()
        assert any(c["name"] == "Test Community" for c in data["communities"])


class TestCommunityUpdate:
    """Test community update and deletion."""

    def test_update_community(self, client: TestClient, test_community: Community, test_user: dict):
        """Test updating community details."""
        response = client.put(
            f"/api/v1/communities/{test_community.id}",
            json={
                "name": "Updated Community",
                "description": "Updated description",
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Community"
        assert data["description"] == "Updated description"

    def test_update_community_unauthorized(
        self, client: TestClient, test_community: Community, second_user: dict
    ):
        """Test that non-members cannot update community."""
        response = client.put(
            f"/api/v1/communities/{test_community.id}",
            json={"name": "Hacked Name"},
            headers=second_user["headers"]
        )
        assert response.status_code == 403

    def test_delete_community(self, client: TestClient, db: Session, test_user: dict):
        """Test deleting a community."""
        # Create a community to delete
        community = Community(
            name="To Delete",
            owner_id=test_user["user"].id,
            is_public=True,
            member_count=1,
        )
        db.add(community)
        db.commit()
        db.refresh(community)

        # Add owner as member
        membership = CommunityMember(
            community_id=community.id,
            user_id=test_user["user"].id,
            role="owner",
        )
        db.add(membership)
        db.commit()

        response = client.delete(
            f"/api/v1/communities/{community.id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify it's inactive
        response = client.get(f"/api/v1/communities/{community.id}")
        assert response.status_code == 404

    def test_delete_community_unauthorized(
        self, client: TestClient, test_community: Community, second_user: dict
    ):
        """Test that non-owners cannot delete community."""
        response = client.delete(
            f"/api/v1/communities/{test_community.id}",
            headers=second_user["headers"]
        )
        assert response.status_code == 403


class TestCommunityMembership:
    """Test joining and leaving communities."""

    def test_join_community(
        self, client: TestClient, test_community: Community, second_user: dict
    ):
        """Test joining a public community."""
        response = client.post(
            f"/api/v1/communities/{test_community.id}/join",
            headers=second_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["community_id"] == test_community.id
        assert data["user_id"] == second_user["user"].id
        assert data["role"] == "member"

    def test_join_community_already_member(
        self, client: TestClient, test_community: Community, test_user: dict
    ):
        """Test joining a community when already a member."""
        response = client.post(
            f"/api/v1/communities/{test_community.id}/join",
            headers=test_user["headers"]
        )
        assert response.status_code == 400
        assert "already" in response.json()["detail"].lower()

    def test_leave_community(
        self, client: TestClient, db: Session, test_community: Community, second_user: dict
    ):
        """Test leaving a community."""
        # First join
        membership = CommunityMember(
            community_id=test_community.id,
            user_id=second_user["user"].id,
            role="member",
        )
        db.add(membership)
        test_community.member_count += 1
        db.commit()

        response = client.post(
            f"/api/v1/communities/{test_community.id}/leave",
            headers=second_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_owner_cannot_leave(
        self, client: TestClient, test_community: Community, test_user: dict
    ):
        """Test that owners cannot leave their community."""
        response = client.post(
            f"/api/v1/communities/{test_community.id}/leave",
            headers=test_user["headers"]
        )
        assert response.status_code == 403

    def test_check_membership(
        self, client: TestClient, test_community: Community, test_user: dict
    ):
        """Test checking membership status."""
        response = client.get(
            f"/api/v1/communities/{test_community.id}/is-member",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_member"] is True
        assert data["role"] == "owner"

    def test_get_my_communities(
        self, client: TestClient, test_community: Community, test_user: dict
    ):
        """Test getting user's communities."""
        response = client.get(
            "/api/v1/users/me/communities",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "communities" in data
        assert any(c["id"] == test_community.id for c in data["communities"])


class TestCommunityRoles:
    """Test role management in communities."""

    def test_set_member_role_to_moderator(
        self, client: TestClient, db: Session, test_community: Community,
        test_user: dict, second_user: dict
    ):
        """Test promoting a member to moderator."""
        # Add second user as member
        membership = CommunityMember(
            community_id=test_community.id,
            user_id=second_user["user"].id,
            role="member",
        )
        db.add(membership)
        db.commit()

        response = client.put(
            f"/api/v1/communities/{test_community.id}/members/{second_user['user'].id}/role",
            params={"role": "moderator"},
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "moderator"

    def test_kick_member(
        self, client: TestClient, db: Session, test_community: Community,
        test_user: dict, second_user: dict
    ):
        """Test kicking a member from community."""
        # Add second user as member
        membership = CommunityMember(
            community_id=test_community.id,
            user_id=second_user["user"].id,
            role="member",
        )
        db.add(membership)
        test_community.member_count += 1
        db.commit()

        response = client.post(
            f"/api/v1/communities/{test_community.id}/members/{second_user['user'].id}/kick",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_get_community_members(
        self, client: TestClient, test_community: Community
    ):
        """Test getting list of community members."""
        response = client.get(
            f"/api/v1/communities/{test_community.id}/members"
        )
        assert response.status_code == 200
        data = response.json()
        assert "members" in data
        assert len(data["members"]) >= 1


class TestDirectMessaging:
    """Test direct messaging functionality."""

    def test_send_message(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test sending a direct message."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Hello, this is a test message!",
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sender_id"] == test_user["user"].id
        assert data["recipient_id"] == second_user["user"].id
        assert data["content"] == "Hello, this is a test message!"
        assert data["is_read"] is False

    def test_send_message_to_self_fails(
        self, client: TestClient, test_user: dict
    ):
        """Test that you cannot message yourself."""
        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": test_user["user"].id,
                "content": "Hello me!",
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
                "content": "   ",
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_get_conversations(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test getting list of conversations."""
        # Create a conversation
        conversation = Conversation(
            user1_id=min(test_user["user"].id, second_user["user"].id),
            user2_id=max(test_user["user"].id, second_user["user"].id),
            last_message_preview="Test message",
        )
        db.add(conversation)
        db.commit()

        response = client.get(
            "/api/v1/messages/conversations",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data

    def test_get_conversation_messages(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test getting messages in a conversation."""
        # Create conversation and message
        conversation = Conversation(
            user1_id=min(test_user["user"].id, second_user["user"].id),
            user2_id=max(test_user["user"].id, second_user["user"].id),
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        message = DirectMessage(
            conversation_id=conversation.id,
            sender_id=test_user["user"].id,
            recipient_id=second_user["user"].id,
            content="Test message",
        )
        db.add(message)
        db.commit()

        response = client.get(
            f"/api/v1/messages/conversations/{conversation.id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1

    def test_mark_conversation_read(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test marking messages as read."""
        # Create conversation with unread message
        conversation = Conversation(
            user1_id=min(test_user["user"].id, second_user["user"].id),
            user2_id=max(test_user["user"].id, second_user["user"].id),
            user1_unread_count=1 if test_user["user"].id < second_user["user"].id else 0,
            user2_unread_count=0 if test_user["user"].id < second_user["user"].id else 1,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        message = DirectMessage(
            conversation_id=conversation.id,
            sender_id=second_user["user"].id,
            recipient_id=test_user["user"].id,
            content="Unread message",
            is_read=False,
        )
        db.add(message)
        db.commit()

        response = client.post(
            f"/api/v1/messages/conversations/{conversation.id}/read",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_get_unread_count(
        self, client: TestClient, test_user: dict
    ):
        """Test getting unread message count."""
        response = client.get(
            "/api/v1/messages/unread-count",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert "unread_count" in response.json()

    def test_get_or_start_conversation(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test getting or creating a conversation with a user."""
        response = client.get(
            f"/api/v1/messages/with/{second_user['user'].id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert "conversation_id" in response.json()


class TestUserBlocking:
    """Test user blocking functionality."""

    def test_block_user(
        self, client: TestClient, test_user: dict, second_user: dict
    ):
        """Test blocking a user."""
        response = client.post(
            f"/api/v1/users/{second_user['user'].id}/block",
            params={"reason": "Spam"},
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["blocker_id"] == test_user["user"].id
        assert data["blocked_id"] == second_user["user"].id
        assert data["reason"] == "Spam"

    def test_block_self_fails(
        self, client: TestClient, test_user: dict
    ):
        """Test that you cannot block yourself."""
        response = client.post(
            f"/api/v1/users/{test_user['user'].id}/block",
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_unblock_user(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test unblocking a user."""
        # First block them
        block = UserBlock(
            blocker_id=test_user["user"].id,
            blocked_id=second_user["user"].id,
        )
        db.add(block)
        db.commit()

        response = client.delete(
            f"/api/v1/users/{second_user['user'].id}/block",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_check_if_blocked(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test checking if a user is blocked."""
        # Block them first
        block = UserBlock(
            blocker_id=test_user["user"].id,
            blocked_id=second_user["user"].id,
        )
        db.add(block)
        db.commit()

        response = client.get(
            f"/api/v1/users/{second_user['user'].id}/is-blocked",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["is_blocked"] is True

    def test_get_blocked_users(
        self, client: TestClient, test_user: dict
    ):
        """Test getting list of blocked users."""
        response = client.get(
            "/api/v1/users/me/blocked",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "blocks" in data

    def test_cannot_message_blocked_user(
        self, client: TestClient, db: Session, test_user: dict, second_user: dict
    ):
        """Test that you cannot message a blocked user."""
        # Second user blocks test_user
        block = UserBlock(
            blocker_id=second_user["user"].id,
            blocked_id=test_user["user"].id,
        )
        db.add(block)
        db.commit()

        response = client.post(
            "/api/v1/messages",
            json={
                "recipient_id": second_user["user"].id,
                "content": "Hello!",
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 403


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def test_community(db: Session, test_user: dict) -> Community:
    """Create a test community."""
    community = Community(
        name="Test Community",
        description="A test community for testing",
        owner_id=test_user["user"].id,
        is_public=True,
        member_count=1,
        tags=["test", "community"],
    )
    db.add(community)
    db.commit()
    db.refresh(community)

    # Add owner as member
    membership = CommunityMember(
        community_id=community.id,
        user_id=test_user["user"].id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    return community
