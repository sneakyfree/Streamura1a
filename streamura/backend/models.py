"""
Streamura Database Models

This file contains all SQLAlchemy models for the Streamura backend.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    """User model for Streamura platform"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    last_login = Column(DateTime, nullable=True)

    # Relationships
    streams = relationship("Stream", back_populates="user")
    events = relationship("Event", back_populates="creator")
    transactions = relationship("Transaction", back_populates="user")
    notifications = relationship("Notification", back_populates="user", foreign_keys="[Notification.user_id]")

    # Stripe connectivity
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_account_id = Column(String(255), nullable=True)
    stripe_onboarding_complete = Column(Boolean, default=False)
    payout_enabled = Column(Boolean, default=False)

    # Monetization
    balance = Column(Float, default=0.0)
    lifetime_earnings = Column(Float, default=0.0)
    pending_payout = Column(Float, default=0.0)

    # Profile
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    bio = Column(Text, nullable=True)

    # Social
    follower_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    subscriber_count = Column(Integer, default=0)  # Subscribers to this creator (Phase 10)

    # Admin & Moderation
    is_admin = Column(Boolean, default=False)
    warning_count = Column(Integer, default=0)
    trust_score = Column(Float, default=1.0)
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(Text, nullable=True)
    ban_expires = Column(DateTime, nullable=True)

    # AI Moderation (Phase 9)
    moderation_score = Column(Float, default=1.0)  # 0.0-1.0, lower = more violations
    muted_until = Column(DateTime, nullable=True)  # Global mute expiration
    mute_count = Column(Integer, default=0)  # Total times user has been muted

    # Internationalization (Phase 13)
    preferred_language = Column(String(10), default='en')

class Stream(Base):
    """Stream model representing live video streams"""
    __tablename__ = "streams"

    id = Column(Integer, primary_key=True, index=True)
    stream_key = Column(String(255), unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="created")  # created, live, ended, archived
    is_public = Column(Boolean, default=True)
    is_monetized = Column(Boolean, default=False)

    # Location data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(255), nullable=True)

    # Stream metrics
    viewer_count = Column(Integer, default=0)
    peak_viewers = Column(Integer, default=0)
    total_watch_time = Column(Integer, default=0)  # in seconds
    earnings = Column(Float, default=0.0)
    tip_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)

    # Timestamps
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="streams")
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    event = relationship("Event", back_populates="streams")
    ads = relationship("AdImpression", back_populates="stream")
    transactions = relationship("Transaction", back_populates="stream")

    # Content metadata
    thumbnail_url = Column(String(512), nullable=True)
    category = Column(String(50), nullable=True)
    tags = Column(JSON, nullable=True)

    # LiveKit streaming fields
    livekit_room_name = Column(String(255), unique=True, nullable=True, index=True)
    livekit_room_id = Column(String(255), nullable=True)
    hls_url = Column(String(512), nullable=True)  # HLS fallback URL
    rtmp_url = Column(String(512), nullable=True)  # RTMP ingest URL

    # Subscription features (Phase 10)
    subscriber_only = Column(Boolean, default=False)  # Only subscribers can view
    min_tier_id = Column(Integer, ForeignKey("subscription_tiers.id"), nullable=True)  # Minimum tier required

    # ML Predictions (Phase 14)
    predicted_peak_viewers = Column(Integer, nullable=True)
    predicted_engagement = Column(Float, nullable=True)
    predicted_duration = Column(Integer, nullable=True)  # seconds
    prediction_confidence = Column(Float, nullable=True)


class Event(Base):
    """Event model representing grouped streams"""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # active, ended, archived

    # Creator information
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    creator = relationship("User", back_populates="events")

    # Location data
    latitude = Column(Float)
    longitude = Column(Float)
    location_name = Column(String(255))
    radius = Column(Float, default=100.0)  # in meters

    # Event metrics
    total_viewers = Column(Integer, default=0)
    total_streams = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)
    ranking_score = Column(Float, default=0.0)

    # Timestamps
    starts_at = Column(DateTime, server_default=func.now())
    ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    streams = relationship("Stream", back_populates="event")
    notifications = relationship("Notification", back_populates="event")

    # Event metadata
    thumbnail_url = Column(String(512), nullable=True)
    category = Column(String(50), nullable=True)
    is_featured = Column(Boolean, default=False)

