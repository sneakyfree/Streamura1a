"""
Streamura Event Ranking Service

This module implements the ranking algorithm for events and streams.
The ranking system determines what appears in trending, discovery feeds,
and search results.

Ranking Formula:
    Score = w1*viewers + w2*velocity + w3*engagement + w4*freshness + w5*quality

Where:
- viewers: Current viewer count (normalized)
- velocity: Growth rate of viewers over time
- engagement: Chat messages, tips, shares per viewer
- freshness: Recency bonus (decays over time)
- quality: Stream quality score and trust metrics
"""

import math
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Event, Stream
from .database import SessionLocal

logger = logging.getLogger(__name__)


class RankingConfig:
    """Configuration for the ranking algorithm"""

    # Weight distribution (must sum to 1.0)
    WEIGHTS = {
        'viewer_count': 0.30,
        'velocity': 0.25,
        'engagement': 0.20,
        'freshness': 0.15,
        'quality': 0.10
    }

    # Normalization parameters
    MAX_VIEWERS_FOR_NORM: int = 10000  # Viewers above this get score 1.0
    MAX_VELOCITY_FOR_NORM: float = 100.0  # Viewers/minute for max score
    MAX_ENGAGEMENT_FOR_NORM: float = 10.0  # Interactions per viewer
    FRESHNESS_HALF_LIFE_HOURS: float = 6.0  # Score halves every N hours

    # Trending detection
    TRENDING_VELOCITY_THRESHOLD: float = 10.0  # Viewers/minute to be trending
    TRENDING_WINDOW_MINUTES: int = 15  # Window to measure velocity

    # Score thresholds
    FEATURED_THRESHOLD: float = 0.7
    HOT_THRESHOLD: float = 0.5


@dataclass
class RankingSnapshot:
    """Point-in-time ranking data for an event"""
    event_id: int
    timestamp: datetime
    viewer_count: int
    ranking_score: float
    trending_score: float
    velocity_score: float


