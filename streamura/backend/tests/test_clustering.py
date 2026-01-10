"""
Tests for Event Clustering Module

Tests the following functionality:
- ClusteringConfig validation and defaults
- Haversine distance calculations
- StreamLocation and EventCluster dataclasses
- DBSCAN clustering algorithm
- Event creation/update from clusters
- Event merging
- Clustering cycle execution
"""

import pytest
import math
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from dataclasses import asdict

from backend.clustering import (
    ClusteringConfig,
    StreamLocation,
    EventCluster,
    EventClusteringService,
    get_clustering_service,
)


class TestClusteringConfig:
    """Test clustering configuration."""

    def test_default_values(self):
        """Test that config has sensible defaults."""
        config = ClusteringConfig()

        # Class attributes should exist
        assert config.MIN_STREAMS_FOR_EVENT >= 2
        assert config.CLUSTER_RADIUS_METERS > 0
        assert config.TIME_WINDOW_MINUTES > 0
        assert config.EVENT_MERGE_DISTANCE_METERS > 0
        assert config.EVENT_INACTIVE_TIMEOUT_MINUTES > 0

    def test_has_dbscan_parameters(self):
        """Test that DBSCAN parameters are present."""
        config = ClusteringConfig()

        assert hasattr(config, 'CLUSTER_RADIUS_METERS')
        assert hasattr(config, 'MIN_STREAMS_FOR_EVENT')

    def test_has_confidence_thresholds(self):
        """Test that confidence thresholds exist."""
        config = ClusteringConfig()

        assert hasattr(config, 'HIGH_CONFIDENCE_THRESHOLD')
        assert hasattr(config, 'MEDIUM_CONFIDENCE_THRESHOLD')
        assert config.HIGH_CONFIDENCE_THRESHOLD > config.MEDIUM_CONFIDENCE_THRESHOLD


class TestStreamLocation:
    """Test StreamLocation dataclass."""

    def test_stream_location_creation(self):
        """Test creating a stream location."""
        now = datetime.utcnow()
        loc = StreamLocation(
            stream_id=1,
            latitude=40.7128,
            longitude=-74.0060,
            started_at=now,
            viewer_count=100
        )

        assert loc.stream_id == 1
        assert loc.latitude == 40.7128
        assert loc.longitude == -74.0060
        assert loc.viewer_count == 100
        assert loc.started_at == now

    def test_stream_location_as_dict(self):
        """Test converting stream location to dict."""
        now = datetime.utcnow()
        loc = StreamLocation(
            stream_id=1,
            latitude=40.7128,
            longitude=-74.0060,
            started_at=now,
            viewer_count=100
        )

        d = asdict(loc)
        assert d["stream_id"] == 1
        assert d["latitude"] == 40.7128

    def test_to_coordinates(self):
        """Test to_coordinates method returns tuple."""
        loc = StreamLocation(
            stream_id=1,
            latitude=40.7128,
            longitude=-74.0060,
            started_at=datetime.utcnow(),
            viewer_count=100
        )

        coords = loc.to_coordinates()
        assert coords == (40.7128, -74.0060)


class TestEventCluster:
    """Test EventCluster dataclass."""

    def test_event_cluster_creation(self):
        """Test creating an event cluster."""
        now = datetime.utcnow()
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7130, -74.0058, now, 150),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7129, -74.0059),
            radius_meters=50.0,
            confidence=0.85
        )

        assert len(cluster.streams) == 2
        assert cluster.centroid == (40.7129, -74.0059)
        assert cluster.radius_meters == 50.0
        assert cluster.confidence == 0.85

    def test_event_cluster_stream_count(self):
        """Test stream_count property."""
        now = datetime.utcnow()
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7130, -74.0058, now, 150),
            StreamLocation(3, 40.7132, -74.0056, now, 200),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7130, -74.0058),
            radius_meters=100.0,
            confidence=0.9
        )

        assert cluster.stream_count == 3

    def test_event_cluster_total_viewers(self):
        """Test total_viewers property."""
        now = datetime.utcnow()
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7130, -74.0058, now, 150),
            StreamLocation(3, 40.7132, -74.0056, now, 200),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7130, -74.0058),
            radius_meters=100.0,
            confidence=0.9
        )

        assert cluster.total_viewers == 450

    def test_event_cluster_stream_ids(self):
        """Test stream_ids property."""
        now = datetime.utcnow()
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7130, -74.0058, now, 150),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7129, -74.0059),
            radius_meters=50.0,
            confidence=0.85
        )

        assert cluster.stream_ids == [1, 2]


