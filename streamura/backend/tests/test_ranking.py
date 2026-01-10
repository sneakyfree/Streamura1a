"""
Tests for Event Ranking Service

Tests the following functionality:
- Ranking score calculation
- Velocity calculation
- Engagement metrics
- Freshness decay
- Trending detection
- Featured event logic
- Primary stream selection
"""

import pytest
import math
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.ranking import (
    EventRankingService,
    RankingConfig,
    RankingSnapshot,
    get_ranking_service,
    update_rankings,
)
from backend.models import Event, Stream, User


class TestRankingConfig:
    """Test ranking configuration."""

    def test_weights_sum_to_one(self):
        """Test that ranking weights sum to 1.0."""
        config = RankingConfig()
        total = sum(config.WEIGHTS.values())
        assert abs(total - 1.0) < 0.001, f"Weights sum to {total}, not 1.0"

    def test_config_has_required_weights(self):
        """Test that all required weight keys exist."""
        config = RankingConfig()
        required = ['viewer_count', 'velocity', 'engagement', 'freshness', 'quality']
        for key in required:
            assert key in config.WEIGHTS, f"Missing weight: {key}"

    def test_max_viewers_is_reasonable(self):
        """Test that max viewers normalization is reasonable."""
        config = RankingConfig()
        assert config.MAX_VIEWERS_FOR_NORM >= 1000
        assert config.MAX_VIEWERS_FOR_NORM <= 100000

    def test_freshness_half_life_is_positive(self):
        """Test freshness half-life is positive."""
        config = RankingConfig()
        assert config.FRESHNESS_HALF_LIFE_HOURS > 0

    def test_thresholds_are_valid(self):
        """Test that thresholds are in valid range."""
        config = RankingConfig()
        assert 0 <= config.HOT_THRESHOLD <= 1
        assert 0 <= config.FEATURED_THRESHOLD <= 1
        assert config.FEATURED_THRESHOLD > config.HOT_THRESHOLD


class TestViewerNormalization:
    """Test viewer count normalization."""

    def test_normalize_zero_viewers(self, db: Session):
        """Test normalization of zero viewers."""
        service = EventRankingService(db)
        assert service._normalize_viewers(0) == 0.0

    def test_normalize_negative_viewers(self, db: Session):
        """Test normalization of negative viewers returns 0."""
        service = EventRankingService(db)
        assert service._normalize_viewers(-100) == 0.0

    def test_normalize_small_viewer_count(self, db: Session):
        """Test normalization of small viewer count."""
        service = EventRankingService(db)
        score = service._normalize_viewers(10)
        assert 0 < score < 1.0

    def test_normalize_large_viewer_count(self, db: Session):
        """Test normalization of large viewer count."""
        service = EventRankingService(db)
        score = service._normalize_viewers(10000)
        assert score >= 0.9  # Should be close to 1.0

    def test_normalize_exceeds_max(self, db: Session):
        """Test that exceeding max viewers caps at 1.0."""
        service = EventRankingService(db)
        score = service._normalize_viewers(100000)
        assert score == 1.0

    def test_logarithmic_scaling(self, db: Session):
        """Test that normalization uses log scaling."""
        service = EventRankingService(db)
        score_10 = service._normalize_viewers(10)
        score_100 = service._normalize_viewers(100)
        score_1000 = service._normalize_viewers(1000)

        # Log scale means differences decrease as numbers grow
        diff_1 = score_100 - score_10
        diff_2 = score_1000 - score_100

        # 10->100 should have larger relative increase than 100->1000
        assert diff_1 < diff_2 * 3  # Approximate log behavior


class TestVelocityNormalization:
    """Test velocity normalization."""

    def test_normalize_zero_velocity(self, db: Session):
        """Test normalization of zero velocity."""
        service = EventRankingService(db)
        assert service._normalize_velocity(0) == 0.0

    def test_normalize_negative_velocity(self, db: Session):
        """Test normalization of negative velocity."""
        service = EventRankingService(db)
        assert service._normalize_velocity(-10) == 0.0

    def test_normalize_moderate_velocity(self, db: Session):
        """Test normalization of moderate velocity."""
        service = EventRankingService(db)
        score = service._normalize_velocity(50)
        assert 0 < score < 1.0

    def test_normalize_max_velocity(self, db: Session):
        """Test normalization at max velocity."""
        service = EventRankingService(db)
        config = RankingConfig()
        score = service._normalize_velocity(config.MAX_VELOCITY_FOR_NORM)
        assert score == 1.0


