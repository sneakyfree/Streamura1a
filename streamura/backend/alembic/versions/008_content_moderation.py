"""Add AI content moderation tables and fields

Revision ID: 008_content_moderation
Revises: 001_initial_schema
Create Date: 2025-01-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_content_moderation'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add moderation fields to chat_messages table
    op.add_column('chat_messages', sa.Column('moderation_status', sa.String(20), server_default='approved'))
    op.add_column('chat_messages', sa.Column('moderation_confidence', sa.Float(), nullable=True))
    op.add_column('chat_messages', sa.Column('moderation_flags', sa.JSON(), nullable=True))

    # Add moderation fields to users table
    op.add_column('users', sa.Column('moderation_score', sa.Float(), server_default='1.0'))
    op.add_column('users', sa.Column('muted_until', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('mute_count', sa.Integer(), server_default='0'))

    # Content filters table - configurable filter rules
    op.create_table('content_filters',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pattern', sa.Text(), nullable=False),
        sa.Column('filter_type', sa.String(20), nullable=False),  # 'keyword', 'regex', 'ml_category'
        sa.Column('action', sa.String(20), server_default='block'),  # 'block', 'flag', 'warn'
        sa.Column('severity', sa.String(10), server_default='medium'),  # 'low', 'medium', 'high', 'critical'
        sa.Column('category', sa.String(50), nullable=True),  # 'profanity', 'spam', 'harassment', 'violence', etc.
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_content_filters_id', 'content_filters', ['id'])
    op.create_index('ix_content_filters_filter_type', 'content_filters', ['filter_type'])
    op.create_index('ix_content_filters_is_active', 'content_filters', ['is_active'])

    # Moderation queue table - for flagged content requiring review
    op.create_table('moderation_queue',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('content_type', sa.String(20), nullable=False),  # 'chat', 'stream_title', 'username', 'bio'
        sa.Column('content_id', sa.Integer(), nullable=True),  # Reference to the original content
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),
        sa.Column('flagged_reason', sa.String(50), nullable=False),  # 'profanity', 'spam', 'harassment', etc.
        sa.Column('flagged_patterns', sa.JSON(), nullable=True),  # List of patterns that triggered the flag
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending'),  # 'pending', 'approved', 'rejected', 'auto_resolved'
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('action_taken', sa.String(50), nullable=True),  # 'none', 'warned', 'muted', 'banned', 'content_removed'
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_moderation_queue_id', 'moderation_queue', ['id'])
    op.create_index('ix_moderation_queue_status', 'moderation_queue', ['status'])
    op.create_index('ix_moderation_queue_content_type', 'moderation_queue', ['content_type'])
    op.create_index('ix_moderation_queue_user_id', 'moderation_queue', ['user_id'])
    op.create_index('ix_moderation_queue_created_at', 'moderation_queue', ['created_at'])

    # Stream moderation settings - per-stream configuration
    op.create_table('stream_moderation_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=False, unique=True),
        sa.Column('moderation_level', sa.String(20), server_default='standard'),  # 'off', 'relaxed', 'standard', 'strict'
        sa.Column('allow_links', sa.Boolean(), server_default='true'),
        sa.Column('slow_mode_seconds', sa.Integer(), server_default='0'),  # 0 = disabled
        sa.Column('subscriber_only', sa.Boolean(), server_default='false'),
        sa.Column('follower_only_minutes', sa.Integer(), server_default='0'),  # 0 = disabled
        sa.Column('blocked_words', sa.JSON(), nullable=True),  # Custom word blocklist for this stream
        sa.Column('blocked_users', sa.JSON(), nullable=True),  # User IDs blocked from this stream's chat
        sa.Column('auto_mod_caps_percent', sa.Integer(), server_default='70'),  # Block if message is >X% caps
        sa.Column('auto_mod_emote_limit', sa.Integer(), server_default='0'),  # 0 = no limit
        sa.Column('auto_mod_repeat_limit', sa.Integer(), server_default='0'),  # Max repeated characters
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stream_moderation_settings_id', 'stream_moderation_settings', ['id'])
    op.create_index('ix_stream_moderation_settings_stream_id', 'stream_moderation_settings', ['stream_id'])

    # User chat mutes - per-stream mute tracking
    op.create_table('chat_mutes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('stream_id', sa.Integer(), sa.ForeignKey('streams.id'), nullable=True),  # null = global mute
        sa.Column('muted_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('muted_until', sa.DateTime(), nullable=True),  # null = permanent
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_chat_mutes_id', 'chat_mutes', ['id'])
    op.create_index('ix_chat_mutes_user_id', 'chat_mutes', ['user_id'])
    op.create_index('ix_chat_mutes_stream_id', 'chat_mutes', ['stream_id'])
    op.create_index('ix_chat_mutes_is_active', 'chat_mutes', ['is_active'])


def downgrade() -> None:
    # Drop new tables
    op.drop_table('chat_mutes')
    op.drop_table('stream_moderation_settings')
    op.drop_table('moderation_queue')
    op.drop_table('content_filters')

    # Remove added columns from users
    op.drop_column('users', 'mute_count')
    op.drop_column('users', 'muted_until')
    op.drop_column('users', 'moderation_score')

    # Remove added columns from chat_messages
    op.drop_column('chat_messages', 'moderation_flags')
    op.drop_column('chat_messages', 'moderation_confidence')
    op.drop_column('chat_messages', 'moderation_status')
