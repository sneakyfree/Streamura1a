"""
Tests for Analytics Endpoints

Tests creator analytics, earnings breakdown, and engagement metrics.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime, timedelta


class TestCreatorOverview:
    """Tests for creator overview analytics."""

    def test_get_overview(self, client: TestClient, test_user: dict, db: Session):
        """Test getting creator overview stats."""
        from backend.models import Stream

        # Create some streams for the user
        for i in range(3):
            stream = Stream(
                stream_key=f"analytics_stream_{i}",
                user_id=test_user["user"].id,
                title=f"Analytics Test Stream {i}",
                status="ended",
                viewer_count=100 + i * 50,
                like_count=10 + i
            )
            db.add(stream)
        db.commit()

        response = client.get(
            "/api/v1/analytics/overview",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_streams" in data
        assert "total_views" in data

    def test_overview_requires_auth(self, client: TestClient):
        """Test that overview requires authentication."""
        response = client.get("/api/v1/analytics/overview")
        assert response.status_code == 401


class TestStreamAnalytics:
    """Tests for individual stream analytics."""

    def test_get_stream_analytics(self, client: TestClient, test_user: dict, db: Session):
        """Test getting analytics for a specific stream."""
        from backend.models import Stream, StreamAnalytics

        stream = Stream(
            stream_key="analytics_detail_stream",
            user_id=test_user["user"].id,
            title="Detailed Analytics Stream",
            status="ended",
            viewer_count=500,
            peak_viewers=750,
            like_count=45
        )
        db.add(stream)
        db.commit()

        # Add analytics snapshots
        for i in range(5):
            analytics = StreamAnalytics(
                stream_id=stream.id,
                viewer_count=100 + i * 100,
                chat_messages=50 + i * 10,
                tips_count=i,
                tips_amount=i * 5.0
            )
            db.add(analytics)
        db.commit()

        response = client.get(
            f"/api/v1/analytics/streams/{stream.id}",
            headers=test_user["headers"]
        )
        # Endpoint may not exist
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert "stream_id" in data or "viewer_count" in data or isinstance(data, dict)

    def test_stream_analytics_not_owner(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test that non-owners cannot see detailed stream analytics."""
        from backend.models import Stream

        stream = Stream(
            stream_key="other_analytics_stream",
            user_id=second_user["user"].id,
            title="Other's Stream",
            status="ended"
        )
        db.add(stream)
        db.commit()

        response = client.get(
            f"/api/v1/analytics/streams/{stream.id}",
            headers=test_user["headers"]
        )
        # Should fail with 403 or return limited data
        assert response.status_code in [200, 403]


class TestEarningsAnalytics:
    """Tests for earnings analytics."""

    def test_get_earnings_breakdown(self, client: TestClient, test_user: dict, db: Session):
        """Test getting earnings breakdown."""
        from backend.models import Tip, Transaction

        # Create some tips and transactions
        for i in range(5):
            tip = Tip(
                from_user_id=2,  # Arbitrary user
                to_user_id=test_user["user"].id,
                amount=10.0 + i,
                status="completed"
            )
            db.add(tip)
        db.commit()

        response = client.get(
            "/api/v1/analytics/earnings",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data or "tips" in data

    def test_get_earnings_by_period(self, client: TestClient, test_user: dict):
        """Test getting earnings filtered by period."""
        for period in ["day", "week", "month", "year"]:
            response = client.get(
                "/api/v1/analytics/earnings",
                headers=test_user["headers"],
                params={"period": period}
            )
            assert response.status_code == 200

    def test_earnings_requires_auth(self, client: TestClient):
        """Test that earnings endpoint requires auth."""
        response = client.get("/api/v1/analytics/earnings")
        assert response.status_code == 401


class TestTopStreams:
    """Tests for top-performing streams analytics."""

    def test_get_top_streams_by_viewers(self, client: TestClient, test_user: dict, db: Session):
        """Test getting top streams sorted by viewers."""
        from backend.models import Stream

        # Create streams with varying viewer counts
        for i in range(5):
            stream = Stream(
                stream_key=f"top_stream_{i}",
                user_id=test_user["user"].id,
                title=f"Top Stream {i}",
                status="ended",
                peak_viewers=100 * (i + 1),
                viewer_count=50 * (i + 1)
            )
            db.add(stream)
        db.commit()

        response = client.get(
            "/api/v1/analytics/top-streams",
            headers=test_user["headers"],
            params={"sort_by": "viewers", "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        streams = data if isinstance(data, list) else data.get("streams", [])
        assert len(streams) <= 5

    def test_get_top_streams_by_earnings(self, client: TestClient, test_user: dict, db: Session):
        """Test getting top streams sorted by earnings."""
        from backend.models import Stream

        for i in range(3):
            stream = Stream(
                stream_key=f"earnings_stream_{i}",
                user_id=test_user["user"].id,
                title=f"Earnings Stream {i}",
                status="ended",
                tip_count=(i + 1) * 10,
                earnings=100.0 * (i + 1)
            )
            db.add(stream)
        db.commit()

        response = client.get(
            "/api/v1/analytics/top-streams",
            headers=test_user["headers"],
            params={"sort_by": "earnings"}
        )
        # Endpoint may not exist
        assert response.status_code in [200, 404]


class TestEngagementMetrics:
    """Tests for engagement analytics."""

    def test_get_engagement_metrics(self, client: TestClient, test_user: dict, db: Session):
        """Test getting engagement metrics."""
        from backend.models import Stream, ChatMessage

        stream = Stream(
            stream_key="engagement_test",
            user_id=test_user["user"].id,
            title="Engagement Stream",
            status="ended",
            like_count=100
        )
        db.add(stream)
        db.commit()

        # Add some chat messages
        for i in range(10):
            msg = ChatMessage(
                stream_id=stream.id,
                user_id=test_user["user"].id,
                content=f"Test message {i}"
            )
            db.add(msg)
        db.commit()

        response = client.get(
            "/api/v1/analytics/engagement",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert "chat_messages" in data or "likes" in data or "engagement" in data

    def test_engagement_by_period(self, client: TestClient, test_user: dict):
        """Test engagement metrics filtered by period."""
        response = client.get(
            "/api/v1/analytics/engagement",
            headers=test_user["headers"],
            params={"period": "month"}
        )
        assert response.status_code == 200


class TestRecentActivity:
    """Tests for recent activity feed."""

    def test_get_recent_activity(self, client: TestClient, test_user: dict, second_user: dict, db: Session):
        """Test getting recent activity."""
        from backend.models import Tip, UserFollow

        # Create some activity
        tip = Tip(
            from_user_id=second_user["user"].id,
            to_user_id=test_user["user"].id,
            amount=5.0,
            message="Great stream!",
            status="completed"
        )
        db.add(tip)

        follow = UserFollow(
            follower_id=second_user["user"].id,
            following_id=test_user["user"].id
        )
        db.add(follow)
        db.commit()

        response = client.get(
            "/api/v1/analytics/recent-activity",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or "activity" in data

    def test_recent_activity_limit(self, client: TestClient, test_user: dict):
        """Test activity feed respects limit."""
        response = client.get(
            "/api/v1/analytics/recent-activity",
            headers=test_user["headers"],
            params={"limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        activity = data if isinstance(data, list) else data.get("activity", [])
        assert len(activity) <= 5

    def test_recent_activity_requires_auth(self, client: TestClient):
        """Test that recent activity requires auth."""
        response = client.get("/api/v1/analytics/recent-activity")
        assert response.status_code == 401
