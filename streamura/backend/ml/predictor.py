"""
Stream Success Predictor module.

Provides ML-based predictions for stream performance metrics including:
- Peak viewer count
- Engagement rate
- Optimal streaming time
- Expected revenue
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import statistics
import math

from models import (
    User, Stream, MLPrediction, CreatorPerformanceHistory,
    OptimalStreamTime, StreamAnalytics
)
from .features import FeatureExtractor


MODEL_VERSION = "1.0.0-heuristic"


@dataclass
class PredictionResult:
    """Container for a single prediction result."""
    prediction_type: str
    predicted_value: float
    confidence: float
    range_low: float
    range_high: float
    features_used: Dict[str, Any]
    model_version: str = MODEL_VERSION


class StreamSuccessPredictor:
    """
    Predicts stream success metrics using historical data and heuristics.

    This is a heuristic-based predictor that can later be replaced with
    a trained ML model (e.g., LightGBM) when sufficient training data exists.
    """

    def __init__(self, db: Session):
        self.db = db
        self.feature_extractor = FeatureExtractor(db)

    async def predict_stream_success(
        self,
        user_id: int,
        stream_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, PredictionResult]:
        """
        Generate all predictions for a planned/starting stream.

        Args:
            user_id: Creator's user ID
            stream_metadata: Optional dict with:
                - category: Stream category
                - scheduled_start: Planned start time
                - title: Stream title
                - tags: List of tags

        Returns:
            Dict with prediction types as keys and PredictionResult as values
        """
        # Extract features
        features = await self.feature_extractor.extract_all_features(
            user_id, stream_metadata
        )

        results = {}

        # Predict peak viewers
        results['peak_viewers'] = self._predict_peak_viewers(features)

        # Predict engagement rate
        results['engagement'] = self._predict_engagement(features)

        # Predict stream duration
        results['duration'] = self._predict_duration(features)

        # Predict revenue (tips)
        results['revenue'] = self._predict_revenue(features)

        return results

    def _predict_peak_viewers(self, features: Dict[str, Any]) -> PredictionResult:
        """Predict peak viewer count for a stream."""
        base_value = 10  # Default for new streamers

        # Creator history weight
        if features.get('creator_avg_peak_viewers', 0) > 0:
            base_value = features['creator_avg_peak_viewers']

        # Apply modifiers
        multiplier = 1.0

        # Time-based modifiers
        if features.get('temporal_is_prime_time'):
            multiplier *= 1.3
        elif features.get('temporal_is_night'):
            multiplier *= 0.6

        if features.get('temporal_is_weekend'):
            multiplier *= 1.15

        # Growth trend
        growth_rate = features.get('creator_growth_rate', 0)
        if growth_rate > 0:
            multiplier *= 1 + min(growth_rate, 0.5)  # Cap at 50% boost
        elif growth_rate < 0:
            multiplier *= 1 + max(growth_rate, -0.3)  # Cap at 30% reduction

        # Consistency bonus
        consistency = features.get('creator_consistency_score', 0.5)
        multiplier *= 0.9 + (consistency * 0.2)  # 0.9 to 1.1

        # Recency penalty
        days_since_last = features.get('creator_days_since_last_stream', 0)
        if days_since_last > 30:
            multiplier *= 0.7
        elif days_since_last > 14:
            multiplier *= 0.85

        # Follower influence
        follower_count = features.get('social_follower_count', 0)
        if follower_count > 1000:
            multiplier *= 1 + min(math.log10(follower_count / 1000) * 0.1, 0.3)

        # Competition modifier
        competition = features.get('platform_competition_level', 'medium')
        if competition == 'low':
            multiplier *= 1.1
        elif competition == 'high':
            multiplier *= 0.9

        predicted = max(1, round(base_value * multiplier))

        # Calculate confidence
        confidence = self._calculate_confidence(features, 'peak_viewers')

        # Calculate range
        variance = 0.3 if confidence > 0.7 else 0.5
        range_low = max(1, round(predicted * (1 - variance)))
        range_high = round(predicted * (1 + variance))

        return PredictionResult(
            prediction_type='peak_viewers',
            predicted_value=predicted,
            confidence=confidence,
            range_low=range_low,
            range_high=range_high,
            features_used=features,
            model_version=MODEL_VERSION
        )

    def _predict_engagement(self, features: Dict[str, Any]) -> PredictionResult:
        """Predict engagement rate (interactions per viewer) for a stream."""
        # Base engagement rate (historical or default)
        base_rate = features.get('creator_avg_engagement_rate', 5.0)
        if base_rate == 0:
            base_rate = 5.0  # Default 5%

        multiplier = 1.0

        # Smaller audiences tend to have higher engagement
        avg_viewers = features.get('creator_avg_viewers', 50)
        if avg_viewers < 20:
            multiplier *= 1.3
        elif avg_viewers > 500:
            multiplier *= 0.8

        # Prime time typically has better engagement
        if features.get('temporal_is_prime_time'):
            multiplier *= 1.1

        # Weekends have better engagement
        if features.get('temporal_is_weekend'):
            multiplier *= 1.1

        # Category affects engagement (gaming typically higher)
        category = features.get('content_category', '')
        high_engagement_categories = ['Gaming', 'Just Chatting', 'Music']
        if category in high_engagement_categories:
            multiplier *= 1.15

        # Subscriber ratio boost
        subscriber_count = features.get('social_active_subscribers', 0)
        follower_count = features.get('social_follower_count', 1)
        sub_ratio = subscriber_count / max(follower_count, 1)
        if sub_ratio > 0.05:  # More than 5% subscribers
            multiplier *= 1 + min(sub_ratio, 0.2)

        predicted = round(base_rate * multiplier, 2)

        confidence = self._calculate_confidence(features, 'engagement')

        variance = 0.25 if confidence > 0.7 else 0.4
        range_low = max(0.1, round(predicted * (1 - variance), 2))
        range_high = round(predicted * (1 + variance), 2)

        return PredictionResult(
            prediction_type='engagement',
            predicted_value=predicted,
            confidence=confidence,
            range_low=range_low,
            range_high=range_high,
            features_used=features,
            model_version=MODEL_VERSION
        )

    def _predict_duration(self, features: Dict[str, Any]) -> PredictionResult:
        """Predict stream duration in seconds."""
        # Base duration from history or default (1 hour)
        base_duration = features.get('creator_avg_duration', 3600)
        if base_duration == 0:
            base_duration = 3600

        multiplier = 1.0

        # Weekend streams tend to be longer
        if features.get('temporal_is_weekend'):
            multiplier *= 1.2

        # Prime time streams might be longer
        if features.get('temporal_is_prime_time'):
            multiplier *= 1.1

        # Consistency indicates streaming habits
        consistency = features.get('creator_consistency_score', 0.5)
        if consistency > 0.7:
            # Consistent streamers stick to their patterns
            multiplier = 1.0  # Don't modify much

        predicted = round(base_duration * multiplier)

        confidence = self._calculate_confidence(features, 'duration')

        variance = 0.3 if confidence > 0.7 else 0.5
        range_low = max(300, round(predicted * (1 - variance)))  # Min 5 minutes
        range_high = round(predicted * (1 + variance))

        return PredictionResult(
            prediction_type='duration',
            predicted_value=predicted,
            confidence=confidence,
            range_low=range_low,
            range_high=range_high,
            features_used=features,
            model_version=MODEL_VERSION
        )

    def _predict_revenue(self, features: Dict[str, Any]) -> PredictionResult:
        """Predict expected tip revenue for a stream."""
        # Base on historical tips per stream
        base_tips = features.get('creator_avg_tips_per_stream', 0)

        # If no tip history, estimate from viewer count
        if base_tips == 0:
            avg_viewers = features.get('creator_avg_peak_viewers', 10)
            # Rough estimate: 1-2% of viewers tip, average tip $3-5
            base_tips = avg_viewers * 0.015 * 4  # ~6% of viewer count as tip amount

        multiplier = 1.0

        # Peak viewers influence
        peak_prediction = self._predict_peak_viewers(features)
        historical_peak = features.get('creator_avg_peak_viewers', 10)
        if historical_peak > 0:
            viewer_ratio = peak_prediction.predicted_value / historical_peak
            multiplier *= math.sqrt(viewer_ratio)  # Diminishing returns

        # Engagement correlation
        engagement = features.get('creator_avg_engagement_rate', 5)
        if engagement > 10:
            multiplier *= 1.2
        elif engagement < 3:
            multiplier *= 0.8

        # Subscriber influence (subscribers more likely to tip)
        sub_count = features.get('social_active_subscribers', 0)
        if sub_count > 0:
            multiplier *= 1 + min(sub_count * 0.01, 0.3)  # Up to 30% boost

        predicted = round(base_tips * multiplier, 2)

        confidence = self._calculate_confidence(features, 'revenue')

        # Revenue has high variance
        variance = 0.5 if confidence > 0.6 else 0.7
        range_low = max(0, round(predicted * (1 - variance), 2))
        range_high = round(predicted * (1 + variance), 2)

        return PredictionResult(
            prediction_type='revenue',
            predicted_value=predicted,
            confidence=confidence,
            range_low=range_low,
            range_high=range_high,
            features_used=features,
            model_version=MODEL_VERSION
        )

    def _calculate_confidence(
        self,
        features: Dict[str, Any],
        prediction_type: str
    ) -> float:
        """Calculate confidence score based on available data."""
        confidence = 0.3  # Base confidence

        # More historical streams = more confidence
        stream_count = features.get('creator_total_streams', 0)
        if stream_count >= 50:
            confidence += 0.3
        elif stream_count >= 20:
            confidence += 0.2
        elif stream_count >= 5:
            confidence += 0.1

        # Recent activity increases confidence
        days_since = features.get('creator_days_since_last_stream', 999)
        if days_since < 7:
            confidence += 0.15
        elif days_since < 30:
            confidence += 0.1

        # Consistency helps predictions
        consistency = features.get('creator_consistency_score', 0)
        confidence += consistency * 0.15

        # Account age adds stability
        account_age = features.get('creator_account_age_days', 0)
        if account_age > 365:
            confidence += 0.1
        elif account_age > 90:
            confidence += 0.05

        return min(0.95, confidence)  # Cap at 95%

    async def calculate_optimal_times(
        self,
        user_id: int,
        category: Optional[str] = None
    ) -> List[OptimalStreamTime]:
        """
        Calculate optimal streaming times for a creator.

        Analyzes historical performance by day/hour to find best times.

        Args:
            user_id: Creator's user ID
            category: Optional category to filter by

        Returns:
            List of OptimalStreamTime objects (not committed to DB)
        """
        # Get historical streams
        query = self.db.query(Stream).filter(
            and_(
                Stream.user_id == user_id,
                Stream.status == 'ended',
                Stream.starts_at.isnot(None)
            )
        )

        if category:
            query = query.filter(Stream.category == category)

        streams = query.all()

        if not streams:
            # Return default recommendations for new streamers
            return self._get_default_optimal_times(user_id, category)

        # Group streams by day/hour
        time_slots: Dict[Tuple[int, int], List[Stream]] = {}
        for stream in streams:
            day = stream.starts_at.weekday()
            hour = stream.starts_at.hour
            key = (day, hour)
            if key not in time_slots:
                time_slots[key] = []
            time_slots[key].append(stream)

        # Calculate scores for each time slot
        optimal_times = []
        for (day, hour), slot_streams in time_slots.items():
            # Score based on peak viewers
            avg_peak = statistics.mean(
                [s.peak_viewers or 0 for s in slot_streams]
            )

            # Normalize score (0-1 range)
            max_peak = max(
                (s.peak_viewers or 0 for s in streams),
                default=1
            )
            score = avg_peak / max(max_peak, 1)

            # Calculate expected viewers
            expected_viewers = round(avg_peak)

            # Estimate competition (simplified)
            competition = 'medium'
            if hour >= 18 and hour <= 22:
                competition = 'high'
            elif hour >= 1 and hour <= 8:
                competition = 'low'

            # Confidence based on sample size
            confidence = min(0.9, 0.3 + (len(slot_streams) * 0.1))

            optimal_time = OptimalStreamTime(
                user_id=user_id,
                category=category,
                day_of_week=day,
                hour_utc=hour,
                score=round(score, 3),
                expected_viewers=expected_viewers,
                competition_level=competition,
                confidence=round(confidence, 2),
                last_calculated=datetime.utcnow()
            )
            optimal_times.append(optimal_time)

        # Sort by score descending
        optimal_times.sort(key=lambda x: x.score, reverse=True)

        return optimal_times

    def _get_default_optimal_times(
        self,
        user_id: int,
        category: Optional[str] = None
    ) -> List[OptimalStreamTime]:
        """Return default optimal times for new streamers."""
        # Best times are typically evening hours on weekends
        defaults = [
            (5, 20, 0.9),   # Saturday 8pm
            (6, 20, 0.85),  # Sunday 8pm
            (5, 19, 0.8),   # Saturday 7pm
            (4, 20, 0.75),  # Friday 8pm
            (6, 19, 0.7),   # Sunday 7pm
            (4, 19, 0.65),  # Friday 7pm
            (2, 20, 0.6),   # Wednesday 8pm
            (3, 20, 0.55),  # Thursday 8pm
        ]

        return [
            OptimalStreamTime(
                user_id=user_id,
                category=category,
                day_of_week=day,
                hour_utc=hour,
                score=score,
                expected_viewers=None,
                competition_level='medium',
                confidence=0.3,  # Low confidence for defaults
                last_calculated=datetime.utcnow()
            )
            for day, hour, score in defaults
        ]

    async def save_prediction(
        self,
        prediction: PredictionResult,
        stream_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> MLPrediction:
        """
        Save a prediction to the database.

        Args:
            prediction: PredictionResult to save
            stream_id: Associated stream ID (optional)
            user_id: Associated user ID (optional)

        Returns:
            Created MLPrediction object
        """
        db_prediction = MLPrediction(
            stream_id=stream_id,
            user_id=user_id,
            prediction_type=prediction.prediction_type,
            predicted_value=prediction.predicted_value,
            predicted_range_low=prediction.range_low,
            predicted_range_high=prediction.range_high,
            confidence=prediction.confidence,
            features_used=prediction.features_used,
            model_version=prediction.model_version,
            created_at=datetime.utcnow()
        )

        self.db.add(db_prediction)
        self.db.commit()
        self.db.refresh(db_prediction)

        return db_prediction

    async def evaluate_prediction(
        self,
        prediction_id: int,
        actual_value: float
    ) -> MLPrediction:
        """
        Evaluate a prediction against actual outcome.

        Args:
            prediction_id: ID of the prediction to evaluate
            actual_value: The actual observed value

        Returns:
            Updated MLPrediction object
        """
        prediction = self.db.query(MLPrediction).filter(
            MLPrediction.id == prediction_id
        ).first()

        if not prediction:
            raise ValueError(f"Prediction {prediction_id} not found")

        prediction.actual_value = actual_value
        prediction.error = actual_value - prediction.predicted_value
        prediction.evaluated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(prediction)

        return prediction

    async def get_model_accuracy(
        self,
        prediction_type: str,
        days: int = 30
    ) -> Dict[str, float]:
        """
        Calculate model accuracy metrics for a prediction type.

        Args:
            prediction_type: Type of prediction to analyze
            days: Number of days to look back

        Returns:
            Dict with accuracy metrics (MAE, MAPE, within_range_pct)
        """
        since = datetime.utcnow() - timedelta(days=days)

        predictions = self.db.query(MLPrediction).filter(
            and_(
                MLPrediction.prediction_type == prediction_type,
                MLPrediction.actual_value.isnot(None),
                MLPrediction.created_at >= since
            )
        ).all()

        if not predictions:
            return {
                'mae': None,
                'mape': None,
                'within_range_pct': None,
                'sample_size': 0
            }

        # Calculate Mean Absolute Error
        errors = [abs(p.error or 0) for p in predictions]
        mae = statistics.mean(errors)

        # Calculate Mean Absolute Percentage Error
        percentage_errors = []
        for p in predictions:
            if p.actual_value and p.actual_value != 0:
                pct_error = abs(p.error or 0) / p.actual_value * 100
                percentage_errors.append(pct_error)

        mape = statistics.mean(percentage_errors) if percentage_errors else None

        # Calculate % of predictions within confidence range
        within_range = sum(
            1 for p in predictions
            if p.predicted_range_low <= (p.actual_value or 0) <= p.predicted_range_high
        )
        within_range_pct = (within_range / len(predictions)) * 100

        return {
            'mae': round(mae, 2),
            'mape': round(mape, 2) if mape else None,
            'within_range_pct': round(within_range_pct, 1),
            'sample_size': len(predictions)
        }
