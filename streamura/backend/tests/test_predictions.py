"""
Tests for ML Predictions module (Phase 14).

Tests cover:
- Feature extraction
- Stream success predictions
- Optimal time calculations
- Prediction API endpoints
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.models import (
    User, Stream, StreamAnalytics, MLPrediction,
    CreatorPerformanceHistory, OptimalStreamTime
)


class TestFeatureExtractor:
    """Tests for the FeatureExtractor class."""

    def test_extract_temporal_features_weekday(self, db: Session):
        """Test temporal feature extraction for a weekday."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)

        # Wednesday at 3pm
        test_time = datetime(2025, 1, 8, 15, 0, 0)
        features = extractor.extract_temporal_features(test_time)

        assert features['temporal_hour_utc'] == 15
        assert features['temporal_day_of_week'] == 2  # Wednesday
        assert features['temporal_is_weekend'] is False
        assert features['temporal_is_prime_time'] is False
        assert features['temporal_is_afternoon'] is True
        assert features['temporal_month'] == 1

    def test_extract_temporal_features_weekend_evening(self, db: Session):
        """Test temporal feature extraction for weekend prime time."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)

        # Saturday at 8pm
        test_time = datetime(2025, 1, 11, 20, 0, 0)
        features = extractor.extract_temporal_features(test_time)

        assert features['temporal_is_weekend'] is True
        assert features['temporal_is_prime_time'] is True
        assert features['temporal_day_of_week'] == 5  # Saturday

    def test_extract_content_features(self, db: Session):
        """Test content feature extraction from stream metadata."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)

        metadata = {
            'category': 'Gaming',
            'title': 'Epic Gaming Stream! 🎮',
            'tags': ['gaming', 'chill', 'interactive']
        }

        features = extractor.extract_content_features(metadata)

        assert features['content_has_category'] is True
        assert features['content_category'] == 'Gaming'
        assert features['content_title_length'] > 0
        assert features['content_has_tags'] is True
        assert features['content_tag_count'] == 3
        assert features['content_title_has_emoji'] is True

    def test_extract_content_features_minimal(self, db: Session):
        """Test content features with minimal metadata."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)

        metadata = {}
        features = extractor.extract_content_features(metadata)

        assert features['content_has_category'] is False
        assert features['content_title_length'] == 0
        assert features['content_has_tags'] is False

    @pytest.mark.asyncio
    async def test_extract_creator_features_new_user(self, db: Session, test_user: dict):
        """Test creator features for a user with no streams."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)
        features = await extractor.extract_creator_features(test_user["user"].id)

        # New user with no ended streams should have default values
        assert features['creator_avg_peak_viewers'] == 0.0
        assert features['creator_days_since_last_stream'] == 999

    @pytest.mark.asyncio
    async def test_extract_social_features(self, db: Session, test_user: dict):
        """Test social feature extraction."""
        from backend.ml.features import FeatureExtractor

        user = test_user["user"]
        user.follower_count = 500
        user.following_count = 100
        user.subscriber_count = 25
        db.commit()

        extractor = FeatureExtractor(db)
        features = await extractor.extract_social_features(user.id)

        assert features['social_follower_count'] == 500
        assert features['social_following_count'] == 100
        assert features['social_follower_to_following_ratio'] == 5.0

    def test_get_feature_names(self, db: Session):
        """Test that feature names list is complete."""
        from backend.ml.features import FeatureExtractor

        extractor = FeatureExtractor(db)
        names = extractor.get_feature_names()

        assert 'creator_total_streams' in names
        assert 'temporal_hour_utc' in names
        assert 'content_has_category' in names
        assert 'social_follower_count' in names
        assert 'platform_active_streams' in names


