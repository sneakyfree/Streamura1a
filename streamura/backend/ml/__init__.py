"""
ML module for Streamura predictive analytics.

This module contains components for:
- Feature extraction from stream and user data
- Stream success prediction (viewers, engagement, revenue)
- Optimal streaming time recommendations
"""

from .features import FeatureExtractor
from .predictor import StreamSuccessPredictor

__all__ = ['FeatureExtractor', 'StreamSuccessPredictor']
