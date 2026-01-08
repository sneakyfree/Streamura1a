"""
Feature extraction module for ML predictions.

Extracts features from stream analytics, user history, and temporal data
for use in predictive models.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import statistics

from models import (
    User, Stream, StreamAnalytics, ChatMessage, StreamLike,
    UserFollow, Tip, CreatorPerformanceHistory, Subscription
)


class FeatureExtractor:
    """
    Extracts features from database for ML predictions.

    Features are organized into categories:
    - Creator features: historical performance of the streamer
    - Temporal features: time-based patterns (day of week, hour, season)
    - Content features: category, tags, title characteristics
    - Social features: follower count, engagement history
    - Platform features: competition level, trending topics
    """

    def __init__(self, db: Session):
        self.db = db

    async def extract_all_features(
        self,
        user_id: int,
        stream_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extract all features for a creator/stream prediction.

        Args:
            user_id: Creator's user ID
            stream_metadata: Optional dict with planned stream info:
                - category: Stream category
                - scheduled_start: Planned start time
                - title: Stream title
                - tags: List of tags

        Returns:
            Dict containing all extracted features
        """
        features = {}

        # Extract creator historical features
        creator_features = await self.extract_creator_features(user_id)
        features.update(creator_features)

        # Extract temporal features
        scheduled_time = None
        if stream_metadata and stream_metadata.get('scheduled_start'):
            scheduled_time = stream_metadata['scheduled_start']
        temporal_features = self.extract_temporal_features(scheduled_time)
        features.update(temporal_features)

        # Extract content features if metadata provided
        if stream_metadata:
            content_features = self.extract_content_features(stream_metadata)
            features.update(content_features)

        # Extract social features
        social_features = await self.extract_social_features(user_id)
        features.update(social_features)

        # Extract platform competition features
        platform_features = await self.extract_platform_features(
            stream_metadata.get('category') if stream_metadata else None,
            scheduled_time
        )
        features.update(platform_features)

        return features

    async def extract_creator_features(self, user_id: int) -> Dict[str, Any]:
        """Extract historical performance features for a creator."""
        features = {
            'creator_total_streams': 0,
            'creator_avg_viewers': 0.0,
            'creator_avg_peak_viewers': 0.0,
            'creator_avg_duration': 0.0,
            'creator_avg_engagement_rate': 0.0,
            'creator_avg_tips_per_stream': 0.0,
            'creator_consistency_score': 0.0,
            'creator_growth_rate': 0.0,
            'creator_days_since_last_stream': 999,
            'creator_streams_last_30_days': 0,
            'creator_best_category': None,
            'creator_account_age_days': 0,
        }

        # Get user
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return features

        # Account age
        if user.created_at:
            features['creator_account_age_days'] = (datetime.utcnow() - user.created_at).days

        # Get all completed streams
        streams = self.db.query(Stream).filter(
            and_(
                Stream.user_id == user_id,
                Stream.status == 'ended'
            )
        ).order_by(Stream.ends_at.desc()).all()

        if not streams:
            return features

        features['creator_total_streams'] = len(streams)

        # Calculate averages from streams
        viewer_counts = [s.peak_viewers or 0 for s in streams]
        durations = []
        for s in streams:
            if s.starts_at and s.ends_at:
                duration = (s.ends_at - s.starts_at).total_seconds()
                if duration > 0:
                    durations.append(duration)

        if viewer_counts:
            features['creator_avg_peak_viewers'] = statistics.mean(viewer_counts)
            features['creator_avg_viewers'] = statistics.mean([s.viewer_count or 0 for s in streams])

        if durations:
            features['creator_avg_duration'] = statistics.mean(durations)

        # Tips per stream
        total_tips = sum(s.tip_count or 0 for s in streams)
        features['creator_avg_tips_per_stream'] = total_tips / len(streams) if streams else 0

        # Days since last stream
        if streams[0].ends_at:
            features['creator_days_since_last_stream'] = (datetime.utcnow() - streams[0].ends_at).days

        # Streams in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_streams = [s for s in streams if s.ends_at and s.ends_at > thirty_days_ago]
        features['creator_streams_last_30_days'] = len(recent_streams)

        # Consistency score (based on variance in streaming frequency)
        if len(streams) >= 3:
            stream_gaps = []
            for i in range(len(streams) - 1):
                if streams[i].ends_at and streams[i+1].ends_at:
                    gap = (streams[i].ends_at - streams[i+1].ends_at).days
                    stream_gaps.append(gap)
            if stream_gaps:
                try:
                    variance = statistics.variance(stream_gaps)
                    # Lower variance = higher consistency (normalize to 0-1)
                    features['creator_consistency_score'] = 1.0 / (1.0 + variance / 100)
                except statistics.StatisticsError:
                    features['creator_consistency_score'] = 0.5

        # Growth rate (compare recent vs older streams)
        if len(streams) >= 6:
            recent_avg = statistics.mean(viewer_counts[:3])
            older_avg = statistics.mean(viewer_counts[-3:])
            if older_avg > 0:
                features['creator_growth_rate'] = (recent_avg - older_avg) / older_avg

        # Best performing category
        category_performance = {}
        for s in streams:
            if s.category:
                if s.category not in category_performance:
                    category_performance[s.category] = []
                category_performance[s.category].append(s.peak_viewers or 0)

        if category_performance:
            best_cat = max(
                category_performance.keys(),
                key=lambda c: statistics.mean(category_performance[c])
            )
            features['creator_best_category'] = best_cat

        # Engagement rate from analytics
        analytics = self.db.query(StreamAnalytics).filter(
            StreamAnalytics.user_id == user_id
        ).all()

        if analytics:
            engagement_rates = []
            for a in analytics:
                if a.viewer_count and a.viewer_count > 0:
                    engagement = (a.chat_messages + a.likes) / a.viewer_count
                    engagement_rates.append(engagement)
            if engagement_rates:
                features['creator_avg_engagement_rate'] = statistics.mean(engagement_rates)

        return features

    def extract_temporal_features(
        self,
        scheduled_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Extract time-based features."""
        target_time = scheduled_time or datetime.utcnow()

        return {
            'temporal_hour_utc': target_time.hour,
            'temporal_day_of_week': target_time.weekday(),  # 0=Monday
            'temporal_is_weekend': target_time.weekday() >= 5,
            'temporal_is_prime_time': 18 <= target_time.hour <= 23,  # 6pm-11pm
            'temporal_is_morning': 6 <= target_time.hour <= 11,
            'temporal_is_afternoon': 12 <= target_time.hour <= 17,
            'temporal_is_night': target_time.hour < 6 or target_time.hour > 23,
            'temporal_month': target_time.month,
            'temporal_is_holiday_season': target_time.month in [11, 12],  # Nov-Dec
        }

    def extract_content_features(
        self,
        stream_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract features from stream content/metadata."""
        features = {
            'content_has_category': False,
            'content_category': None,
            'content_title_length': 0,
            'content_has_tags': False,
            'content_tag_count': 0,
            'content_title_has_emoji': False,
            'content_title_word_count': 0,
        }

        if stream_metadata.get('category'):
            features['content_has_category'] = True
            features['content_category'] = stream_metadata['category']

        title = stream_metadata.get('title', '')
        if title:
            features['content_title_length'] = len(title)
            features['content_title_word_count'] = len(title.split())
            # Simple emoji detection (check for common emoji ranges)
            features['content_title_has_emoji'] = any(
                ord(c) > 127 for c in title
            )

        tags = stream_metadata.get('tags', [])
        if tags:
            features['content_has_tags'] = True
            features['content_tag_count'] = len(tags)

        return features

    async def extract_social_features(self, user_id: int) -> Dict[str, Any]:
        """Extract social/community features for a creator."""
        features = {
            'social_follower_count': 0,
            'social_following_count': 0,
            'social_subscriber_count': 0,
            'social_follower_to_following_ratio': 0.0,
            'social_new_followers_7d': 0,
            'social_active_subscribers': 0,
        }

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return features

        features['social_follower_count'] = user.follower_count or 0
        features['social_following_count'] = user.following_count or 0
        features['social_subscriber_count'] = user.subscriber_count or 0

        if user.following_count and user.following_count > 0:
            features['social_follower_to_following_ratio'] = (
                user.follower_count / user.following_count
            )

        # New followers in last 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        new_followers = self.db.query(func.count(UserFollow.id)).filter(
            and_(
                UserFollow.following_id == user_id,
                UserFollow.created_at >= seven_days_ago
            )
        ).scalar() or 0
        features['social_new_followers_7d'] = new_followers

        # Active subscribers
        active_subs = self.db.query(func.count(Subscription.id)).filter(
            and_(
                Subscription.creator_id == user_id,
                Subscription.status == 'active'
            )
        ).scalar() or 0
        features['social_active_subscribers'] = active_subs

        return features

    async def extract_platform_features(
        self,
        category: Optional[str] = None,
        scheduled_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Extract platform-wide competition features."""
        features = {
            'platform_active_streams': 0,
            'platform_category_streams': 0,
            'platform_competition_level': 'low',
            'platform_category_avg_viewers': 0.0,
        }

        # Count currently active streams
        active_streams = self.db.query(func.count(Stream.id)).filter(
            Stream.status == 'live'
        ).scalar() or 0
        features['platform_active_streams'] = active_streams

        # Category-specific competition
        if category:
            category_streams = self.db.query(Stream).filter(
                and_(
                    Stream.status == 'live',
                    Stream.category == category
                )
            ).all()

            features['platform_category_streams'] = len(category_streams)

            if category_streams:
                avg_viewers = statistics.mean(
                    [s.viewer_count or 0 for s in category_streams]
                )
                features['platform_category_avg_viewers'] = avg_viewers

        # Determine competition level
        if active_streams < 10:
            features['platform_competition_level'] = 'low'
        elif active_streams < 50:
            features['platform_competition_level'] = 'medium'
        else:
            features['platform_competition_level'] = 'high'

        return features

    async def aggregate_creator_history(
        self,
        user_id: int,
        period_type: str = 'weekly'
    ) -> Optional[CreatorPerformanceHistory]:
        """
        Aggregate creator's performance data for a period.
        Used to populate creator_performance_history table.

        Args:
            user_id: Creator's user ID
            period_type: 'daily', 'weekly', or 'monthly'

        Returns:
            CreatorPerformanceHistory object (not yet committed to DB)
        """
        now = datetime.utcnow()

        # Determine period boundaries
        if period_type == 'daily':
            period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            period_end = period_start + timedelta(days=1)
        elif period_type == 'weekly':
            # Start from Monday
            days_since_monday = now.weekday()
            period_start = (now - timedelta(days=days_since_monday)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            period_end = period_start + timedelta(weeks=1)
        else:  # monthly
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Next month
            if now.month == 12:
                period_end = period_start.replace(year=now.year + 1, month=1)
            else:
                period_end = period_start.replace(month=now.month + 1)

        # Get streams in period
        streams = self.db.query(Stream).filter(
            and_(
                Stream.user_id == user_id,
                Stream.status == 'ended',
                Stream.starts_at >= period_start,
                Stream.starts_at < period_end
            )
        ).all()

        if not streams:
            return None

        # Calculate metrics
        stream_ids = [s.id for s in streams]

        # Total duration
        total_duration = 0
        for s in streams:
            if s.starts_at and s.ends_at:
                total_duration += int((s.ends_at - s.starts_at).total_seconds())

        avg_duration = total_duration / len(streams) if streams else None

        # Viewer metrics
        total_viewers = sum(s.viewer_count or 0 for s in streams)
        peak_viewers = max((s.peak_viewers or 0 for s in streams), default=0)
        avg_viewers = total_viewers / len(streams) if streams else None

        # Chat messages
        total_messages = self.db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.stream_id.in_(stream_ids)
        ).scalar() or 0

        # Likes
        total_likes = sum(s.like_count or 0 for s in streams)

        # Tips
        tips = self.db.query(Tip).filter(
            and_(
                Tip.stream_id.in_(stream_ids),
                Tip.status == 'completed'
            )
        ).all()
        total_tips = sum(t.amount for t in tips)
        avg_tip = statistics.mean([t.amount for t in tips]) if tips else None

        # Engagement rate
        engagement_rate = None
        if total_viewers > 0:
            engagement_rate = ((total_messages + total_likes) / total_viewers) * 100

        # Categories streamed
        categories = {}
        for s in streams:
            if s.category:
                categories[s.category] = categories.get(s.category, 0) + 1

        best_category = None
        if categories:
            best_category = max(categories.keys(), key=lambda c: categories[c])

        # Follower changes
        new_followers = self.db.query(func.count(UserFollow.id)).filter(
            and_(
                UserFollow.following_id == user_id,
                UserFollow.created_at >= period_start,
                UserFollow.created_at < period_end
            )
        ).scalar() or 0

        # Subscription changes
        new_subs = self.db.query(func.count(Subscription.id)).filter(
            and_(
                Subscription.creator_id == user_id,
                Subscription.created_at >= period_start,
                Subscription.created_at < period_end
            )
        ).scalar() or 0

        # Create history record
        history = CreatorPerformanceHistory(
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            period_type=period_type,
            streams_count=len(streams),
            total_stream_duration=total_duration,
            avg_stream_duration=avg_duration,
            total_viewers=total_viewers,
            avg_concurrent_viewers=avg_viewers,
            peak_concurrent_viewers=peak_viewers,
            total_chat_messages=total_messages,
            total_likes=total_likes,
            engagement_rate=engagement_rate,
            new_followers=new_followers,
            new_subscribers=new_subs,
            total_tips=total_tips,
            avg_tip_amount=avg_tip,
            categories_streamed=categories if categories else None,
            best_category=best_category,
        )

        return history

    def get_feature_names(self) -> List[str]:
        """Return list of all feature names for model training."""
        return [
            # Creator features
            'creator_total_streams',
            'creator_avg_viewers',
            'creator_avg_peak_viewers',
            'creator_avg_duration',
            'creator_avg_engagement_rate',
            'creator_avg_tips_per_stream',
            'creator_consistency_score',
            'creator_growth_rate',
            'creator_days_since_last_stream',
            'creator_streams_last_30_days',
            'creator_account_age_days',

            # Temporal features
            'temporal_hour_utc',
            'temporal_day_of_week',
            'temporal_is_weekend',
            'temporal_is_prime_time',
            'temporal_is_morning',
            'temporal_is_afternoon',
            'temporal_is_night',
            'temporal_month',
            'temporal_is_holiday_season',

            # Content features
            'content_has_category',
            'content_title_length',
            'content_has_tags',
            'content_tag_count',
            'content_title_has_emoji',
            'content_title_word_count',

            # Social features
            'social_follower_count',
            'social_following_count',
            'social_subscriber_count',
            'social_follower_to_following_ratio',
            'social_new_followers_7d',
            'social_active_subscribers',

            # Platform features
            'platform_active_streams',
            'platform_category_streams',
            'platform_category_avg_viewers',
        ]