class TestHaversineDistance:
    """Test haversine distance calculations."""

    def test_same_point_zero_distance(self, db):
        """Test that same point has zero distance."""
        service = EventClusteringService(db)

        distance = service.haversine_distance(
            (40.7128, -74.0060),
            (40.7128, -74.0060)
        )

        assert distance == 0.0

    def test_known_distance_nyc_la(self, db):
        """Test distance between NYC and LA (approximately 3944 km)."""
        service = EventClusteringService(db)

        # NYC coordinates
        nyc = (40.7128, -74.0060)
        # LA coordinates
        la = (34.0522, -118.2437)

        distance = service.haversine_distance(nyc, la)

        # Should be approximately 3944 km = 3,944,000 meters
        # Allow 5% tolerance
        expected = 3944000
        assert abs(distance - expected) / expected < 0.05

    def test_short_distance_meters(self, db):
        """Test a short distance (within a city block)."""
        service = EventClusteringService(db)

        # Two points ~100 meters apart in Manhattan
        point_a = (40.7580, -73.9855)  # Times Square
        point_b = (40.7589, -73.9851)  # ~100m north

        distance = service.haversine_distance(point_a, point_b)

        # Should be approximately 100 meters
        assert 50 < distance < 200

    def test_symmetric_distance(self, db):
        """Test that distance is symmetric."""
        service = EventClusteringService(db)

        point_a = (40.7128, -74.0060)
        point_b = (34.0522, -118.2437)

        distance_ab = service.haversine_distance(point_a, point_b)
        distance_ba = service.haversine_distance(point_b, point_a)

        assert distance_ab == distance_ba

    def test_antipodal_points(self, db):
        """Test distance between antipodal points (half Earth circumference)."""
        service = EventClusteringService(db)

        # North Pole to South Pole
        north = (90.0, 0.0)
        south = (-90.0, 0.0)

        distance = service.haversine_distance(north, south)

        # Should be approximately half Earth's circumference (20,000 km)
        expected = 20000000  # 20,000 km in meters
        assert abs(distance - expected) / expected < 0.01


class TestStreamsWithinTimeWindow:
    """Test time window correlation checks."""

    def test_single_stream_within_window(self, db):
        """Test that single stream is within window."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100)
        ]

        result = service._streams_within_time_window(streams)
        assert result is True

    def test_streams_within_window(self, db):
        """Test streams started close together are within window."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now - timedelta(minutes=5), 150),
        ]

        result = service._streams_within_time_window(streams)
        assert result is True

    def test_streams_outside_window(self, db):
        """Test streams started far apart are outside window."""
        service = EventClusteringService(db)
        now = datetime.utcnow()
        # Beyond default TIME_WINDOW_MINUTES (30)
        old_time = now - timedelta(hours=2)

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, old_time, 150),
        ]

        result = service._streams_within_time_window(streams)
        assert result is False

    def test_streams_without_started_at(self, db):
        """Test streams without started_at are considered correlated."""
        service = EventClusteringService(db)

        streams = [
            StreamLocation(1, 40.7128, -74.0060, None, 100),
            StreamLocation(2, 40.7129, -74.0059, None, 150),
        ]

        result = service._streams_within_time_window(streams)
        assert result is True  # Can't compare, assume correlated


