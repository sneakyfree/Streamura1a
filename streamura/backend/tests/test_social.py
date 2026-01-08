"""
Tests for Social Features

Tests follow/unfollow, likes, and social interactions.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestFollowSystem:
    """Tests for follow/unfollow functionality."""

    def test_follow_user(self, client: TestClient, test_user: dict, second_user: dict):
        """Test following a user."""
        response = client.post(
            f"/api/v1/users/{second_user['user'].id}/follow",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("following") is True or "success" in str(data).lower()

    def test_follow_self_fails(self, client: TestClient, test_user: dict):
        """Test that users cannot follow themselves."""
        response = client.post(
            f"/api/v1/users/{test_user['user'].id}/follow",
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_unfollow_user(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test unfollowing a user."""
        from backend.models import UserFollow

        # First create a follow
        follow = UserFollow(
            follower_id=test_user["user"].id,
            following_id=second_user["user"].id
        )
        db.add(follow)
        db.commit()

        response = client.delete(
            f"/api/v1/users/{second_user['user'].id}/follow",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

    def test_get_followers(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test getting user's followers list."""
        from backend.models import UserFollow

        # Create follow relationship
        follow = UserFollow(
            follower_id=second_user["user"].id,
            following_id=test_user["user"].id
        )
        db.add(follow)
        db.commit()

        response = client.get(f"/api/v1/users/{test_user['user'].id}/followers")
        assert response.status_code == 200
        data = response.json()
        assert "followers" in data

    def test_get_following(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test getting list of users the current user follows."""
        from backend.models import UserFollow

        follow = UserFollow(
            follower_id=test_user["user"].id,
            following_id=second_user["user"].id
        )
        db.add(follow)
        db.commit()

        response = client.get(f"/api/v1/users/{test_user['user'].id}/following")
        assert response.status_code == 200
        data = response.json()
        assert "following" in data

    def test_follow_duplicate(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test that following same user twice fails."""
        from backend.models import UserFollow

        # Create initial follow
        follow = UserFollow(
            follower_id=test_user["user"].id,
            following_id=second_user["user"].id
        )
        db.add(follow)
        db.commit()

        # Try to follow again
        response = client.post(
            f"/api/v1/users/{second_user['user'].id}/follow",
            headers=test_user["headers"]
        )
        assert response.status_code == 400


class TestLikeSystem:
    """Tests for stream like functionality."""

    def test_like_stream(self, client: TestClient, test_user: dict, test_stream: "Stream"):
        """Test liking a stream."""
        response = client.post(
            f"/api/v1/streams/{test_stream.id}/like",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

    def test_unlike_stream(self, client: TestClient, test_user: dict, test_stream: "Stream", db: Session):
        """Test unliking a stream."""
        from backend.models import StreamLike

        # First create a like
        like = StreamLike(
            user_id=test_user["user"].id,
            stream_id=test_stream.id
        )
        db.add(like)
        db.commit()

        response = client.delete(
            f"/api/v1/streams/{test_stream.id}/like",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

    def test_like_nonexistent_stream(self, client: TestClient, test_user: dict):
        """Test liking non-existent stream fails."""
        response = client.post(
            "/api/v1/streams/99999/like",
            headers=test_user["headers"]
        )
        assert response.status_code == 404

    def test_like_duplicate(self, client: TestClient, test_user: dict, test_stream: "Stream", db: Session):
        """Test liking same stream twice fails."""
        from backend.models import StreamLike

        # Create initial like
        like = StreamLike(
            user_id=test_user["user"].id,
            stream_id=test_stream.id
        )
        db.add(like)
        db.commit()

        # Try to like again
        response = client.post(
            f"/api/v1/streams/{test_stream.id}/like",
            headers=test_user["headers"]
        )
        assert response.status_code == 400

    def test_like_unauthorized(self, client: TestClient, test_stream: "Stream"):
        """Test liking without auth fails."""
        response = client.post(f"/api/v1/streams/{test_stream.id}/like")
        assert response.status_code == 401


class TestFollowingFeed:
    """Tests for following-based feed."""

    def test_get_following_feed(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test getting streams from followed users."""
        from backend.models import UserFollow, Stream

        # Follow second user
        follow = UserFollow(
            follower_id=test_user["user"].id,
            following_id=second_user["user"].id
        )
        db.add(follow)

        # Create a stream by second user
        stream = Stream(
            stream_key="followed_user_stream",
            user_id=second_user["user"].id,
            title="Stream from followed user",
            status="live"
        )
        db.add(stream)
        db.commit()

        response = client.get(
            "/api/v1/feed/following",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        # API returns a list directly
        assert isinstance(data, list)

    def test_following_feed_empty(self, client: TestClient, test_user: dict):
        """Test following feed when not following anyone."""
        response = client.get(
            "/api/v1/feed/following",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        # API returns a list directly
        assert len(data) == 0

    def test_following_feed_unauthorized(self, client: TestClient):
        """Test following feed requires auth."""
        response = client.get("/api/v1/feed/following")
        assert response.status_code == 401
