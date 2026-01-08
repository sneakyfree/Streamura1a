"""Add ML predictions tables for stream success prediction

Revision ID: 010_predictions
Revises: 009_subscriptions
Create Date: 2025-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_predictions'
down_revision: Union[str, None] = '009_subscriptions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ML Predictions table - stores predictions and their actual outcomes
    op.create_table('ml_predictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('prediction_type', sa.String(50), nullable=False),  # peak_viewers, engagement, revenue, duration
        sa.Column('predicted_value', sa.Float(), nullable=False),
        sa.Column('predicted_range_low', sa.Float(), nullable=True),  # Confidence interval low
        sa.Column('predicted_range_high', sa.Float(), nullable=True),  # Confidence interval high
        sa.Column('confidence', sa.Float(), nullable=True),  # 0.0-1.0 confidence score
        sa.Column('actual_value', sa.Float(), nullable=True),  # Filled in after stream ends
        sa.Column('error', sa.Float(), nullable=True),  # Actual - Predicted (for model feedback)
        sa.Column('features_used', sa.JSON(), nullable=True),  # Feature snapshot for debugging
        sa.Column('model_version', sa.String(50), nullable=True),  # Version of model used
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),  # When actual was filled in
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ml_predictions_id', 'ml_predictions', ['id'])
    op.create_index('ix_ml_predictions_prediction_type', 'ml_predictions', ['prediction_type'])
    op.create_index('ix_ml_predictions_created_at', 'ml_predictions', ['created_at'])

    # Creator performance history - aggregated stats for prediction features
    op.create_table('creator_performance_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('period_type', sa.String(20), nullable=False),  # daily, weekly, monthly

        # Streaming metrics
        sa.Column('streams_count', sa.Integer(), default=0),
        sa.Column('total_stream_duration', sa.Integer(), default=0),  # seconds
        sa.Column('avg_stream_duration', sa.Float(), nullable=True),

        # Viewer metrics
        sa.Column('total_viewers', sa.Integer(), default=0),
        sa.Column('unique_viewers', sa.Integer(), default=0),
        sa.Column('avg_concurrent_viewers', sa.Float(), nullable=True),
        sa.Column('peak_concurrent_viewers', sa.Integer(), default=0),

        # Engagement metrics
        sa.Column('total_chat_messages', sa.Integer(), default=0),
        sa.Column('total_likes', sa.Integer(), default=0),
        sa.Column('total_shares', sa.Integer(), default=0),
        sa.Column('engagement_rate', sa.Float(), nullable=True),  # (interactions / views) * 100

        # Growth metrics
        sa.Column('new_followers', sa.Integer(), default=0),
        sa.Column('lost_followers', sa.Integer(), default=0),
        sa.Column('new_subscribers', sa.Integer(), default=0),
        sa.Column('churned_subscribers', sa.Integer(), default=0),

        # Revenue metrics
        sa.Column('total_tips', sa.Float(), default=0.0),
        sa.Column('total_subscription_revenue', sa.Float(), default=0.0),
        sa.Column('total_ad_revenue', sa.Float(), default=0.0),
        sa.Column('avg_tip_amount', sa.Float(), nullable=True),

        # Category performance
        sa.Column('categories_streamed', sa.JSON(), nullable=True),  # {"Gaming": 5, "IRL": 3}
        sa.Column('best_category', sa.String(50), nullable=True),
        sa.Column('best_time_slots', sa.JSON(), nullable=True),  # {"14:00": 0.8, "20:00": 0.9}

        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_creator_performance_history_user_id', 'creator_performance_history', ['user_id'])
    op.create_index('ix_creator_performance_history_period', 'creator_performance_history', ['period_start', 'period_end'])
    op.create_index('ix_creator_performance_history_period_type', 'creator_performance_history', ['period_type'])

    # Optimal streaming times - ML-derived recommendations
    op.create_table('optimal_stream_times',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('category', sa.String(50), nullable=True),  # null = overall recommendation
        sa.Column('day_of_week', sa.Integer(), nullable=False),  # 0=Monday, 6=Sunday
        sa.Column('hour_utc', sa.Integer(), nullable=False),  # 0-23
        sa.Column('score', sa.Float(), nullable=False),  # Predicted success score
        sa.Column('expected_viewers', sa.Integer(), nullable=True),
        sa.Column('competition_level', sa.String(20), nullable=True),  # low, medium, high
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('last_calculated', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_optimal_stream_times_user_id', 'optimal_stream_times', ['user_id'])
    op.create_index('ix_optimal_stream_times_day_hour', 'optimal_stream_times', ['day_of_week', 'hour_utc'])

    # Add prediction fields to streams table
    op.add_column('streams', sa.Column('predicted_peak_viewers', sa.Integer(), nullable=True))
    op.add_column('streams', sa.Column('predicted_engagement', sa.Float(), nullable=True))
    op.add_column('streams', sa.Column('predicted_duration', sa.Integer(), nullable=True))  # seconds
    op.add_column('streams', sa.Column('prediction_confidence', sa.Float(), nullable=True))

    # Add preferred streaming time to users
    op.add_column('users', sa.Column('preferred_language', sa.String(10), server_default='en'))


def downgrade() -> None:
    # Remove columns from users
    op.drop_column('users', 'preferred_language')

    # Remove columns from streams
    op.drop_column('streams', 'prediction_confidence')
    op.drop_column('streams', 'predicted_duration')
    op.drop_column('streams', 'predicted_engagement')
    op.drop_column('streams', 'predicted_peak_viewers')

    # Drop tables
    op.drop_table('optimal_stream_times')
    op.drop_table('creator_performance_history')
    op.drop_table('ml_predictions')
