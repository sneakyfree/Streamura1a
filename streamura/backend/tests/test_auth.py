"""
Tests for Authentication Endpoints

Tests user registration, login, token refresh, and anonymous users.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestRegistration:
    """Tests for user registration."""

    def test_register_user_success(self, client: TestClient):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "securepassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert "id" in data

    def test_register_duplicate_email(self, client: TestClient, test_user: dict):
        """Test registration with duplicate email fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "different",
                "email": "test@example.com",  # Same as test_user
                "password": "password123"
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_register_duplicate_username(self, client: TestClient, test_user: dict):
        """Test registration with duplicate username fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "testuser",  # Same as test_user
                "email": "different@example.com",
                "password": "password123"
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]


class TestLogin:
    """Tests for user login."""

    def test_login_with_username(self, client: TestClient, test_user: dict):
        """Test login with username."""
        response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "testuser",
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "refresh_token" in data

    def test_login_with_email(self, client: TestClient, test_user: dict):
        """Test login with email."""
        response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "test@example.com",  # Using email as username
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_invalid_password(self, client: TestClient, test_user: dict):
        """Test login with wrong password fails."""
        response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "testuser",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        # i18n message: "Invalid email or password"
        assert "Invalid" in response.json()["detail"] or "password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with non-existent user fails."""
        response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "nonexistent",
                "password": "password123"
            }
        )
        assert response.status_code == 401


class TestTokenRefresh:
    """Tests for token refresh."""

    def test_refresh_token_success(self, client: TestClient, test_user: dict):
        """Test successful token refresh."""
        # First login to get refresh token
        login_response = client.post(
            "/api/v1/auth/token",
            data={
                "username": "testuser",
                "password": "testpassword123"
            }
        )
        refresh_token = login_response.json()["refresh_token"]

        # Refresh the token
        response = client.post(
            "/api/v1/auth/refresh",
            params={"refresh_token": refresh_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_invalid_token(self, client: TestClient):
        """Test refresh with invalid token fails."""
        response = client.post(
            "/api/v1/auth/refresh",
            params={"refresh_token": "invalid_token"}
        )
        assert response.status_code == 401


class TestAnonymousUsers:
    """Tests for anonymous user functionality."""

    def test_create_anonymous_session(self, client: TestClient):
        """Test creating anonymous user session."""
        response = client.post("/api/v1/auth/anonymous")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["username"].startswith("anonymous_")

    def test_migrate_anonymous_to_registered(self, client: TestClient, db: Session):
        """Test migrating anonymous user to registered."""
        # Create anonymous user
        anon_response = client.post("/api/v1/auth/anonymous")
        anon_id = anon_response.json()["id"]

        # Migrate to registered
        response = client.post(
            f"/api/v1/auth/migrate/{anon_id}",
            json={
                "username": "migrateduser",
                "email": "migrated@example.com",
                "password": "newpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "migrateduser"
        assert data["email"] == "migrated@example.com"
        assert data["id"] == anon_id


class TestCurrentUser:
    """Tests for getting current user info."""

    def test_get_current_user(self, client: TestClient, test_user: dict):
        """Test getting current user information."""
        response = client.get(
            "/api/v1/users/me",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_get_current_user_unauthorized(self, client: TestClient):
        """Test getting current user without token fails."""
        response = client.get("/api/v1/users/me")
        assert response.status_code == 401

    def test_get_current_user_invalid_token(self, client: TestClient):
        """Test getting current user with invalid token fails."""
        response = client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