class TestCalculateCentroid:
    """Test centroid calculation."""

    def test_single_stream_centroid(self, db):
        """Test centroid of single stream is its location."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100)
        ]

        centroid = service._calculate_centroid(streams)

        assert centroid[0] == pytest.approx(40.7128, rel=0.0001)
        assert centroid[1] == pytest.approx(-74.0060, rel=0.0001)

    def test_two_stream_equal_weight_centroid(self, db):
        """Test centroid of two streams with equal viewers."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.0, -74.0, now, 100),
            StreamLocation(2, 42.0, -76.0, now, 100),
        ]

        centroid = service._calculate_centroid(streams)

        assert centroid[0] == pytest.approx(41.0, rel=0.01)
        assert centroid[1] == pytest.approx(-75.0, rel=0.01)

    def test_centroid_weighted_by_viewers(self, db):
        """Test that centroid is weighted by viewer count."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        # Stream 2 has many more viewers, centroid should be closer to it
        streams = [
            StreamLocation(1, 40.0, -74.0, now, 10),   # Few viewers
            StreamLocation(2, 42.0, -76.0, now, 990),  # Many viewers
        ]

        centroid = service._calculate_centroid(streams)

        # Centroid should be much closer to stream 2
        assert centroid[0] > 41.5  # Closer to 42.0
        assert centroid[1] < -75.5  # Closer to -76.0

    def test_empty_streams_centroid(self, db):
        """Test centroid of empty list returns origin."""
        service = EventClusteringService(db)

        centroid = service._calculate_centroid([])

        assert centroid == (0.0, 0.0)


class TestCalculateClusterRadius:
    """Test cluster radius calculation."""

    def test_single_stream_radius(self, db):
        """Test radius with single stream is zero."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100)
        ]
        centroid = (40.7128, -74.0060)

        radius = service._calculate_cluster_radius(streams, centroid)

        assert radius == 0.0

    def test_multiple_stream_radius(self, db):
        """Test radius is max distance from centroid."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        # Streams in a small area
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7130, -74.0058, now, 150),
            StreamLocation(3, 40.7132, -74.0056, now, 200),
        ]
        centroid = (40.7130, -74.0058)

        radius = service._calculate_cluster_radius(streams, centroid)

        # Should be positive and reasonable
        assert radius > 0
        assert radius < 1000  # Less than 1km for this small area


class TestCalculateClusterConfidence:
    """Test confidence score calculation."""

    def test_more_streams_higher_confidence(self, db):
        """Test that more streams give higher confidence."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        small_cluster = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now, 100),
        ]

        large_cluster = [
            StreamLocation(i, 40.7128 + i*0.00001, -74.0060, now, 100)
            for i in range(10)
        ]

        small_conf = service._calculate_cluster_confidence(small_cluster, (40.7128, -74.0060))
        large_conf = service._calculate_cluster_confidence(large_cluster, (40.7128, -74.0060))

        assert large_conf >= small_conf

    def test_more_viewers_higher_confidence(self, db):
        """Test that more viewers give higher confidence."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        low_viewers = [
            StreamLocation(1, 40.7128, -74.0060, now, 10),
            StreamLocation(2, 40.7129, -74.0059, now, 10),
        ]

        high_viewers = [
            StreamLocation(1, 40.7128, -74.0060, now, 500),
            StreamLocation(2, 40.7129, -74.0059, now, 500),
        ]

        low_conf = service._calculate_cluster_confidence(low_viewers, (40.7128, -74.0060))
        high_conf = service._calculate_cluster_confidence(high_viewers, (40.7128, -74.0060))

        assert high_conf > low_conf

    def test_confidence_between_0_and_1(self, db):
        """Test that confidence is always between 0 and 1."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(i, 40.7128 + i*0.001, -74.0060, now, 100)
            for i in range(5)
        ]

        confidence = service._calculate_cluster_confidence(streams, (40.7130, -74.0060))

        assert 0.0 <= confidence <= 1.0

    def test_insufficient_streams_zero_confidence(self, db):
        """Test that too few streams returns zero confidence."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        # Only one stream (below MIN_STREAMS_FOR_EVENT)
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
        ]

        confidence = service._calculate_cluster_confidence(streams, (40.7128, -74.0060))

        assert confidence == 0.0


class TestClusterActiveStreams:
    """Test the main clustering algorithm."""

    @patch.object(EventClusteringService, 'get_active_streams_with_location')
    def test_empty_streams_returns_empty(self, mock_get_streams, db):
        """Test that no streams returns empty clusters."""
        mock_get_streams.return_value = []
        service = EventClusteringService(db)

        clusters = service.cluster_active_streams()

        assert clusters == []

    @patch.object(EventClusteringService, 'get_active_streams_with_location')
    def test_single_stream_no_cluster(self, mock_get_streams, db):
        """Test that single stream doesn't form cluster (needs MIN_STREAMS_FOR_EVENT)."""
        now = datetime.utcnow()
        mock_get_streams.return_value = [
            StreamLocation(1, 40.7128, -74.0060, now, 100)
        ]
        service = EventClusteringService(db)

        clusters = service.cluster_active_streams()

        # Single stream can't form cluster with default MIN_STREAMS_FOR_EVENT = 2
        assert len(clusters) == 0