class Transaction(Base):
    """Transaction model for monetization"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)

    # Transaction details
    amount = Column(Float)
    fee = Column(Float, default=0.0)
    net_amount = Column(Float, nullable=True)
    currency = Column(String(3), default="USD")
    transaction_type = Column(String(30))  # tip_received, tip_sent, stream_earning, ad_revenue, payout_requested, payout_completed
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, refunded
    description = Column(Text, nullable=True)

    # Payment processor data
    stripe_transaction_id = Column(String(255), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    stripe_transfer_id = Column(String(255), nullable=True)
    stripe_payout_id = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    processed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="transactions")
    stream = relationship("Stream", back_populates="transactions")

class AdImpression(Base):
    """Ad impression tracking"""
    __tablename__ = "ad_impressions"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"))
    ad_network = Column(String(50))
    ad_unit = Column(String(255))
    impression_count = Column(Integer, default=0)
    click_count = Column(Integer, default=0)
    revenue = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    stream = relationship("Stream", back_populates="ads")

class Notification(Base):
    """User notification system"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    notification_type = Column(String(50))  # earning, tip_received, new_follower, stream_started, event_nearby, system, moderation, payout
    title = Column(String(255))
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    is_pushed = Column(Boolean, default=False)
    extra_data = Column(JSON, nullable=True)  # renamed from 'metadata' which is reserved

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    read_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    event = relationship("Event", back_populates="notifications")
    stream = relationship("Stream")
    from_user = relationship("User", foreign_keys=[from_user_id])


