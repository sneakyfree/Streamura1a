"""
Streamura Event Clustering Service

This module implements the core event clustering algorithm using DBSCAN
for geographic clustering with time-based correlation. This is the key
differentiator that makes Streamura unique - automatically detecting
and grouping nearby streams into unified "Events".

Algorithm Overview:
1. Fetch all active (live) streams with location data
2. Apply DBSCAN clustering based on geographic proximity
3. Filter clusters by time correlation (streams started within time window)
4. Create or update Event records for valid clusters
5. Assign streams to events with confidence scores
6. Recalculate aggregated event metrics
"""

import math
import logging
from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass

import numpy as np
from sklearn.cluster import DBSCAN
from geopy.distance import geodesic
from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Stream, Event
from .database import SessionLocal

logger = logging.getLogger(__name__)


# Configuration Constants
class ClusteringConfig:
    """Configuration for the event clustering algorithm"""

    # DBSCAN Parameters
    CLUSTER_RADIUS_METERS: float = 100.0  # eps parameter - max distance between streams
    MIN_STREAMS_FOR_EVENT: int = 2  # min_samples - minimum streams to form an event

    # Time Window
    TIME_WINDOW_MINUTES: int = 30  # streams must start within this window to cluster

    # Recalculation
    RECALCULATION_INTERVAL_SECONDS: int = 60  # how often to run clustering

    # Event Lifecycle
    EVENT_INACTIVE_TIMEOUT_MINUTES: int = 30  # mark event ended after no active streams
    EVENT_MERGE_DISTANCE_METERS: float = 150.0  # merge events closer than this

    # Confidence Thresholds
    HIGH_CONFIDENCE_THRESHOLD: float = 0.8
    MEDIUM_CONFIDENCE_THRESHOLD: float = 0.5


@dataclass
class StreamLocation:
    """Represents a stream with its location for clustering"""
    stream_id: int
    latitude: float
    longitude: float
    started_at: Optional[datetime]
    viewer_count: int

    def to_coordinates(self) -> Tuple[float, float]:
        """Return (lat, lon) tuple"""
        return (self.latitude, self.longitude)


@dataclass
class EventCluster:
    """Represents a detected cluster of streams"""
    streams: List[StreamLocation]
    centroid: Tuple[float, float]
    radius_meters: float
    confidence: float

    @property
    def stream_ids(self) -> List[int]:
        return [s.stream_id for s in self.streams]

    @property
    def total_viewers(self) -> int:
        return sum(s.viewer_count for s in self.streams)

    @property
    def stream_count(self) -> int:
        return len(self.streams)