class EventRankingService:
    """
    Service for calculating and updating event rankings.

    Rankings are used for:
    - Trending events feed
    - Discovery page ordering
    - Search result ranking
    - Event recommendations
    """

    def __init__(self, db: Session):
        self.db = db
        self.config = RankingConfig()

    def _normalize_viewers(self, viewer_count: int) -> float:
        """
        Normalize viewer count to 0-1 scale using logarithmic scaling.

        Uses log scale to prevent mega-events from dominating.
        """
        if viewer_count <= 0:
            return 0.0

        # Log scale: log(1) = 0, log(10000) ≈ 9.2
        max_log = math.log(self.config.MAX_VIEWERS_FOR_NORM + 1)
        score = math.log(viewer_count + 1) / max_log

        return min(score, 1.0)

    def _calculate_velocity(
        self,
        event: Event,
        window_minutes: int = None
    ) -> float:
        """
        Calculate viewer growth velocity (viewers per minute).

        A higher velocity indicates rapidly growing interest.

        Returns:
            Velocity in viewers per minute
        """
        if window_minutes is None:
            window_minutes = self.config.TRENDING_WINDOW_MINUTES

        # Get streams for this event
        streams = (
            self.db.query(Stream)
            .filter(Stream.event_id == event.id, Stream.status == "live")
            .all()
        )

        if not streams:
            return 0.0

        # Calculate time since event started
        if event.starts_at:
            duration_minutes = (
                datetime.utcnow() - event.starts_at
            ).total_seconds() / 60
        else:
            duration_minutes = window_minutes

        # Avoid division by zero
        duration_minutes = max(duration_minutes, 1.0)

        # Calculate average viewers over the window
        current_viewers = sum(s.viewer_count or 0 for s in streams)
        peak_viewers = sum(s.peak_viewers or 0 for s in streams)

        # Velocity = change in viewers / time
        # Approximate using current vs initial (0)
        # In production, would use time-series data
        velocity = current_viewers / min(duration_minutes, window_minutes)

        return velocity

    def _normalize_velocity(self, velocity: float) -> float:
        """Normalize velocity to 0-1 scale"""
        if velocity <= 0:
            return 0.0

        score = velocity / self.config.MAX_VELOCITY_FOR_NORM
        return min(score, 1.0)

    def _calculate_engagement(self, event: Event) -> float:
        """
        Calculate engagement score based on viewer interactions.

        Factors:
        - Chat messages per viewer
        - Tips per viewer
        - Shares per viewer
        - Average watch time

        Returns:
            Engagement score (interactions per viewer)
        """
        # Get all streams for this event
        streams = (
            self.db.query(Stream)
            .filter(Stream.event_id == event.id)
            .all()
        )

        if not streams:
            return 0.0

        total_viewers = sum(s.viewer_count or 0 for s in streams)
        if total_viewers == 0:
            return 0.0

        # Sum up engagement metrics
        # Note: In full implementation, would pull from chat_messages table
        total_watch_time = sum(s.total_watch_time or 0 for s in streams)

        # Estimate engagement based on watch time
        # Average watch time > 5 min indicates good engagement
        avg_watch_time_minutes = (total_watch_time / total_viewers) / 60 if total_viewers > 0 else 0

        # Map to engagement score (5 min = 1.0, 10 min = 2.0, etc.)
        engagement = avg_watch_time_minutes / 5.0

        return engagement

    def _normalize_engagement(self, engagement: float) -> float:
        """Normalize engagement to 0-1 scale"""
        if engagement <= 0:
            return 0.0

        score = engagement / self.config.MAX_ENGAGEMENT_FOR_NORM
        return min(score, 1.0)

    def _calculate_freshness(self, event: Event) -> float:
        """
        Calculate freshness score with exponential decay.

        Newer events get a boost, which decays over time.

        Returns:
            Freshness score 0-1
        """
        if not event.starts_at and not event.created_at:
            return 0.5  # Default for events without timestamp

        event_time = event.starts_at or event.created_at
        hours_old = (datetime.utcnow() - event_time).total_seconds() / 3600

        # Exponential decay: score = 2^(-hours / half_life)
        decay_factor = math.pow(
            0.5,
            hours_old / self.config.FRESHNESS_HALF_LIFE_HOURS
        )

        return decay_factor

    def _calculate_quality(self, event: Event) -> float:
        """
        Calculate quality score based on stream quality metrics.

        Factors:
        - Stream resolution/bitrate
        - Connection stability
        - Broadcaster trust score
        - Content appropriateness

        Returns:
            Quality score 0-1
        """
        # Get streams for quality assessment
        streams = (
            self.db.query(Stream)
            .filter(Stream.event_id == event.id, Stream.status == "live")
            .all()
        )

        if not streams:
            return 0.5  # Default quality

        # For now, use a simple heuristic based on viewer retention
        # In full implementation, would use actual quality metrics
        total_watch_time = sum(s.total_watch_time or 0 for s in streams)
        total_viewers = sum(s.viewer_count or 0 for s in streams)

        if total_viewers == 0:
            return 0.5

        # Assume quality correlates with watch time
        avg_watch_minutes = (total_watch_time / total_viewers) / 60

        # Map: 0 min = 0.3, 5 min = 0.7, 10+ min = 1.0
        quality = 0.3 + (min(avg_watch_minutes, 10) / 10) * 0.7

        return quality

    def calculate_ranking_score(self, event: Event) -> float:
        """
        Calculate the overall ranking score for an event.

        Returns:
            Ranking score 0-1
        """
        weights = self.config.WEIGHTS

        # Calculate individual components
        viewer_score = self._normalize_viewers(event.total_viewers or 0)
        velocity = self._calculate_velocity(event)
        velocity_score = self._normalize_velocity(velocity)
        engagement = self._calculate_engagement(event)
        engagement_score = self._normalize_engagement(engagement)
        freshness_score = self._calculate_freshness(event)
        quality_score = self._calculate_quality(event)

        # Weighted combination
        total_score = (
            viewer_score * weights['viewer_count'] +
            velocity_score * weights['velocity'] +
            engagement_score * weights['engagement'] +
            freshness_score * weights['freshness'] +
            quality_score * weights['quality']
        )

        return round(total_score, 4)

    def calculate_trending_score(self, event: Event) -> float:
        """
        Calculate a separate trending score focused on velocity.

        Used to detect rapidly rising events that should be
        highlighted in the trending section.

        Returns:
            Trending score 0-1
        """
        velocity = self._calculate_velocity(event)
        velocity_score = self._normalize_velocity(velocity)

        # Freshness boost for trending
        freshness = self._calculate_freshness(event)

        # Trending = 60% velocity + 40% freshness
        trending_score = velocity_score * 0.6 + freshness * 0.4

        return round(trending_score, 4)

    def is_trending(self, event: Event) -> bool:
        """
        Determine if an event qualifies as trending.

        Returns:
            True if event meets trending criteria
        """
        velocity = self._calculate_velocity(event)
        return velocity >= self.config.TRENDING_VELOCITY_THRESHOLD

    def is_hot(self, event: Event) -> bool:
        """
        Determine if an event is "hot" (above threshold).

        Returns:
            True if event is hot
        """
        return event.ranking_score >= self.config.HOT_THRESHOLD

    def should_feature(self, event: Event) -> bool:
        """
        Determine if an event should be featured.

        Returns:
            True if event should be featured
        """
        return event.ranking_score >= self.config.FEATURED_THRESHOLD

    def update_event_ranking(self, event: Event) -> None:
        """
        Update ranking scores for a single event.

        Updates:
        - ranking_score
        - is_featured flag
        """
        event.ranking_score = self.calculate_ranking_score(event)

        # Auto-feature high-ranking events
        if self.should_feature(event) and not event.is_featured:
            event.is_featured = True
            logger.info(f"Auto-featuring event {event.id} (score: {event.ranking_score})")

        self.db.commit()

    def update_all_rankings(self) -> Dict[str, Any]:
        """
        Update rankings for all active events.

        Returns:
            Summary of updates
        """
        active_events = (
            self.db.query(Event)
            .filter(Event.status == "active")
            .all()
        )

        updated = 0
        trending = 0
        featured = 0

        for event in active_events:
            self.update_event_ranking(event)
            updated += 1

            if self.is_trending(event):
                trending += 1

            if event.is_featured:
                featured += 1

        self.db.commit()

        result = {
            "events_updated": updated,
            "trending_events": trending,
            "featured_events": featured
        }

        logger.info(f"Ranking update complete: {result}")
        return result

    def get_trending_events(
        self,
        limit: int = 10,
        category: Optional[str] = None
    ) -> List[Event]:
        """
        Get top trending events.

        Args:
            limit: Maximum events to return
            category: Optional category filter

        Returns:
            List of events ordered by trending score
        """
        query = (
            self.db.query(Event)
            .filter(Event.status == "active")
        )

        if category:
            query = query.filter(Event.category == category)

        # Order by a combination of velocity (trending) and total score
        events = query.order_by(Event.ranking_score.desc()).limit(limit).all()

        # Filter to only truly trending events
        trending = [e for e in events if self.is_trending(e)]

        return trending[:limit]

    def get_featured_events(
        self,
        limit: int = 5
    ) -> List[Event]:
        """
        Get featured events.

        Returns:
            List of featured events
        """
        events = (
            self.db.query(Event)
            .filter(Event.status == "active", Event.is_featured == True)
            .order_by(Event.ranking_score.desc())
            .limit(limit)
            .all()
        )

        return events

    def get_events_by_category(
        self,
        category: str,
        limit: int = 20
    ) -> List[Event]:
        """
        Get top events in a category.

        Returns:
            List of events ordered by ranking
        """
        events = (
            self.db.query(Event)
            .filter(Event.status == "active", Event.category == category)
            .order_by(Event.ranking_score.desc())
            .limit(limit)
            .all()
        )

        return events

    def rank_stream_within_event(
        self,
        stream: Stream,
        event: Event
    ) -> float:
        """
        Calculate a stream's rank within its event.

        Used to determine which stream to show as primary.

        Returns:
            Rank score 0-1
        """
        if not event:
            return 0.0

        # Factors for stream ranking
        viewer_score = self._normalize_viewers(stream.viewer_count or 0)

        # Quality bonus (if we have quality data)
        quality_score = 0.5  # Default

        # Broadcaster trust score would go here
        trust_score = 0.5  # Default

        # Weighted combination
        score = (
            viewer_score * 0.5 +
            quality_score * 0.3 +
            trust_score * 0.2
        )

        return round(score, 4)

    def get_primary_stream_for_event(
        self,
        event: Event
    ) -> Optional[Stream]:
        """
        Get the best stream to display as primary for an event.

        Returns:
            The highest-ranked live stream, or None
        """
        streams = (
            self.db.query(Stream)
            .filter(Stream.event_id == event.id, Stream.status == "live")
            .all()
        )

        if not streams:
            return None

        # Rank each stream
        ranked = [
            (s, self.rank_stream_within_event(s, event))
            for s in streams
        ]

        # Sort by rank descending
        ranked.sort(key=lambda x: x[1], reverse=True)

        return ranked[0][0] if ranked else None


def get_ranking_service(db: Session = None) -> EventRankingService:
    """
    Factory function to get a ranking service instance.
    """
    if db is None:
        db = SessionLocal()
    return EventRankingService(db)


def update_rankings():
    """
    Convenience function to update all rankings.
    Used by Celery tasks.
    """
    db = SessionLocal()
    try:
        service = EventRankingService(db)
        result = service.update_all_rankings()

        # Invalidate ranking-related caches
        try:
            import asyncio
            from .cache import invalidate_on_ranking_update
            asyncio.get_event_loop().run_until_complete(invalidate_on_ranking_update())
        except Exception as e:
            logger.warning(f"Cache invalidation failed: {e}")

        return result
    finally:
        db.close()