class ChatMessage(Base):
    """Chat message model for stream chat"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Message content
    content = Column(Text, nullable=False)

    # Manual Moderation
    is_deleted = Column(Boolean, default=False)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    delete_reason = Column(String(255), nullable=True)

    # AI Moderation (Phase 9)
    moderation_status = Column(String(20), default='approved')  # 'approved', 'flagged', 'blocked', 'pending'
    moderation_confidence = Column(Float, nullable=True)  # 0.0-1.0 confidence score
    moderation_flags = Column(JSON, nullable=True)  # {'profanity': 0.9, 'spam': 0.2, ...}

    # Display settings
    is_highlighted = Column(Boolean, default=False)  # For tips or special messages
    tip_amount = Column(Float, nullable=True)  # If this is a tip message

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    stream = relationship("Stream")
    user = relationship("User", foreign_keys=[user_id])
    deleted_by_user = relationship("User", foreign_keys=[deleted_by])


class UserFollow(Base):
    """User follow relationship"""
    __tablename__ = "user_follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    following_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])


class StreamLike(Base):
    """Stream like/heart"""
    __tablename__ = "stream_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User")
    stream = relationship("Stream")


class Tip(Base):
    """Tip model for tracking tips sent during streams"""
    __tablename__ = "tips"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)

    # Tip details
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    message = Column(String(500), nullable=True)

    # Status
    status = Column(String(20), default="pending")  # pending, completed, failed

    # Display settings
    is_highlighted = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])
    stream = relationship("Stream")
    transaction = relationship("Transaction")


class Report(Base):
    """Content report model for moderation"""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Reported content (one of these should be set)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reported_stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)
    reported_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)

    # Report details
    reason = Column(String(50), nullable=False)  # spam, harassment, violence, nudity, copyright, other
    description = Column(Text, nullable=True)

    # Status
    status = Column(String(20), default="pending")  # pending, reviewing, resolved, dismissed
    priority = Column(String(20), default="normal")  # low, normal, high, urgent

    # Resolution
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    action_taken = Column(String(50), nullable=True)  # none, warning, mute, ban, content_removed

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    reported_user = relationship("User", foreign_keys=[reported_user_id])
    reported_stream = relationship("Stream")
    reported_message = relationship("ChatMessage")
    resolved_by_user = relationship("User", foreign_keys=[resolved_by])


class ModerationAction(Base):
    """Log of moderation actions taken"""
    __tablename__ = "moderation_actions"

    id = Column(Integer, primary_key=True, index=True)
    moderator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    target_stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    target_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=True)

    # Action details
    action_type = Column(String(50), nullable=False)  # warning, mute, temp_ban, perm_ban, unban, message_delete, stream_end
    reason = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)  # Duration in seconds for temp actions
    expires_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    moderator = relationship("User", foreign_keys=[moderator_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    target_stream = relationship("Stream")
    target_message = relationship("ChatMessage")
    report = relationship("Report")


class Appeal(Base):
    """Appeal against a moderation action"""
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    moderation_action_id = Column(Integer, ForeignKey("moderation_actions.id"), nullable=False, index=True)
    
    # Appeal details
    reason = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)  # Additional evidence/context provided by user
    
    # Status: pending, under_review, approved, denied, escalated
    status = Column(String(20), default="pending", index=True)
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    
    # Review
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    outcome = Column(String(50), nullable=True)  # action_reversed, action_reduced, action_upheld, dismissed
    
    # If action was modified
    new_action_type = Column(String(50), nullable=True)
    new_duration = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    moderation_action = relationship("ModerationAction", backref="appeals")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

class Recording(Base):
    """Recording model for stream recordings via LiveKit Egress"""
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # LiveKit Egress data
    egress_id = Column(String(255), unique=True, nullable=True)

    # Recording metadata
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    # Storage
    url = Column(String(1024), nullable=True)  # S3/Cloud storage URL
    storage_path = Column(String(1024), nullable=True)  # Path in storage bucket
    thumbnail_url = Column(String(1024), nullable=True)

    # File info
    duration = Column(Integer, nullable=True)  # Duration in seconds
    size_bytes = Column(Integer, nullable=True)
    format = Column(String(20), default="mp4")  # mp4, webm, etc.
    resolution = Column(String(20), nullable=True)  # e.g., "1080p", "720p"

    # Status
    status = Column(String(20), default="pending")  # pending, recording, processing, ready, failed, deleted

    # Visibility
    is_public = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    stream = relationship("Stream")
    user = relationship("User")


class ScheduledStream(Base):
    """Scheduled stream for future broadcasts"""
    __tablename__ = "scheduled_streams"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Stream info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    thumbnail_url = Column(String(512), nullable=True)
    category = Column(String(50), nullable=True)
    tags = Column(JSON, nullable=True)

    # Schedule
    scheduled_start = Column(DateTime, nullable=False, index=True)
    scheduled_end = Column(DateTime, nullable=True)
    timezone = Column(String(50), default="UTC")

    # Location (optional)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(255), nullable=True)

    # Settings
    is_public = Column(Boolean, default=True)
    is_monetized = Column(Boolean, default=False)
    notify_followers = Column(Boolean, default=True)

    # Status
    status = Column(String(20), default="scheduled")  # scheduled, live, completed, cancelled
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime, nullable=True)

    # Linked stream (when it goes live)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    user = relationship("User")
    stream = relationship("Stream")


class StreamAnalytics(Base):
    """Analytics snapshots for streams"""
    __tablename__ = "stream_analytics"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Snapshot timestamp
    timestamp = Column(DateTime, server_default=func.now(), index=True)

    # Viewer metrics
    viewer_count = Column(Integer, default=0)
    unique_viewers = Column(Integer, default=0)
    peak_viewers = Column(Integer, default=0)
    average_watch_time = Column(Integer, default=0)  # seconds

    # Engagement metrics
    chat_messages = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    new_followers = Column(Integer, default=0)

    # Revenue metrics
    tips_count = Column(Integer, default=0)
    tips_amount = Column(Float, default=0.0)
    ad_revenue = Column(Float, default=0.0)

    # Quality metrics (from LiveKit)
    avg_bitrate = Column(Integer, nullable=True)  # kbps
    avg_latency = Column(Integer, nullable=True)  # ms
    buffer_ratio = Column(Float, nullable=True)  # percentage of time spent buffering

    # Geographic data (aggregated)
    viewer_locations = Column(JSON, nullable=True)  # {"US": 45, "UK": 20, ...}

    # Device breakdown
    device_breakdown = Column(JSON, nullable=True)  # {"mobile": 60, "desktop": 35, "tablet": 5}

    # Relationships
    stream = relationship("Stream")
    user = relationship("User")


# =============================================================================
# AI Content Moderation Models (Phase 9)
# =============================================================================

class ContentFilter(Base):
    """Configurable content filter rules for AI moderation"""
    __tablename__ = "content_filters"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(Text, nullable=False)
    filter_type = Column(String(20), nullable=False)  # 'keyword', 'regex', 'ml_category'
    action = Column(String(20), default='block')  # 'block', 'flag', 'warn'
    severity = Column(String(10), default='medium')  # 'low', 'medium', 'high', 'critical'
    category = Column(String(50), nullable=True)  # 'profanity', 'spam', 'harassment', 'violence'
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class ModerationQueueItem(Base):
    """Queue of flagged content requiring manual review"""
    __tablename__ = "moderation_queue"

    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String(20), nullable=False)  # 'chat', 'stream_title', 'username', 'bio'
    content_id = Column(Integer, nullable=True)
    content_text = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    flagged_reason = Column(String(50), nullable=False)
    flagged_patterns = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String(20), default='pending')  # 'pending', 'approved', 'rejected', 'auto_resolved'
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    action_taken = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    stream = relationship("Stream")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class StreamModerationSettings(Base):
    """Per-stream moderation configuration"""
    __tablename__ = "stream_moderation_settings"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=False, unique=True, index=True)
    moderation_level = Column(String(20), default='standard')  # 'off', 'relaxed', 'standard', 'strict'
    allow_links = Column(Boolean, default=True)
    slow_mode_seconds = Column(Integer, default=0)
    subscriber_only = Column(Boolean, default=False)
    follower_only_minutes = Column(Integer, default=0)
    blocked_words = Column(JSON, nullable=True)
    blocked_users = Column(JSON, nullable=True)
    auto_mod_caps_percent = Column(Integer, default=70)
    auto_mod_emote_limit = Column(Integer, default=0)
    auto_mod_repeat_limit = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    stream = relationship("Stream")


class ChatMute(Base):
    """Track user mutes in chat (per-stream or global)"""
    __tablename__ = "chat_mutes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)  # null = global
    muted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), nullable=True)
    muted_until = Column(DateTime, nullable=True)  # null = permanent
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    stream = relationship("Stream")
    moderator = relationship("User", foreign_keys=[muted_by])


# =============================================================================
# Subscription & Virtual Goods Models (Phase 10)
# =============================================================================

class SubscriptionTier(Base):
    """Creator-defined subscription tiers"""
    __tablename__ = "subscription_tiers"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)  # Stored as Numeric(10,2) in migration
    currency = Column(String(3), default='USD')
    billing_period = Column(String(20), default='monthly')  # 'monthly', 'yearly'
    stripe_price_id = Column(String(100), nullable=True)
    benefits = Column(JSON, nullable=True)  # List of benefit strings
    badge_url = Column(Text, nullable=True)  # Custom badge for subscribers
    emote_slots = Column(Integer, default=0)  # Number of custom emotes
    max_subscribers = Column(Integer, nullable=True)  # null = unlimited
    current_subscribers = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, index=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    subscriptions = relationship("Subscription", back_populates="tier")
    exclusive_goods = relationship("VirtualGood", back_populates="tier_exclusive")


class Subscription(Base):
    """User subscriptions to creators"""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscriber_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tier_id = Column(Integer, ForeignKey("subscription_tiers.id"), nullable=False, index=True)
    stripe_subscription_id = Column(String(100), nullable=True, index=True)
    stripe_customer_id = Column(String(100), nullable=True)
    status = Column(String(20), default='active', index=True)  # 'active', 'canceled', 'past_due', 'paused'
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    gift_from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    subscriber = relationship("User", foreign_keys=[subscriber_id])
    creator = relationship("User", foreign_keys=[creator_id])
    tier = relationship("SubscriptionTier", back_populates="subscriptions")
    gifter = relationship("User", foreign_keys=[gift_from_user_id])


class VirtualGood(Base):
    """Purchasable virtual items (badges, emotes, effects, stickers)"""
    __tablename__ = "virtual_goods"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # null = platform goods
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(20), nullable=False)  # 'badge', 'emote', 'effect', 'sticker'
    price = Column(Float, nullable=False)  # Stored as Numeric(10,2) in migration
    currency = Column(String(3), default='USD')
    image_url = Column(Text, nullable=True)
    animation_url = Column(Text, nullable=True)  # For animated emotes/effects
    is_limited = Column(Boolean, default=False)
    quantity_available = Column(Integer, nullable=True)  # null = unlimited
    quantity_sold = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, index=True)
    tier_exclusive_id = Column(Integer, ForeignKey("subscription_tiers.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    tier_exclusive = relationship("SubscriptionTier", back_populates="exclusive_goods")
    inventory_items = relationship("UserInventory", back_populates="good")


class UserInventory(Base):
    """User's owned virtual goods"""
    __tablename__ = "user_inventory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    good_id = Column(Integer, ForeignKey("virtual_goods.id"), nullable=False, index=True)
    quantity = Column(Integer, default=1)
    is_equipped = Column(Boolean, default=False)  # For badges/effects that can be shown
    gifted_from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    purchased_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    good = relationship("VirtualGood", back_populates="inventory_items")
    gifter = relationship("User", foreign_keys=[gifted_from_user_id])