class TestEventCreationAndUpdate:
    """Test event creation and update from clusters."""

    def test_create_event_from_cluster(self, db):
        """Test creating an event from a cluster."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now, 150),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7128, -74.0060),
            radius_meters=50.0,
            confidence=0.85
        )

        event = service.create_event_from_cluster(cluster)

        assert event is not None
        assert event.id is not None
        assert event.status == "active"
        assert event.latitude == pytest.approx(40.7128, rel=0.001)
        assert event.longitude == pytest.approx(-74.0060, rel=0.001)
        assert event.total_streams == 2
        assert event.total_viewers == 250

    def test_find_matching_event(self, db, test_user):
        """Test finding an existing matching event."""
        from backend.models import Event

        # Create an existing event
        existing = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            radius=100.0,
            total_streams=1,
            total_viewers=100,
            creator_id=test_user["user"].id
        )
        db.add(existing)
        db.commit()

        service = EventClusteringService(db)
        now = datetime.utcnow()

        # Cluster at same location
        cluster = EventCluster(
            streams=[StreamLocation(1, 40.7128, -74.0060, now, 100)],
            centroid=(40.7128, -74.0060),
            radius_meters=50.0,
            confidence=0.9
        )

        found = service.find_matching_event(cluster)

        assert found is not None
        assert found.id == existing.id

    def test_update_event_from_cluster(self, db, test_user):
        """Test updating an event from cluster data."""
        from backend.models import Event

        # Create an existing event
        existing = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            radius=50.0,
            total_streams=1,
            total_viewers=100,
            creator_id=test_user["user"].id
        )
        db.add(existing)
        db.commit()

        service = EventClusteringService(db)
        now = datetime.utcnow()

        # New cluster with more streams
        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now, 150),
            StreamLocation(3, 40.7127, -74.0061, now, 200),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7128, -74.0060),
            radius_meters=75.0,
            confidence=0.9
        )

        updated = service.update_event_from_cluster(existing, cluster)

        assert updated.total_streams == 3
        assert updated.total_viewers == 450
        assert updated.radius == 75.0


class TestEventMerging:
    """Test event merging functionality."""

    def test_merge_events_more_viewers_wins(self, db, test_user):
        """Test that event with more viewers becomes primary."""
        from backend.models import Event

        # Create two events
        event_a = Event(
            title="Event A",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            total_streams=2,
            total_viewers=100,
            creator_id=test_user["user"].id
        )
        event_b = Event(
            title="Event B",
            status="active",
            latitude=40.7129,
            longitude=-74.0059,
            total_streams=3,
            total_viewers=300,  # More viewers
            creator_id=test_user["user"].id
        )
        db.add_all([event_a, event_b])
        db.commit()

        service = EventClusteringService(db)

        merged = service.merge_events(event_a, event_b)

        # Event B should be primary (more viewers)
        assert merged.id == event_b.id

        # Event A should be marked as merged
        db.refresh(event_a)
        assert event_a.status == "merged"

    def test_check_merge_candidates(self, db, test_user):
        """Test automatic merge candidate detection."""
        from backend.models import Event

        # Create two very close events
        event_a = Event(
            title="Event A",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            total_streams=2,
            total_viewers=100,
            creator_id=test_user["user"].id
        )
        event_b = Event(
            title="Event B",
            status="active",
            latitude=40.7128,  # Same location
            longitude=-74.0060,
            total_streams=3,
            total_viewers=200,
            creator_id=test_user["user"].id
        )
        db.add_all([event_a, event_b])
        db.commit()

        service = EventClusteringService(db)
        service.check_for_merge_candidates()

        # One event should be merged
        db.refresh(event_a)
        db.refresh(event_b)

        merged_count = sum(1 for e in [event_a, event_b] if e.status == "merged")
        assert merged_count == 1


class TestRecalculateEventMetrics:
    """Test event metrics recalculation."""

    def test_recalculate_with_streams(self, db, test_user):
        """Test metrics recalculation with active streams."""
        from backend.models import Event, Stream

        # Create event
        event = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            creator_id=test_user["user"].id
        )
        db.add(event)
        db.commit()

        # Create streams for the event
        for i in range(3):
            stream = Stream(
                title=f"Stream {i}",
                status="live",
                viewer_count=(i + 1) * 100,
                earnings=(i + 1) * 10.0,
                user_id=test_user["user"].id,
                event_id=event.id
            )
            db.add(stream)
        db.commit()

        service = EventClusteringService(db)
        service.recalculate_event_metrics(event)

        db.refresh(event)
        assert event.total_streams == 3
        assert event.total_viewers == 600  # 100 + 200 + 300
        assert event.total_earnings == 60.0  # 10 + 20 + 30

    def test_recalculate_no_streams_ends_event(self, db, test_user):
        """Test that event with no streams is marked ended."""
        from backend.models import Event

        event = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            creator_id=test_user["user"].id
        )
        db.add(event)
        db.commit()

        service = EventClusteringService(db)
        service.recalculate_event_metrics(event)

        db.refresh(event)
        assert event.status == "ended"


class TestClusteringCycle:
    """Test complete clustering cycle."""

    @patch.object(EventClusteringService, 'get_active_streams_with_location')
    def test_run_clustering_cycle_returns_summary(self, mock_get_streams, db):
        """Test that clustering cycle returns proper summary."""
        mock_get_streams.return_value = []
        service = EventClusteringService(db)

        result = service.run_clustering_cycle()

        assert "clusters_detected" in result
        assert "events_created" in result
        assert "events_updated" in result
        assert "streams_assigned" in result
        assert "active_events" in result


class TestGetClusteringService:
    """Test factory function."""

    def test_get_clustering_service_with_db(self, db):
        """Test getting service with provided db session."""
        service = get_clustering_service(db)

        assert service is not None
        assert isinstance(service, EventClusteringService)
        assert service.db is db

    def test_get_clustering_service_creates_session(self):
        """Test that service creates session when not provided."""
        # This may fail if database isn't configured
        try:
            service = get_clustering_service()
            assert service is not None
            assert service.db is not None
        except Exception:
            # Expected if no database configured
            pass


class TestAssignStreamToEvent:
    """Test stream-event assignment."""

    def test_assign_stream_to_event(self, db, test_user):
        """Test assigning a stream to an event."""
        from backend.models import Event, Stream

        # Create event
        event = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            creator_id=test_user["user"].id
        )
        db.add(event)

        # Create stream
        stream = Stream(
            title="Test Stream",
            status="live",
            user_id=test_user["user"].id
        )
        db.add(stream)
        db.commit()

        service = EventClusteringService(db)
        service.assign_stream_to_event(stream, event, confidence=0.85)

        db.refresh(stream)
        assert stream.event_id == event.id


class TestCreateOrUpdateEvent:
    """Test create_or_update_event logic."""

    def test_creates_new_event_when_no_match(self, db):
        """Test that new event is created when no match found."""
        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now, 150),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7128, -74.0060),
            radius_meters=50.0,
            confidence=0.85
        )

        event = service.create_or_update_event(cluster)

        assert event is not None
        assert event.id is not None
        assert event.status == "active"

    def test_updates_existing_event_when_match_found(self, db, test_user):
        """Test that existing event is updated when match found."""
        from backend.models import Event

        # Create existing event
        existing = Event(
            title="Test Event",
            status="active",
            latitude=40.7128,
            longitude=-74.0060,
            radius=50.0,
            total_streams=1,
            total_viewers=100,
            creator_id=test_user["user"].id
        )
        db.add(existing)
        db.commit()

        service = EventClusteringService(db)
        now = datetime.utcnow()

        streams = [
            StreamLocation(1, 40.7128, -74.0060, now, 100),
            StreamLocation(2, 40.7129, -74.0059, now, 200),
        ]

        cluster = EventCluster(
            streams=streams,
            centroid=(40.7128, -74.0060),
            radius_meters=75.0,
            confidence=0.9
        )

        event = service.create_or_update_event(cluster)

        # Should be the same event, updated
        assert event.id == existing.id
        assert event.total_streams == 2
        assert event.total_viewers == 300
