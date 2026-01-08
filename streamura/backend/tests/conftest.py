"""
Streamura Test Configuration and Fixtures

Provides pytest fixtures for database, client, and authentication testing.
"""

import os
import sys

# Set test environment variables before importing modules
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-purposes-only-32chars"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["LIVEKIT_URL"] = "http://localhost:7880"
os.environ["LIVEKIT_API_KEY"] = "test_api_key"
os.environ["LIVEKIT_API_SECRET"] = "test_api_secret"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test"

# Add parent directory to path for package imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from datetime import timedelta

# Import from the backend package
from backend.models import Base, User, Stream, Recording, ScheduledStream, StreamAnalytics
from backend.models import ChatMessage, UserFollow, StreamLike, Report, ModerationAction, Tip, Transaction
from backend.models import ContentFilter, ModerationQueueItem, StreamModerationSettings, ChatMute
from backend.models import SubscriptionTier, Subscription, VirtualGood, UserInventory, SubscriptionGiftCode
from backend.database import get_db
from backend.auth import get_password_hash, create_access_token


# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_test_app():
    """Create FastAPI app for testing."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Import and add routes
    from backend.api import router
    test_app.include_router(router)

    return test_app


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database override."""
    app = get_test_app()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db: Session) -> dict:
    """Create a test user and return user data with tokens."""
    hashed_password = get_password_hash("testpassword123")
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed_password,
        is_verified=True,
        is_active=True,
        is_admin=False,
        balance=100.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=30)
    )

    return {
        "user": user,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }


@pytest.fixture
def test_admin(db: Session) -> dict:
    """Create an admin user and return user data with tokens."""
    hashed_password = get_password_hash("adminpassword123")
    user = User(
        username="adminuser",
        email="admin@example.com",
        hashed_password=hashed_password,
        is_verified=True,
        is_active=True,
        is_admin=True,
        balance=0.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=30)
    )

    return {
        "user": user,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }


@pytest.fixture
def test_stream(db: Session, test_user: dict) -> Stream:
    """Create a test stream."""
    stream = Stream(
        stream_key="test_stream_123",
        user_id=test_user["user"].id,
        title="Test Stream",
        description="A test stream",
        status="live",
        is_public=True,
        is_monetized=False,
        viewer_count=10,
    )
    db.add(stream)
    db.commit()
    db.refresh(stream)
    return stream


@pytest.fixture
def second_user(db: Session) -> dict:
    """Create a second test user for social feature testing."""
    hashed_password = get_password_hash("seconduser123")
    user = User(
        username="seconduser",
        email="second@example.com",
        hashed_password=hashed_password,
        is_verified=True,
        is_active=True,
        is_admin=False,
        balance=50.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=30)
    )

    return {
        "user": user,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }


@pytest.fixture
def creator_user(db: Session) -> dict:
    """Create a creator user with Stripe setup for subscription testing."""
    hashed_password = get_password_hash("creatorpassword123")
    user = User(
        username="creatoruser",
        email="creator@example.com",
        hashed_password=hashed_password,
        is_verified=True,
        is_active=True,
        is_admin=False,
        balance=500.0,
        stripe_account_id="acct_test_creator",
        stripe_onboarding_complete=True,
        payout_enabled=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "email": user.email},
        expires_delta=timedelta(minutes=30)
    )

    return {
        "user": user,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"}
    }


@pytest.fixture
def subscription_tier(db: Session, creator_user: dict) -> SubscriptionTier:
    """Create a test subscription tier."""
    tier = SubscriptionTier(
        creator_id=creator_user["user"].id,
        name="Test Tier",
        description="A test subscription tier",
        price=9.99,
        currency="USD",
        billing_period="monthly",
        benefits=["Exclusive content", "Custom badge", "Ad-free viewing"],
        badge_url="https://example.com/badge.png",
        emote_slots=3,
        is_active=True,
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier


@pytest.fixture
def virtual_good(db: Session, creator_user: dict) -> VirtualGood:
    """Create a test virtual good."""
    good = VirtualGood(
        creator_id=creator_user["user"].id,
        name="Test Emote",
        description="A funny test emote",
        type="emote",
        price=4.99,
        currency="USD",
        image_url="https://example.com/emote.png",
        is_active=True,
    )
    db.add(good)
    db.commit()
    db.refresh(good)
    return good