class SubscriptionGiftCode(Base):
    """Gift codes for subscription tiers"""
    __tablename__ = "subscription_gift_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), nullable=False, unique=True, index=True)
    tier_id = Column(Integer, ForeignKey("subscription_tiers.id"), nullable=False, index=True)
    months = Column(Integer, default=1)  # Duration in months
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    redeemed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    tier = relationship("SubscriptionTier")
    creator = relationship("User", foreign_keys=[created_by])
    redeemer = relationship("User", foreign_keys=[redeemed_by])


# =============================================================================
# PHASE 12: COMMUNITY FEATURES
# =============================================================================

class Community(Base):
    """Community/Group model for user-created communities"""
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    image_url = Column(String(512), nullable=True)
    banner_url = Column(String(512), nullable=True)
    member_count = Column(Integer, default=0)
    is_public = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    rules = Column(JSON, nullable=True)  # List of community rules
    tags = Column(JSON, nullable=True)  # List of tags for discovery
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("CommunityMember", back_populates="community")


class CommunityMember(Base):
    """Community membership tracking"""
    __tablename__ = "community_members"

    id = Column(Integer, primary_key=True, index=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), default="member")  # owner, moderator, member
    joined_at = Column(DateTime, server_default=func.now())
    is_muted = Column(Boolean, default=False)
    muted_until = Column(DateTime, nullable=True)

    # Relationships
    community = relationship("Community", back_populates="members")
    user = relationship("User")