class EventClusteringService:
    """
    Core clustering service for detecting events from nearby streams.

    This service runs periodically to:
    1. Find geographic clusters of live streams
    2. Create/update Event records
    3. Assign streams to events
    4. Calculate event metrics and rankings
    """

    def __init__(self, db: Session):
        self.db = db
        self.config = ClusteringConfig()

    def haversine_distance(
        self,
        point1: Tuple[float, float],
        point2: Tuple[float, float]
    ) -> float:
        """
        Calculate the great-circle distance between two points in meters.

        Args:
            point1: (latitude, longitude) tuple
            point2: (latitude, longitude) tuple

        Returns:
            Distance in meters
        """
        return geodesic(point1, point2).meters

    def get_active_streams_with_location(self) -> List[StreamLocation]:
        """
        Fetch all currently live streams that have location data.

        Returns:
            List of StreamLocation objects for clustering
        """
        streams = (
            self.db.query(Stream)
            .filter(
                Stream.status == "live",
                Stream.latitude.isnot(None),
                Stream.longitude.isnot(None)
            )
            .all()
        )

        return [
            StreamLocation(
                stream_id=s.id,
                latitude=s.latitude,
                longitude=s.longitude,
                started_at=s.starts_at,
                viewer_count=s.viewer_count or 0
            )
            for s in streams
        ]

    def _streams_within_time_window(
        self,
        streams: List[StreamLocation]
    ) -> bool:
        """
        Check if all streams started within the configured time window.

        Args:
            streams: List of streams to check

        Returns:
            True if all streams are temporally correlated
        """
        started_times = [s.started_at for s in streams if s.started_at]

        if len(started_times) < 2:
            return True  # Can't compare, assume correlated

        min_time = min(started_times)
        max_time = max(started_times)

        time_diff = (max_time - min_time).total_seconds() / 60
        return time_diff <= self.config.TIME_WINDOW_MINUTES

    def _calculate_cluster_confidence(
        self,
        streams: List[StreamLocation],
        centroid: Tuple[float, float]
    ) -> float:
        """
        Calculate confidence score for a cluster based on multiple factors.

        Factors:
        - Geographic density (streams closer together = higher confidence)
        - Stream count (more streams = higher confidence)
        - Viewer engagement (more viewers = higher confidence)
        - Time correlation (streams started closer together = higher confidence)

        Returns:
            Confidence score between 0.0 and 1.0
        """
        if len(streams) < self.config.MIN_STREAMS_FOR_EVENT:
            return 0.0

        # Factor 1: Geographic density (inverse of average distance to centroid)
        distances = [
            self.haversine_distance(s.to_coordinates(), centroid)
            for s in streams
        ]
        avg_distance = sum(distances) / len(distances)
        # Normalize: 0m = 1.0, 100m = 0.5, 200m = 0.25
        density_score = 1.0 / (1.0 + (avg_distance / self.config.CLUSTER_RADIUS_METERS))

        # Factor 2: Stream count (more is better, caps at 10)
        count_score = min(len(streams) / 10.0, 1.0)

        # Factor 3: Viewer engagement
        total_viewers = sum(s.viewer_count for s in streams)
        # Normalize: 0 viewers = 0.0, 100 viewers = 0.5, 500+ viewers = 1.0
        viewer_score = min(total_viewers / 500.0, 1.0)

        # Factor 4: Time correlation
        time_correlated = self._streams_within_time_window(streams)
        time_score = 1.0 if time_correlated else 0.5

        # Weighted combination
        confidence = (
            density_score * 0.35 +
            count_score * 0.25 +
            viewer_score * 0.20 +
            time_score * 0.20
        )

        return round(confidence, 2)

    def _calculate_centroid(
        self,
        streams: List[StreamLocation]
    ) -> Tuple[float, float]:
        """
        Calculate the geographic centroid of a cluster.

        Uses weighted average based on viewer count to center
        on the most popular streams.

        Returns:
            (latitude, longitude) tuple
        """
        if not streams:
            return (0.0, 0.0)

        # Use viewer count as weight (minimum 1 to avoid division issues)
        weights = [max(s.viewer_count, 1) for s in streams]
        total_weight = sum(weights)

        weighted_lat = sum(
            s.latitude * w for s, w in zip(streams, weights)
        ) / total_weight

        weighted_lon = sum(
            s.longitude * w for s, w in zip(streams, weights)
        ) / total_weight

        return (round(weighted_lat, 8), round(weighted_lon, 8))

    def _calculate_cluster_radius(
        self,
        streams: List[StreamLocation],
        centroid: Tuple[float, float]
    ) -> float:
        """
        Calculate the radius that encompasses all streams in the cluster.

        Returns:
            Radius in meters
        """
        if not streams:
            return self.config.CLUSTER_RADIUS_METERS

        max_distance = max(
            self.haversine_distance(s.to_coordinates(), centroid)
            for s in streams
        )

        # Add buffer to ensure all streams are within radius
        return round(max_distance * 1.1, 2)

    def cluster_active_streams(self) -> List[EventCluster]:
        """
        Main clustering method using DBSCAN algorithm.

        DBSCAN is ideal for geographic clustering because:
        - It doesn't require pre-specifying number of clusters
        - It can find arbitrarily shaped clusters
        - It handles noise (isolated streams) naturally

        Returns:
            List of EventCluster objects representing detected events
        """
        streams = self.get_active_streams_with_location()

        if len(streams) < self.config.MIN_STREAMS_FOR_EVENT:
            logger.info(f"Not enough streams for clustering: {len(streams)}")
            return []

        # Convert to numpy array for DBSCAN
        # Note: DBSCAN with haversine requires radians, but we use custom metric
        coordinates = np.array([
            [s.latitude, s.longitude] for s in streams
        ])

        # Custom distance matrix using haversine
        n_streams = len(streams)
        distance_matrix = np.zeros((n_streams, n_streams))

        for i in range(n_streams):
            for j in range(i + 1, n_streams):
                dist = self.haversine_distance(
                    streams[i].to_coordinates(),
                    streams[j].to_coordinates()
                )
                distance_matrix[i, j] = dist
                distance_matrix[j, i] = dist

        # Run DBSCAN with precomputed distance matrix
        clustering = DBSCAN(
            eps=self.config.CLUSTER_RADIUS_METERS,
            min_samples=self.config.MIN_STREAMS_FOR_EVENT,
            metric='precomputed'
        ).fit(distance_matrix)

        # Group streams by cluster label
        cluster_labels = clustering.labels_
        unique_labels = set(cluster_labels)

        event_clusters = []

        for label in unique_labels:
            # Skip noise points (label == -1)
            if label == -1:
                continue

            # Get streams in this cluster
            cluster_indices = np.where(cluster_labels == label)[0]
            cluster_streams = [streams[i] for i in cluster_indices]

            # Check time correlation
            if not self._streams_within_time_window(cluster_streams):
                logger.debug(f"Cluster {label} rejected: streams not time-correlated")
                continue

            # Calculate cluster properties
            centroid = self._calculate_centroid(cluster_streams)
            radius = self._calculate_cluster_radius(cluster_streams, centroid)
            confidence = self._calculate_cluster_confidence(cluster_streams, centroid)

            event_clusters.append(EventCluster(
                streams=cluster_streams,
                centroid=centroid,
                radius_meters=radius,
                confidence=confidence
            ))

        logger.info(f"Detected {len(event_clusters)} event clusters from {len(streams)} streams")
        return event_clusters

    def get_active_clusters(self) -> List[Dict[str, Any]]:
        """Return active geographic clusters as admin-friendly dicts.

        Adapts the transient geometric EventCluster objects from
        cluster_active_streams() into the serialized shape the admin
        cluster-management endpoint (GET /admin/clusters) expects.
        """
        clusters = self.cluster_active_streams()
        result: List[Dict[str, Any]] = []
        for i, c in enumerate(clusters):
            lat, lon = c.centroid
            result.append({
                "cluster_id": f"cluster-{i + 1}",
                "event_id": None,
                "title": f"Cluster @ {lat:.3f}, {lon:.3f}",
                "centroid": [lat, lon],
                "radius_meters": c.radius_meters,
                "confidence": c.confidence,
                "velocity": 0,
                "velocity_trend": "stable",
                "is_trending": c.confidence >= self.config.HIGH_CONFIDENCE_THRESHOLD,
                "is_featured": False,
                "category": None,
                "auto_generated": True,
                "locked": False,
                "streams": [
                    {
                        "stream_id": s.stream_id,
                        "viewer_count": s.viewer_count,
                        "latitude": s.latitude,
                        "longitude": s.longitude,
                    }
                    for s in c.streams
                ],
            })
        return result

    def should_streams_cluster(
        self,
        stream_a: Stream,
        stream_b: Stream
    ) -> bool:
        """
        Determine if two streams should be in the same cluster.

        Checks:
        - Geographic proximity
        - Time correlation

        Returns:
            True if streams should cluster together
        """
        # Check location
        if not all([
            stream_a.latitude, stream_a.longitude,
            stream_b.latitude, stream_b.longitude
        ]):
            return False

        distance = self.haversine_distance(
            (stream_a.latitude, stream_a.longitude),
            (stream_b.latitude, stream_b.longitude)
        )

        if distance > self.config.CLUSTER_RADIUS_METERS:
            return False

        # Check time window
        if stream_a.starts_at and stream_b.starts_at:
            time_diff = abs(
                (stream_a.starts_at - stream_b.starts_at).total_seconds()
            ) / 60
            if time_diff > self.config.TIME_WINDOW_MINUTES:
                return False

        return True

    def find_matching_event(
        self,
        cluster: EventCluster
    ) -> Optional[Event]:
        """
        Find an existing event that matches this cluster.

        Matches based on:
        - Geographic overlap (event centroid within cluster radius)
        - Active status

        Returns:
            Matching Event or None
        """
        # Get active events near the cluster centroid
        active_events = (
            self.db.query(Event)
            .filter(Event.status == "active")
            .all()
        )

        for event in active_events:
            if event.latitude is None or event.longitude is None:
                continue

            distance = self.haversine_distance(
                (event.latitude, event.longitude),
                cluster.centroid
            )

            # Check if event centroid is close enough to cluster
            if distance <= self.config.EVENT_MERGE_DISTANCE_METERS:
                return event

        return None

    def create_event_from_cluster(
        self,
        cluster: EventCluster
    ) -> Event:
        """
        Create a new Event from a detected cluster.

        Returns:
            Newly created Event
        """
        # Generate title based on location (can be enhanced with reverse geocoding)
        title = f"Live Event ({len(cluster.streams)} streams)"

        event = Event(
            title=title,
            status="active",
            latitude=cluster.centroid[0],
            longitude=cluster.centroid[1],
            radius=cluster.radius_meters,
            total_streams=cluster.stream_count,
            total_viewers=cluster.total_viewers,
            ranking_score=0.0
        )

        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        logger.info(f"Created new event {event.id} with {cluster.stream_count} streams")
        return event

    def update_event_from_cluster(
        self,
        event: Event,
        cluster: EventCluster
    ) -> Event:
        """
        Update an existing Event with cluster data.

        Returns:
            Updated Event
        """
        # Recalculate centroid with all streams
        event.latitude = cluster.centroid[0]
        event.longitude = cluster.centroid[1]
        event.radius = cluster.radius_meters
        event.total_streams = cluster.stream_count
        event.total_viewers = cluster.total_viewers

        self.db.commit()
        self.db.refresh(event)

        logger.debug(f"Updated event {event.id} with {cluster.stream_count} streams")
        return event

    def create_or_update_event(
        self,
        cluster: EventCluster
    ) -> Event:
        """
        Create a new Event or update an existing one based on cluster.

        Returns:
            Created or updated Event
        """
        existing_event = self.find_matching_event(cluster)

        if existing_event:
            return self.update_event_from_cluster(existing_event, cluster)
        else:
            return self.create_event_from_cluster(cluster)

    def assign_stream_to_event(
        self,
        stream: Stream,
        event: Event,
        confidence: float
    ) -> None:
        """
        Assign a stream to an event.

        Args:
            stream: Stream to assign
            event: Event to assign to
            confidence: Clustering confidence score
        """
        stream.event_id = event.id
        self.db.commit()

        logger.debug(f"Assigned stream {stream.id} to event {event.id} (confidence: {confidence})")

    def recalculate_event_metrics(
        self,
        event: Event
    ) -> None:
        """
        Recalculate aggregated metrics for an event.

        Updates:
        - total_streams
        - total_viewers
        - total_earnings
        - ranking_score
        """
        # Get all streams for this event
        streams = (
            self.db.query(Stream)
            .filter(Stream.event_id == event.id)
            .all()
        )

        if not streams:
            event.status = "ended"
            self.db.commit()
            return

        # Aggregate metrics
        event.total_streams = len(streams)
        event.total_viewers = sum(s.viewer_count or 0 for s in streams)
        event.total_earnings = sum(s.earnings or 0.0 for s in streams)

        # Count active (live) streams
        active_streams = [s for s in streams if s.status == "live"]

        if not active_streams:
            # Check if event should end
            last_active = max(
                (s.ends_at for s in streams if s.ends_at),
                default=None
            )
            if last_active:
                inactive_minutes = (
                    datetime.utcnow() - last_active
                ).total_seconds() / 60

                if inactive_minutes > self.config.EVENT_INACTIVE_TIMEOUT_MINUTES:
                    event.status = "ended"
                    event.ends_at = datetime.utcnow()

        self.db.commit()
        logger.debug(f"Updated metrics for event {event.id}: {event.total_streams} streams, {event.total_viewers} viewers")

    def merge_events(
        self,
        event_a: Event,
        event_b: Event
    ) -> Event:
        """
        Merge two events that have become geographically close.

        The event with more viewers becomes the primary event.
        All streams from the secondary event are reassigned.

        Returns:
            The merged (primary) Event
        """
        # Determine primary event (more viewers wins)
        if event_a.total_viewers >= event_b.total_viewers:
            primary, secondary = event_a, event_b
        else:
            primary, secondary = event_b, event_a

        # Reassign all streams from secondary to primary
        (
            self.db.query(Stream)
            .filter(Stream.event_id == secondary.id)
            .update({"event_id": primary.id})
        )

        # Mark secondary as merged/ended
        secondary.status = "merged"
        secondary.ends_at = datetime.utcnow()

        # Recalculate primary metrics
        self.recalculate_event_metrics(primary)

        self.db.commit()

        logger.info(f"Merged event {secondary.id} into event {primary.id}")
        return primary

    def check_for_merge_candidates(self) -> None:
        """
        Check for events that should be merged due to proximity.
        """
        active_events = (
            self.db.query(Event)
            .filter(Event.status == "active")
            .all()
        )

        merged = set()

        for i, event_a in enumerate(active_events):
            if event_a.id in merged:
                continue

            for event_b in active_events[i + 1:]:
                if event_b.id in merged:
                    continue

                if event_a.latitude and event_b.latitude:
                    distance = self.haversine_distance(
                        (event_a.latitude, event_a.longitude),
                        (event_b.latitude, event_b.longitude)
                    )

                    if distance <= self.config.EVENT_MERGE_DISTANCE_METERS:
                        self.merge_events(event_a, event_b)
                        merged.add(event_b.id)

    def run_clustering_cycle(self) -> Dict[str, Any]:
        """
        Run a complete clustering cycle.

        This is the main entry point called periodically.

        Returns:
            Summary of clustering results
        """
        logger.info("Starting clustering cycle")

        # Step 1: Detect clusters
        clusters = self.cluster_active_streams()

        events_created = 0
        events_updated = 0
        streams_assigned = 0

        # Step 2: Process each cluster
        for cluster in clusters:
            event = self.create_or_update_event(cluster)

            if event.created_at and (datetime.utcnow() - event.created_at).total_seconds() < 5:
                events_created += 1
            else:
                events_updated += 1

            # Assign streams to event
            for stream_loc in cluster.streams:
                stream = self.db.query(Stream).get(stream_loc.stream_id)
                if stream and stream.event_id != event.id:
                    self.assign_stream_to_event(stream, event, cluster.confidence)
                    streams_assigned += 1

        # Step 3: Check for merge candidates
        self.check_for_merge_candidates()

        # Step 4: Update metrics for all active events
        active_events = (
            self.db.query(Event)
            .filter(Event.status == "active")
            .all()
        )

        for event in active_events:
            self.recalculate_event_metrics(event)

        result = {
            "clusters_detected": len(clusters),
            "events_created": events_created,
            "events_updated": events_updated,
            "streams_assigned": streams_assigned,
            "active_events": len(active_events)
        }

        logger.info(f"Clustering cycle complete: {result}")
        return result


def get_clustering_service(db: Session = None) -> EventClusteringService:
    """
    Factory function to get a clustering service instance.

    Args:
        db: Optional database session. If not provided, creates new session.

    Returns:
        EventClusteringService instance
    """
    if db is None:
        db = SessionLocal()
    return EventClusteringService(db)


def run_clustering():
    """
    Convenience function to run a single clustering cycle.
    Used by Celery tasks and CLI.
    """
    db = SessionLocal()
    try:
        service = EventClusteringService(db)
        return service.run_clustering_cycle()
    finally:
        db.close()