class TestStreamSuccessPredictor:
    """Tests for the StreamSuccessPredictor class."""

    @pytest.mark.asyncio
    async def test_predict_stream_success_new_user(self, db: Session, test_user: dict):
        """Test predictions for a new user with no history."""
        from backend.ml.predictor import StreamSuccessPredictor

        predictor = StreamSuccessPredictor(db)
        predictions = await predictor.predict_stream_success(test_user["user"].id)

        assert 'peak_viewers' in predictions
        assert 'engagement' in predictions
        assert 'duration' in predictions
        assert 'revenue' in predictions

        # Check prediction structure
        peak = predictions['peak_viewers']
        assert peak.prediction_type == 'peak_viewers'
        assert peak.predicted_value >= 1
        assert 0 <= peak.confidence <= 1
        assert peak.range_low <= peak.predicted_value <= peak.range_high

    @pytest.mark.asyncio
    async def test_predict_with_metadata(self, db: Session, test_user: dict):
        """Test predictions with stream metadata."""
        from backend.ml.predictor import StreamSuccessPredictor

        predictor = StreamSuccessPredictor(db)
        metadata = {
            'category': 'Gaming',
            'title': 'Test Stream',
            'scheduled_start': datetime(2025, 1, 11, 20, 0)  # Saturday 8pm
        }

        predictions = await predictor.predict_stream_success(
            test_user["user"].id,
            stream_metadata=metadata
        )

        # Weekend prime time should boost predictions
        assert predictions['peak_viewers'].predicted_value >= 1

    @pytest.mark.asyncio
    async def test_calculate_optimal_times_new_user(self, db: Session, test_user: dict):
        """Test optimal time calculation for user with no history."""
        from backend.ml.predictor import StreamSuccessPredictor

        predictor = StreamSuccessPredictor(db)
        times = await predictor.calculate_optimal_times(test_user["user"].id)

        # Should return defaults for new user
        assert len(times) > 0
        assert all(t.confidence == 0.3 for t in times)  # Low confidence for defaults

    @pytest.mark.asyncio
    async def test_save_prediction(self, db: Session, test_user: dict):
        """Test saving a prediction to the database."""
        from backend.ml.predictor import StreamSuccessPredictor, PredictionResult

        predictor = StreamSuccessPredictor(db)

        result = PredictionResult(
            prediction_type='peak_viewers',
            predicted_value=150.0,
            confidence=0.75,
            range_low=100.0,
            range_high=200.0,
            features_used={'test': True},
            model_version='1.0.0-test'
        )

        saved = await predictor.save_prediction(result, user_id=test_user["user"].id)

        assert saved.id is not None
        assert saved.prediction_type == 'peak_viewers'
        assert saved.predicted_value == 150.0
        assert saved.confidence == 0.75

    @pytest.mark.asyncio
    async def test_evaluate_prediction(self, db: Session, test_user: dict):
        """Test evaluating a prediction with actual value."""
        from backend.ml.predictor import StreamSuccessPredictor, PredictionResult

        predictor = StreamSuccessPredictor(db)

        # Save a prediction first
        result = PredictionResult(
            prediction_type='peak_viewers',
            predicted_value=100.0,
            confidence=0.7,
            range_low=75.0,
            range_high=125.0,
            features_used={},
            model_version='1.0.0-test'
        )
        saved = await predictor.save_prediction(result, user_id=test_user["user"].id)

        # Evaluate with actual value
        evaluated = await predictor.evaluate_prediction(saved.id, actual_value=110.0)

        assert evaluated.actual_value == 110.0
        assert evaluated.error == 10.0  # 110 - 100
        assert evaluated.evaluated_at is not None

    @pytest.mark.asyncio
    async def test_get_model_accuracy_no_data(self, db: Session):
        """Test model accuracy with no predictions."""
        from backend.ml.predictor import StreamSuccessPredictor

        predictor = StreamSuccessPredictor(db)
        accuracy = await predictor.get_model_accuracy('peak_viewers', days=30)

        assert accuracy['sample_size'] == 0
        assert accuracy['mae'] is None


class TestPredictionAPI:
    """Tests for the prediction API endpoints."""

    def test_predict_stream_success_endpoint(self, client, test_user: dict):
        """Test POST /analytics/predictions endpoint."""
        response = client.post(
            '/api/v1/analytics/predictions',
            json={'category': 'Gaming'},
            headers=test_user["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert 'peak_viewers' in data
        assert 'engagement' in data
        assert 'duration' in data
        assert 'revenue' in data
        assert 'generated_at' in data

    def test_predict_stream_success_unauthenticated(self, client):
        """Test prediction endpoint requires authentication."""
        response = client.post(
            '/api/v1/analytics/predictions',
            json={'category': 'Gaming'}
        )

        assert response.status_code == 401

    def test_get_optimal_times_endpoint(self, client, test_user: dict):
        """Test GET /analytics/optimal-time endpoint."""
        response = client.get(
            '/api/v1/analytics/optimal-time',
            headers=test_user["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert 'day_of_week' in data[0]
            assert 'day_name' in data[0]
            assert 'hour_utc' in data[0]
            assert 'score' in data[0]

    def test_get_optimal_times_with_category(self, client, test_user: dict):
        """Test optimal times filtering by category."""
        response = client.get(
            '/api/v1/analytics/optimal-time',
            params={'category': 'Gaming', 'limit': 5},
            headers=test_user["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    def test_get_creator_history_endpoint(self, client, test_user: dict):
        """Test GET /analytics/creator-history endpoint."""
        response = client.get(
            '/api/v1/analytics/creator-history',
            params={'period_type': 'weekly', 'limit': 4},
            headers=test_user["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert 'user_id' in data
        assert 'period_type' in data
        assert data['period_type'] == 'weekly'
        assert 'history' in data

    def test_get_creator_history_invalid_period(self, client, test_user: dict):
        """Test creator history with invalid period type."""
        response = client.get(
            '/api/v1/analytics/creator-history',
            params={'period_type': 'invalid'},
            headers=test_user["headers"]
        )

        assert response.status_code == 400

    def test_model_accuracy_requires_admin(self, client, test_user: dict):
        """Test model accuracy endpoint requires admin."""
        response = client.get(
            '/api/v1/analytics/model-accuracy',
            headers=test_user["headers"]
        )

        # Regular user should get 403
        assert response.status_code == 403

    def test_model_accuracy_admin_access(self, client, test_admin: dict):
        """Test model accuracy endpoint with admin access."""
        response = client.get(
            '/api/v1/analytics/model-accuracy',
            headers=test_admin["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_stream_predictions(self, client, test_user: dict, test_stream: Stream):
        """Test GET /analytics/predictions/{stream_id}."""
        response = client.get(
            f'/api/v1/analytics/predictions/{test_stream.id}',
            headers=test_user["headers"]
        )

        assert response.status_code == 200
        data = response.json()
        assert data['stream_id'] == test_stream.id
        assert 'predictions' in data

    def test_get_stream_predictions_unauthorized(self, client, second_user: dict, test_stream: Stream):
        """Test that users can't see other users' stream predictions."""
        response = client.get(
            f'/api/v1/analytics/predictions/{test_stream.id}',
            headers=second_user["headers"]
        )

        assert response.status_code == 403