class TestEngagementNormalization:
    """Test engagement normalization."""

    def test_normalize_zero_engagement(self, db: Session):
        """Test normalization of zero engagement."""
        service = EventRankingService(db)
        assert service._normalize_engagement(0) == 0.0

    def test_normalize_moderate_engagement(self, db: Session):
        """Test normalization of moderate engagement."""
        service = EventRankingService(db)
        score = service._normalize_engagement(5.0)
        assert 0 < score < 1.0


class TestFreshnessCalculation:
    """Test freshness score calculation."""

    def test_freshness_new_event(self, db: Session, test_user: dict):
        """Test freshness for brand new event."""
        service = EventRankingService(db)

        event = Event(
            title="New Event",
            creator_id=test_user["user"].id,
            starts_at=datetime.utcnow(),
            status="active"
        )
        db.add(event)
        db.commit()

        freshness = service._calculate_freshness(event)
        assert freshness > 0.9  # Very fresh

    def test_freshness_old_event(self, db: Session, test_user: dict):
        """Test freshness decay for older event."""
        service = EventRankingService(db)

        event = Event(
            title="Old Event",
            creator_id=test_user["user"].id,
            starts_at=datetime.utcnow() - timedelta(hours=24),
            status="active"
        )
        db.add(event)
        db.commit()

        freshness = service._calculate_freshness(event)
        assert freshness < 0.2  # Should have decayed significantly

    def test_freshness_half_life(self, db: Session, test_user: dict):
        """Test that freshness halves after half-life period."""
        service = EventRankingService(db)
        config = RankingConfig()

        # Event at half-life hours ago
        event = Event(
            title="Half-life Event",
            creator_id=test_user["user"].id,
            starts_at=datetime.utcnow() - timedelta(hours=config.FRESHNESS_HALF_LIFE_HOURS),
            status="active"
        )
        db.add(event)
        db.commit()

        freshness = service._calculate_freshness(event)
        assert abs(freshness - 0.5) < 0.1  # Should be around 0.5

    def test_freshness_no_starts_at_uses_created_at(self, db: Session, test_user: dict):
        """Test freshness uses created_at when starts_at is None."""
        service = EventRankingService(db)

        event = Event(
            title="No starts_at Event",
            creator_id=test_user["user"].id,
            status="active"
        )
        db.add(event)
        db.commit()

        freshness = service._calculate_freshness(event)
        # created_at is set to now, so freshness should be high
        assert freshness > 0.9


class TestRankingScoreCalculation:
    """Test overall ranking score calculation."""

    def test_ranking_score_range(self, db: Session, test_user: dict):
        """Test that ranking score is in 0-1 range."""
        service = EventRankingService(db)

        event = Event(
            title="Test Event",
            creator_id=test_user["user"].id,
            status="active",
            total_viewers=1000
        )
        db.add(event)
        db.commit()

        score = service.calculate_ranking_score(event)
        assert 0 <= score <= 1

    def test_ranking_score_increases_with_viewers(self, db: Session, test_user: dict):
        """Test that ranking score increases with more viewers."""
        service = EventRankingService(db)

        event1 = Event(
            title="Small Event",
            creator_id=test_user["user"].id,
            status="active",
            total_viewers=10,
            starts_at=datetime.utcnow()
        )
        event2 = Event(
            title="Large Event",
            creator_id=test_user["user"].id,
            status="active",
            total_viewers=1000,
            starts_at=datetime.utcnow()
        )
        db.add_all([event1, event2])
        db.commit()

        score1 = service.calculate_ranking_score(event1)
        score2 = service.calculate_ranking_score(event2)

        assert score2 > score1


class TestTrendingDetection:
    """Test trending event detection."""

    def test_is_trending_with_no_streams(self, db: Session, test_user: dict):
        """Test trending detection when no streams."""
        service = EventRankingService(db)

        event = Event(
            title="Empty Event",
            creator_id=test_user["user"].id,
            status="active"
        )
        db.add(event)
        db.commit()

        assert service.is_trending(event) is False

    def test_trending_score_range(self, db: Session, test_user: dict):
        """Test that trending score is in valid range."""
        service = EventRankingService(db)

        event = Event(
            title="Test Event",
            creator_id=test_user["user"].id,
            status="active",
            starts_at=datetime.utcnow()
        )
        db.add(event)
        db.commit()

        score = service.calculate_trending_score(event)
        assert 0 <= score <= 1


