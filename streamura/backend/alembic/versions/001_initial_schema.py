"""Initial schema with all models

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-01-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone_number', sa.String(20), nullable=True),
        sa.Column('hashed_password', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        # Stripe
        sa.Column('stripe_customer_id', sa.String(255), nullable=True),
        sa.Column('stripe_account_id', sa.String(255), nullable=True),
        sa.Column('stripe_onboarding_complete', sa.Boolean(), default=False),
        sa.Column('payout_enabled', sa.Boolean(), default=False),
        # Monetization
        sa.Column('balance', sa.Float(), default=0.0),
        sa.Column('lifetime_earnings', sa.Float(), default=0.0),
        sa.Column('pending_payout', sa.Float(), default=0.0),
        # Profile
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('avatar_url', sa.String(512), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        # Social
        sa.Column('follower_count', sa.Integer(), default=0),
        sa.Column('following_count', sa.Integer(), default=0),
        # Admin & Moderation
        sa.Column('is_admin', sa.Boolean(), default=False),
        sa.Column('warning_count', sa.Integer(), default=0),
        sa.Column('trust_score', sa.Float(), default=1.0),
        sa.Column('is_banned', sa.Boolean(), default=False),
        sa.Column('ban_reason', sa.Text(), nullable=True),
        sa.Column('ban_expires', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_phone_number', 'users', ['phone_number'], unique=True)

    # Events table
    op.create_table('events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), default='active'),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('latitude', sa.Float()),
        sa.Column('longitude', sa.Float()),
        sa.Column('location_name', sa.String(255)),
        sa.Column('radius', sa.Float(), default=100.0),
        sa.Column('total_viewers', sa.Integer(), default=0),
        sa.Column('total_streams', sa.Integer(), default=0),
        sa.Column('total_earnings', sa.Float(), default=0.0),
        sa.Column('ranking_score', sa.Float(), default=0.0),
        sa.Column('starts_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('ends_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.Column('thumbnail_url', sa.String(512), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('is_featured', sa.Boolean(), default=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_events_id', 'events', ['id'])

    # Streams table
    op.create_table('streams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_key', sa.String(255), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id'), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), default='created'),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('is_monetized', sa.Boolean(), default=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('location_name', sa.String(255), nullable=True),
        sa.Column('viewer_count', sa.Integer(), default=0),
        sa.Column('peak_viewers', sa.Integer(), default=0),
        sa.Column('total_watch_time', sa.Integer(), default=0),
        sa.Column('earnings', sa.Float(), default=0.0),
        sa.Column('tip_count', sa.Integer(), default=0),
        sa.Column('like_count', sa.Integer(), default=0),
        sa.Column('starts_at', sa.DateTime(), nullable=True),
        sa.Column('ends_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.Column('thumbnail_url', sa.String(512), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('livekit_room_name', sa.String(255), nullable=True),
        sa.Column('livekit_room_id', sa.String(255), nullable=True),
        sa.Column('hls_url', sa.String(512), nullable=True),
        sa.Column('rtmp_url', sa.String(512), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_streams_id', 'streams', ['id'])
    op.create_index('ix_streams_stream_key', 'streams', ['stream_key'], unique=True)
    op.create_index('ix_streams_livekit_room_name', 'streams', ['livekit_room_name'], unique=True)

    # Transactions table
    op.create_table('transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id'), nullable=True),
        sa.Column('amount', sa.Float()),
        sa.Column('fee', sa.Float(), default=0.0),
        sa.Column('net_amount', sa.Float(), nullable=True),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('transaction_type', sa.String(30)),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('stripe_transaction_id', sa.String(255), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('stripe_transfer_id', sa.String(255), nullable=True),
        sa.Column('stripe_payout_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transactions_id', 'transactions', ['id'])

    # Ad Impressions table
    op.create_table('ad_impressions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id')),
        sa.Column('ad_network', sa.String(50)),
        sa.Column('ad_unit', sa.String(255)),
        sa.Column('impression_count', sa.Integer(), default=0),
        sa.Column('click_count', sa.Integer(), default=0),
        sa.Column('revenue', sa.Float(), default=0.0),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ad_impressions_id', 'ad_impressions', ['id'])

    # Notifications table
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id'), nullable=True),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('from_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('notification_type', sa.String(50)),
        sa.Column('title', sa.String(255)),
        sa.Column('message', sa.Text()),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('is_pushed', sa.Boolean(), default=False),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_id', 'notifications', ['id'])

    # Chat Messages table
    op.create_table('chat_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('delete_reason', sa.String(255), nullable=True),
        sa.Column('is_highlighted', sa.Boolean(), default=False),
        sa.Column('tip_amount', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_messages_id', 'chat_messages', ['id'])
    op.create_index('ix_chat_messages_stream_id', 'chat_messages', ['stream_id'])
    op.create_index('ix_chat_messages_created_at', 'chat_messages', ['created_at'])

    # User Follows table
    op.create_table('user_follows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('follower_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('following_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_follows_id', 'user_follows', ['id'])
    op.create_index('ix_user_follows_follower_id', 'user_follows', ['follower_id'])
    op.create_index('ix_user_follows_following_id', 'user_follows', ['following_id'])

    # Stream Likes table
    op.create_table('stream_likes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stream_likes_id', 'stream_likes', ['id'])
    op.create_index('ix_stream_likes_user_id', 'stream_likes', ['user_id'])
    op.create_index('ix_stream_likes_stream_id', 'stream_likes', ['stream_id'])

    # Tips table
    op.create_table('tips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('to_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('transactions.id'), nullable=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('message', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('is_highlighted', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tips_id', 'tips', ['id'])

    # Reports table
    op.create_table('reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reported_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reported_stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('reported_message_id', sa.Integer(), sa.ForeignKey('chat_messages.id'), nullable=True),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('priority', sa.String(20), default='normal'),
        sa.Column('resolved_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('action_taken', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_reports_id', 'reports', ['id'])
    op.create_index('ix_reports_reporter_id', 'reports', ['reporter_id'])
    op.create_index('ix_reports_created_at', 'reports', ['created_at'])

    # Moderation Actions table
    op.create_table('moderation_actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('moderator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('target_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('target_stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('target_message_id', sa.Integer(), sa.ForeignKey('chat_messages.id'), nullable=True),
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('reports.id'), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_moderation_actions_id', 'moderation_actions', ['id'])
    op.create_index('ix_moderation_actions_moderator_id', 'moderation_actions', ['moderator_id'])
    op.create_index('ix_moderation_actions_created_at', 'moderation_actions', ['created_at'])

    # Recordings table
    op.create_table('recordings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('egress_id', sa.String(255), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('url', sa.String(1024), nullable=True),
        sa.Column('storage_path', sa.String(1024), nullable=True),
        sa.Column('thumbnail_url', sa.String(1024), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('format', sa.String(20), default='mp4'),
        sa.Column('resolution', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('view_count', sa.Integer(), default=0),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_recordings_id', 'recordings', ['id'])
    op.create_index('ix_recordings_stream_id', 'recordings', ['stream_id'])
    op.create_index('ix_recordings_user_id', 'recordings', ['user_id'])
    op.create_unique_constraint('uq_recordings_egress_id', 'recordings', ['egress_id'])

    # Scheduled Streams table
    op.create_table('scheduled_streams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('thumbnail_url', sa.String(512), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('scheduled_start', sa.DateTime(), nullable=False),
        sa.Column('scheduled_end', sa.DateTime(), nullable=True),
        sa.Column('timezone', sa.String(50), default='UTC'),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('location_name', sa.String(255), nullable=True),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('is_monetized', sa.Boolean(), default=False),
        sa.Column('notify_followers', sa.Boolean(), default=True),
        sa.Column('status', sa.String(20), default='scheduled'),
        sa.Column('reminder_sent', sa.Boolean(), default=False),
        sa.Column('reminder_sent_at', sa.DateTime(), nullable=True),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_scheduled_streams_id', 'scheduled_streams', ['id'])
    op.create_index('ix_scheduled_streams_user_id', 'scheduled_streams', ['user_id'])
    op.create_index('ix_scheduled_streams_scheduled_start', 'scheduled_streams', ['scheduled_start'])

    # Stream Analytics table
    op.create_table('stream_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('viewer_count', sa.Integer(), default=0),
        sa.Column('unique_viewers', sa.Integer(), default=0),
        sa.Column('peak_viewers', sa.Integer(), default=0),
        sa.Column('average_watch_time', sa.Integer(), default=0),
        sa.Column('chat_messages', sa.Integer(), default=0),
        sa.Column('likes', sa.Integer(), default=0),
        sa.Column('shares', sa.Integer(), default=0),
        sa.Column('new_followers', sa.Integer(), default=0),
        sa.Column('tips_count', sa.Integer(), default=0),
        sa.Column('tips_amount', sa.Float(), default=0.0),
        sa.Column('ad_revenue', sa.Float(), default=0.0),
        sa.Column('avg_bitrate', sa.Integer(), nullable=True),
        sa.Column('avg_latency', sa.Integer(), nullable=True),
        sa.Column('buffer_ratio', sa.Float(), nullable=True),
        sa.Column('viewer_locations', sa.JSON(), nullable=True),
        sa.Column('device_breakdown', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stream_analytics_id', 'stream_analytics', ['id'])
    op.create_index('ix_stream_analytics_stream_id', 'stream_analytics', ['stream_id'])
    op.create_index('ix_stream_analytics_timestamp', 'stream_analytics', ['timestamp'])


def downgrade() -> None:
    op.drop_table('stream_analytics')
    op.drop_table('scheduled_streams')
    op.drop_table('recordings')
    op.drop_table('moderation_actions')
    op.drop_table('reports')
    op.drop_table('tips')
    op.drop_table('stream_likes')
    op.drop_table('user_follows')
    op.drop_table('chat_messages')
    op.drop_table('notifications')
    op.drop_table('ad_impressions')
    op.drop_table('transactions')
    op.drop_table('streams')
    op.drop_table('events')
    op.drop_table('users')
