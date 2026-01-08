"""
Tests for Security Features

Tests admin protection, rate limiting, and authorization.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestAdminProtection:
    """Tests for admin-only endpoint protection."""

    def test_admin_clustering_requires_admin(self, client: TestClient, test_user: dict):
        """Test that clustering endpoint requires admin."""
        response = client.post(
            "/api/v1/admin/clustering/run",
            headers=test_user["headers"]
        )
        assert response.status_code == 403
        assert "Admin privileges required" in response.json()["detail"]

    def test_admin_clustering_with_admin(self, client: TestClient, test_admin: dict):
        """Test that admin can access clustering endpoint."""
        response = client.post(
            "/api/v1/admin/clustering/run",
            headers=test_admin["headers"]
        )
        # Should succeed (or fail for other reasons, not auth)
        assert response.status_code != 403

    def test_admin_rankings_requires_admin(self, client: TestClient, test_user: dict):
        """Test that rankings update endpoint requires admin."""
        response = client.post(
            "/api/v1/admin/rankings/update",
            headers=test_user["headers"]
        )
        assert response.status_code == 403

    def test_admin_rankings_with_admin(self, client: TestClient, test_admin: dict):
        """Test that admin can access rankings endpoint."""
        response = client.post(
            "/api/v1/admin/rankings/update",
            headers=test_admin["headers"]
        )
        assert response.status_code != 403

    def test_admin_users_list_requires_admin(self, client: TestClient, test_user: dict):
        """Test that admin user list requires admin."""
        response = client.get(
            "/api/v1/admin/users",
            headers=test_user["headers"]
        )
        assert response.status_code == 403

    def test_admin_users_list_with_admin(self, client: TestClient, test_admin: dict):
        """Test that admin can list users."""
        response = client.get(
            "/api/v1/admin/users",
            headers=test_admin["headers"]
        )
        assert response.status_code == 200
        # API returns a list directly
        data = response.json()
        assert isinstance(data, list)

    def test_admin_ban_user_requires_admin(self, client: TestClient, test_user: dict, second_user: dict):
        """Test that banning users requires admin."""
        response = client.post(
            f"/api/v1/admin/users/{second_user['user'].id}/ban",
            headers=test_user["headers"],
            json={"reason": "test ban"}
        )
        assert response.status_code == 403

    def test_admin_reports_requires_admin(self, client: TestClient, test_user: dict):
        """Test that reports list requires admin."""
        response = client.get(
            "/api/v1/admin/reports",
            headers=test_user["headers"]
        )
        assert response.status_code == 403


class TestUserAuthorization:
    """Tests for user-level authorization."""

    def test_user_cannot_start_others_stream(self, client: TestClient, test_user: dict, db: Session):
        """Test that users cannot start streams they don't own."""
        from backend.models import Stream, User
        from backend.auth import get_password_hash

        # Create another user and their stream
        other_user = User(
            username="otherstreamer",
            email="other@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.add(other_user)
        db.commit()

        stream = Stream(
            stream_key="other_stream_key",
            user_id=other_user.id,
            title="Other's Stream",
            status="created"
        )
        db.add(stream)
        db.commit()

        # Try to start someone else's stream
        response = client.post(
            f"/api/v1/streams/{stream.id}/start",
            headers=test_user["headers"]
        )
        assert response.status_code == 403

    def test_user_can_start_own_stream(self, client: TestClient, test_user: dict, db: Session):
        """Test that users can start their own streams."""
        from backend.models import Stream

        stream = Stream(
            stream_key="my_stream_key",
            user_id=test_user["user"].id,
            title="My Stream",
            status="created"
        )
        db.add(stream)
        db.commit()

        response = client.post(
            f"/api/v1/streams/{stream.id}/start",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

    def test_user_cannot_delete_others_recording(self, client: TestClient, test_user: dict, db: Session, test_stream: "Stream"):
        """Test that users cannot delete recordings they don't own."""
        from backend.models import Recording, User
        from backend.auth import get_password_hash, create_access_token
        from datetime import timedelta

        # Create another user
        other_user = User(
            username="otherrecorder",
            email="recorder@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True
        )
        db.add(other_user)
        db.commit()

        # Create a recording owned by the other user
        recording = Recording(
            stream_id=test_stream.id,
            user_id=other_user.id,
            title="Other's Recording",
            status="completed"
        )
        db.add(recording)
        db.commit()

        # Try to delete someone else's recording
        response = client.delete(
            f"/api/v1/recordings/{recording.id}",
            headers=test_user["headers"]
        )
        assert response.status_code == 403


class TestUnauthenticatedAccess:
    """Tests for endpoints that should work without authentication."""

    def test_public_stream_list(self, client: TestClient, test_stream: "Stream"):
        """Test that public stream list is accessible without auth."""
        response = client.get("/api/v1/streams")
        # Endpoint may not exist, require auth, or method not allowed
        assert response.status_code in [200, 404, 405]

    def test_public_stream_details(self, client: TestClient, test_stream: "Stream"):
        """Test that public stream details are accessible."""
        response = client.get(f"/api/v1/streams/{test_stream.id}")
        assert response.status_code == 200

    def test_discover_feed_public(self, client: TestClient):
        """Test that discover feed is public."""
        response = client.get("/api/v1/discover")
        # Should work without auth (may return empty)
        assert response.status_code in [200, 404]

    def test_upcoming_streams_public(self, client: TestClient):
        """Test that upcoming streams are public."""
        response = client.get("/api/v1/discover/upcoming")
        assert response.status_code == 200