class TestHotAndFeatured:
    """Test hot and featured event detection."""

    def test_is_hot_below_threshold(self, db: Session, test_user: dict):
        """Test is_hot returns False below threshold."""
        service = EventRankingService(db)

        event = Event(
            title="Cold Event",
            creator_id=test_user["user"].id,
            status="active",
            ranking_score=0.3  # Below HOT_THRESHOLD
        )
        db.add(event)
        db.commit()

        assert service.is_hot(event) is False

    def test_is_hot_above_threshold(self, db: Session, test_user: dict):
        """Test is_hot returns True above threshold."""
        service = EventRankingService(db)
        config = RankingConfig()

        event = Event(
            title="Hot Event",
            creator_id=test_user["user"].id,
            status="active",
            ranking_score=config.HOT_THRESHOLD + 0.1
        )
        db.add(event)
        db.commit()

        assert service.is_hot(event) is True

    def test_should_feature_below_threshold(self, db: Session, test_user: dict):
        """Test should_feature returns False below threshold."""
        service = EventRankingService(db)

        event = Event(
            title="Normal Event",
            creator_id=test_user["user"].id,
            status="active",
            ranking_score=0.5  # Below FEATURED_THRESHOLD
        )
        db.add(event)
        db.commit()

        assert service.should_feature(event) is False

    def test_should_feature_above_threshold(self, db: Session, test_user: dict):
        """Test should_feature returns True above threshold."""
        service = EventRankingService(db)
        config = RankingConfig()

        event = Event(
            title="Featured Event",
            creator_id=test_user["user"].id,
            status="active",
            ranking_score=config.FEATURED_THRESHOLD + 0.1
        )
        db.add(event)
        db.commit()

        assert service.should_feature(event) is True


class TestUpdateEventRanking:
    """Test event ranking updates."""

    def test_update_event_ranking_sets_score(self, db: Session, test_user: dict):
        """Test that update_event_ranking sets the score."""
        service = EventRankingService(db)

        event = Event(
            title="Update Test",
            creator_id=test_user["user"].id,
            status="active",
            total_viewers=500,
            starts_at=datetime.utcnow()
        )
        db.add(event)
        db.commit()

        initial_score = event.ranking_score
        service.update_event_ranking(event)

        # Score should be set (not None)
        assert event.ranking_score is not None
        assert event.ranking_score >= 0

    def test_update_event_auto_features(self, db: Session, test_user: dict):
        """Test that high-score events are auto-featured."""
        service = EventRankingService(db)
        config = RankingConfig()

        event = Event(
            title="High Score Event",
            creator_id=test_user["user"].id,
            status="active",
            total_viewers=10000,  # High viewer count
            starts_at=datetime.utcnow(),
            is_featured=False
        )
        db.add(event)
        db.commit()

        # Manually set a high score to trigger featuring
        event.ranking_score = config.FEATURED_THRESHOLD + 0.1
        service.update_event_ranking(event)

        # If score is above threshold, should be featured
        if event.ranking_score >= config.FEATURED_THRESHOLD:
            assert event.is_featured is True


class TestUpdateAllRankings:
    """Test bulk ranking updates."""

    def test_update_all_rankings(self, db: Session, test_user: dict):
        """Test updating all event rankings."""
        service = EventRankingService(db)

        # Create multiple events
        events = []
        for i in range(3):
            event = Event(
                title=f"Event {i}",
                creator_id=test_user["user"].id,
                status="active",
                total_viewers=i * 100,
                starts_at=datetime.utcnow()
            )
            events.append(event)

        db.add_all(events)
        db.commit()

        result = service.update_all_rankings()

        assert result["events_updated"] >= 3
        assert "trending_events" in result
        assert "featured_events" in result


class TestGetTrendingEvents:
    """Test retrieving trending events."""

    def test_get_trending_events_empty(self, db: Session, test_user: dict):
        """Test getting trending events when none exist."""
        service = EventRankingService(db)
        trending = service.get_trending_events(limit=10)
        assert isinstance(trending, list)

    def test_get_trending_respects_limit(self, db: Session, test_user: dict):
        """Test that get_trending_events respects limit."""
        service = EventRankingService(db)

        # Create events
        for i in range(5):
            event = Event(
                title=f"Event {i}",
                creator_id=test_user["user"].id,
                status="active",
                ranking_score=0.8  # High score
            )
            db.add(event)

        db.commit()

        trending = service.get_trending_events(limit=2)
        assert len(trending) <= 2