class DirectMessage(Base):
    """Direct messages between users"""
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, nullable=False, index=True)  # Groups messages into conversations
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    is_deleted_by_sender = Column(Boolean, default=False)
    is_deleted_by_recipient = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class Conversation(Base):
    """Conversation metadata for direct messages"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    last_message_at = Column(DateTime, server_default=func.now())
    last_message_preview = Column(String(255), nullable=True)
    user1_unread_count = Column(Integer, default=0)
    user2_unread_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])


class UserBlock(Base):
    """User blocking functionality"""
    __tablename__ = "user_blocks"

    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


# =============================================================================
# PHASE 14: ML PREDICTIONS & ANALYTICS
# =============================================================================

class MLPrediction(Base):
    """Stores ML predictions and their actual outcomes for model evaluation"""
    __tablename__ = "ml_predictions"

    id = Column(Integer, primary_key=True, index=True)
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Prediction details
    prediction_type = Column(String(50), nullable=False)  # 'peak_viewers', 'engagement', 'revenue', 'duration'
    predicted_value = Column(Float, nullable=False)
    predicted_range_low = Column(Float, nullable=True)  # Confidence interval low
    predicted_range_high = Column(Float, nullable=True)  # Confidence interval high
    confidence = Column(Float, nullable=True)  # 0.0-1.0 confidence score

    # Outcome tracking (filled after stream ends)
    actual_value = Column(Float, nullable=True)
    error = Column(Float, nullable=True)  # Actual - Predicted (for model feedback)

    # Model metadata
    features_used = Column(JSON, nullable=True)  # Feature snapshot for debugging/analysis
    model_version = Column(String(50), nullable=True)  # Version of model used

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    evaluated_at = Column(DateTime, nullable=True)  # When actual was filled in

    # Relationships
    stream = relationship("Stream")
    user = relationship("User")


class CreatorPerformanceHistory(Base):
    """Aggregated performance stats for creators - used as ML features"""
    __tablename__ = "creator_performance_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    period_type = Column(String(20), nullable=False)  # 'daily', 'weekly', 'monthly'

    # Streaming metrics
    streams_count = Column(Integer, default=0)
    total_stream_duration = Column(Integer, default=0)  # seconds
    avg_stream_duration = Column(Float, nullable=True)

    # Viewer metrics
    total_viewers = Column(Integer, default=0)
    unique_viewers = Column(Integer, default=0)
    avg_concurrent_viewers = Column(Float, nullable=True)
    peak_concurrent_viewers = Column(Integer, default=0)

    # Engagement metrics
    total_chat_messages = Column(Integer, default=0)
    total_likes = Column(Integer, default=0)
    total_shares = Column(Integer, default=0)
    engagement_rate = Column(Float, nullable=True)  # (interactions / views) * 100

    # Growth metrics
    new_followers = Column(Integer, default=0)
    lost_followers = Column(Integer, default=0)
    new_subscribers = Column(Integer, default=0)
    churned_subscribers = Column(Integer, default=0)

    # Revenue metrics
    total_tips = Column(Float, default=0.0)
    total_subscription_revenue = Column(Float, default=0.0)
    total_ad_revenue = Column(Float, default=0.0)
    avg_tip_amount = Column(Float, nullable=True)

    # Category performance
    categories_streamed = Column(JSON, nullable=True)  # {"Gaming": 5, "IRL": 3}
    best_category = Column(String(50), nullable=True)
    best_time_slots = Column(JSON, nullable=True)  # {"14:00": 0.8, "20:00": 0.9}

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User")


class OptimalStreamTime(Base):
    """ML-derived recommendations for optimal streaming times"""
    __tablename__ = "optimal_stream_times"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(50), nullable=True)  # null = overall recommendation
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    hour_utc = Column(Integer, nullable=False)  # 0-23

    # Prediction metrics
    score = Column(Float, nullable=False)  # Predicted success score
    expected_viewers = Column(Integer, nullable=True)
    competition_level = Column(String(20), nullable=True)  # 'low', 'medium', 'high'
    confidence = Column(Float, nullable=True)

    # Metadata
    last_calculated = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User")


class ContactSubmission(Base):
    """Contact form submissions"""
    __tablename__ = "contact_submissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)  # general, technical, billing, report, partnership, press
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, in_progress, resolved, closed

    # Metadata
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)

    # If submitted by logged-in user
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Admin notes
    admin_notes = Column(Text, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)


# =============================================================================
# AGENT DECISION AUDIT TRAIL (Sprint 1 - Safety Layer)
# =============================================================================

class AgentDecision(Base):
    """
    Immutable audit trail for all autonomous agent decisions.
    
    Every action taken by an AI agent in the system is logged here
    for transparency, compliance, and human-in-the-loop review.
    """
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Agent identification
    agent_name = Column(String(50), nullable=False, index=True)  # 'orchestrator', 'scout', 'verify', 'cluster', 'moderation', 'revenue', 'support'
    agent_version = Column(String(20), nullable=True)
    
    # Action details
    action_type = Column(String(100), nullable=False, index=True)  # e.g. 'terminate_stream', 'ban_user', 'payout_approval'
    action_category = Column(String(50), nullable=True)  # 'moderation', 'monetization', 'discovery', 'support'
    
    # Target of the action
    target_type = Column(String(50), nullable=True)  # 'user', 'stream', 'transaction', 'event'
    target_id = Column(Integer, nullable=True, index=True)
    
    # Decision reasoning (explainability)
    reasoning = Column(Text, nullable=True)  # Human-readable explanation
    factors = Column(JSON, nullable=True)  # {factor_name: {weight: 0.3, score: 0.8, value: "..."}}
    confidence = Column(Float, nullable=True)  # 0.0-1.0
    alternatives_considered = Column(JSON, nullable=True)  # List of other options evaluated
    
    # Input data snapshot (for reproducibility)
    input_snapshot = Column(JSON, nullable=True)  # Key inputs that led to this decision
    
    # HITL (Human-in-the-Loop) gates
    requires_approval = Column(Boolean, default=False, index=True)
    approval_category = Column(String(50), nullable=True)  # 'critical', 'high_value', 'user_impact'
    approved = Column(Boolean, nullable=True)  # null = pending, True = approved, False = rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    # Execution status
    status = Column(String(20), default="pending", index=True)  # 'pending', 'approved', 'rejected', 'executed', 'failed', 'cancelled'
    executed_at = Column(DateTime, nullable=True)
    execution_result = Column(JSON, nullable=True)  # Result of the action if executed
    error_message = Column(Text, nullable=True)  # If action failed
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    approver = relationship("User", foreign_keys=[approved_by])


class HITLApprovalQueue(Base):
    """
    Queue for human-in-the-loop approvals.
    High-priority agent decisions that require human review before execution.
    """
    __tablename__ = "hitl_approval_queue"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("agent_decisions.id"), nullable=False, unique=True, index=True)
    
    # Queue management
    priority = Column(String(20), default="normal", index=True)  # 'low', 'normal', 'high', 'urgent'
    category = Column(String(50), nullable=True, index=True)  # 'account_action', 'payout', 'content_removal'
    
    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # Timeout handling
    timeout_at = Column(DateTime, nullable=True)  # Auto-escalate if not reviewed by this time
    escalation_level = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), default="pending", index=True)  # 'pending', 'assigned', 'reviewing', 'completed', 'escalated', 'expired'
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    decision = relationship("AgentDecision")
    assignee = relationship("User", foreign_keys=[assigned_to])


class DataExportRequest(Base):
    """GDPR data export request tracking (Sprint 2)."""
    __tablename__ = "data_export_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Export configuration
    export_type = Column(String(20), default="full")  # 'full', 'profile', 'content', 'financial', 'messages'
    include_private = Column(Boolean, default=True)
    
    # Status tracking
    status = Column(String(20), default="pending", index=True)  # 'pending', 'processing', 'completed', 'failed', 'expired'
    error_message = Column(Text, nullable=True)
    
    # File info
    file_path = Column(String(512), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256 for integrity
    file_size = Column(Integer, nullable=True)  # Bytes
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Account deletion flag
    is_deletion_export = Column(Boolean, default=False)
    
    # Relationships
    user = relationship("User")


class EmergencyContact(Base):
    """Emergency contact and incident tracking (Sprint 2)."""
    __tablename__ = "emergency_contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Emergency type
    emergency_type = Column(String(50), nullable=False)  # 'panic', 'medical', 'safety', 'legal', 'technical'
    severity = Column(String(20), default="high")  # 'low', 'medium', 'high', 'critical'
    
    # Location (optional, with consent)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    location_timestamp = Column(DateTime, nullable=True)
    location_consent = Column(Boolean, default=False)
    
    # Context
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    description = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), default="open", index=True)  # 'open', 'acknowledged', 'escalated', 'resolved', 'false_alarm'
    resolution_notes = Column(Text, nullable=True)
    
    # Routing
    routed_to = Column(String(100), nullable=True)  # 'local_emergency', 'platform_safety', 'creator_support'
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User")
    stream = relationship("Stream")


class PanicButtonLog(Base):
    """Log of panic button activations (Sprint 2)."""
    __tablename__ = "panic_button_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    emergency_contact_id = Column(Integer, ForeignKey("emergency_contacts.id"), nullable=True)
    
    # Activation context
    trigger_source = Column(String(50), nullable=False)  # 'mobile', 'web', 'keyboard_shortcut', 'voice'
    stream_id = Column(Integer, ForeignKey("streams.id"), nullable=True)
    
    # Response
    auto_actions_taken = Column(JSON, nullable=True)  # List of automated actions triggered
    response_time_seconds = Column(Float, nullable=True)
    
    # Timestamps
    activated_at = Column(DateTime, server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User")
    emergency = relationship("EmergencyContact")

