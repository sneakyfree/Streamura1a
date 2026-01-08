"""Add subscription tiers, subscriptions, and virtual goods tables

Revision ID: 009_subscriptions
Revises: 008_content_moderation
Create Date: 2025-01-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_subscriptions'
down_revision: Union[str, None] = '008_content_moderation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Subscription tiers - creator-defined subscription levels
    op.create_table('subscription_tiers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='USD'),
        sa.Column('billing_period', sa.String(20), server_default='monthly'),  # monthly, yearly
        sa.Column('stripe_price_id', sa.String(100), nullable=True),
        sa.Column('benefits', sa.JSON(), nullable=True),  # List of benefit strings
        sa.Column('badge_url', sa.Text(), nullable=True),  # Custom badge for subscribers
        sa.Column('emote_slots', sa.Integer(), server_default='0'),  # Number of custom emotes
        sa.Column('max_subscribers', sa.Integer(), nullable=True),  # Limit (null = unlimited)
        sa.Column('current_subscribers', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscription_tiers_id', 'subscription_tiers', ['id'])
    op.create_index('ix_subscription_tiers_creator_id', 'subscription_tiers', ['creator_id'])
    op.create_index('ix_subscription_tiers_is_active', 'subscription_tiers', ['is_active'])

    # Subscriptions - user subscriptions to creators
    op.create_table('subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscriber_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tier_id', sa.Integer(), sa.ForeignKey('subscription_tiers.id'), nullable=False),
        sa.Column('stripe_subscription_id', sa.String(100), nullable=True),
        sa.Column('stripe_customer_id', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), server_default='active'),  # active, canceled, past_due, paused
        sa.Column('current_period_start', sa.DateTime(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), server_default='false'),
        sa.Column('gift_from_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),  # If gifted
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subscriber_id', 'creator_id', name='uq_subscriber_creator')
    )
    op.create_index('ix_subscriptions_id', 'subscriptions', ['id'])
    op.create_index('ix_subscriptions_subscriber_id', 'subscriptions', ['subscriber_id'])
    op.create_index('ix_subscriptions_creator_id', 'subscriptions', ['creator_id'])
    op.create_index('ix_subscriptions_tier_id', 'subscriptions', ['tier_id'])
    op.create_index('ix_subscriptions_status', 'subscriptions', ['status'])
    op.create_index('ix_subscriptions_stripe_subscription_id', 'subscriptions', ['stripe_subscription_id'])

    # Virtual goods - purchasable items (badges, emotes, effects)
    op.create_table('virtual_goods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),  # null = platform goods
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.String(20), nullable=False),  # badge, emote, effect, sticker
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='USD'),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('animation_url', sa.Text(), nullable=True),  # For animated emotes/effects
        sa.Column('is_limited', sa.Boolean(), server_default='false'),
        sa.Column('quantity_available', sa.Integer(), nullable=True),  # null = unlimited
        sa.Column('quantity_sold', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('tier_exclusive_id', sa.Integer(), sa.ForeignKey('subscription_tiers.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_virtual_goods_id', 'virtual_goods', ['id'])
    op.create_index('ix_virtual_goods_creator_id', 'virtual_goods', ['creator_id'])
    op.create_index('ix_virtual_goods_type', 'virtual_goods', ['type'])
    op.create_index('ix_virtual_goods_is_active', 'virtual_goods', ['is_active'])

    # User inventory - owned virtual goods
    op.create_table('user_inventory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('good_id', sa.Integer(), sa.ForeignKey('virtual_goods.id'), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='1'),
        sa.Column('is_equipped', sa.Boolean(), server_default='false'),  # For badges/effects
        sa.Column('gifted_from_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('purchased_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'good_id', name='uq_user_good')
    )
    op.create_index('ix_user_inventory_id', 'user_inventory', ['id'])
    op.create_index('ix_user_inventory_user_id', 'user_inventory', ['user_id'])
    op.create_index('ix_user_inventory_good_id', 'user_inventory', ['good_id'])

    # Subscription gift codes - for gifting subscriptions
    op.create_table('subscription_gift_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(32), nullable=False, unique=True),
        sa.Column('tier_id', sa.Integer(), sa.ForeignKey('subscription_tiers.id'), nullable=False),
        sa.Column('months', sa.Integer(), server_default='1'),  # Duration in months
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('redeemed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('redeemed_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscription_gift_codes_id', 'subscription_gift_codes', ['id'])
    op.create_index('ix_subscription_gift_codes_code', 'subscription_gift_codes', ['code'])
    op.create_index('ix_subscription_gift_codes_tier_id', 'subscription_gift_codes', ['tier_id'])

    # Add subscriber count to users for quick lookup
    op.add_column('users', sa.Column('subscriber_count', sa.Integer(), server_default='0'))

    # Add subscription-related fields to streams
    op.add_column('streams', sa.Column('subscriber_only', sa.Boolean(), server_default='false'))
    op.add_column('streams', sa.Column('min_tier_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove columns from streams
    op.drop_column('streams', 'min_tier_id')
    op.drop_column('streams', 'subscriber_only')

    # Remove column from users
    op.drop_column('users', 'subscriber_count')

    # Drop tables in reverse order
    op.drop_table('subscription_gift_codes')
    op.drop_table('user_inventory')
    op.drop_table('virtual_goods')
    op.drop_table('subscriptions')
    op.drop_table('subscription_tiers')