class TestGetFeaturedEvents:
    """Test retrieving featured events."""

    def test_get_featured_events(self, db: Session, test_user: dict):
        """Test getting featured events."""
        service = EventRankingService(db)

        # Create featured event
        event = Event(
            title="Featured Event",
            creator_id=test_user["user"].id,
            status="active",
            is_featured=True,
            ranking_score=0.8
        )
        db.add(event)
        db.commit()

        featured = service.get_featured_events(limit=10)
        assert len(featured) >= 1
        assert all(e.is_featured for e in featured)


class TestGetEventsByCategory:
    """Test retrieving events by category."""

    def test_get_events_by_category(self, db: Session, test_user: dict):
        """Test getting events filtered by category."""
        service = EventRankingService(db)

        # Create events in different categories
        event1 = Event(
            title="Music Event",
            creator_id=test_user["user"].id,
            status="active",
            category="music",
            ranking_score=0.5
        )
        event2 = Event(
            title="Sports Event",
            creator_id=test_user["user"].id,
            status="active",
            category="sports",
            ranking_score=0.5
        )
        db.add_all([event1, event2])
        db.commit()

        music_events = service.get_events_by_category("music")
        assert all(e.category == "music" for e in music_events)


class TestStreamRanking:
    """Test stream ranking within events."""

    def test_rank_stream_within_event(self, db: Session, test_user: dict):
        """Test ranking a stream within its event."""
        service = EventRankingService(db)

        event = Event(
            title="Test Event",
            creator_id=test_user["user"].id,
            status="active"
        )
        db.add(event)
        db.commit()

        stream = Stream(
            stream_key="test_stream",
            user_id=test_user["user"].id,
            title="Test Stream",
            event_id=event.id,
            status="live",
            viewer_count=100
        )
        db.add(stream)
        db.commit()

        score = service.rank_stream_within_event(stream, event)
        assert 0 <= score <= 1

    def test_get_primary_stream_no_streams(self, db: Session, test_user: dict):
        """Test getting primary stream when none exist."""
        service = EventRankingService(db)

        event = Event(
            title="Empty Event",
            creator_id=test_user["user"].id,
            status="active"
        )
        db.add(event)
        db.commit()

        primary = service.get_primary_stream_for_event(event)
        assert primary is None

    def test_get_primary_stream_selects_best(self, db: Session, test_user: dict):
        """Test that get_primary_stream selects highest-ranked stream."""
        service = EventRankingService(db)

        event = Event(
            title="Multi-Stream Event",
            creator_id=test_user["user"].id,
            status="active"
        )
        db.add(event)
        db.commit()

        # Create streams with different viewer counts
        stream1 = Stream(
            stream_key="stream_low",
            user_id=test_user["user"].id,
            title="Low Viewers",
            event_id=event.id,
            status="live",
            viewer_count=10
        )
        stream2 = Stream(
            stream_key="stream_high",
            user_id=test_user["user"].id,
            title="High Viewers",
            event_id=event.id,
            status="live",
            viewer_count=1000
        )
        db.add_all([stream1, stream2])
        db.commit()

        primary = service.get_primary_stream_for_event(event)
        assert primary is not None
        assert primary.viewer_count == 1000  # Should select highest viewers


class TestFactoryFunction:
    """Test ranking service factory."""

    def test_get_ranking_service(self, db: Session):
        """Test getting ranking service with provided session."""
        service = get_ranking_service(db)
        assert isinstance(service, EventRankingService)
        assert service.db == db


class TestRankingSnapshot:
    """Test RankingSnapshot dataclass."""

    def test_create_snapshot(self):
        """Test creating a ranking snapshot."""
        snapshot = RankingSnapshot(
            event_id=1,
            timestamp=datetime.utcnow(),
            viewer_count=100,
            ranking_score=0.5,
            trending_score=0.3,
            velocity_score=0.2
        )

        assert snapshot.event_id == 1
        assert snapshot.viewer_count == 100
        assert snapshot.ranking_score == 0.5
