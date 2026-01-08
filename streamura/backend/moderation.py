"""
Streamura AI Content Moderation System

This module provides automated content moderation for chat messages,
stream titles, usernames, and other user-generated content.
"""

import re
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import (
    User, ChatMessage, Stream, ContentFilter, ModerationQueueItem,
    StreamModerationSettings, ChatMute, ModerationAction
)

# Try to import better_profanity, use fallback if not available
try:
    from better_profanity import profanity
    PROFANITY_AVAILABLE = True
except ImportError:
    PROFANITY_AVAILABLE = False
    profanity = None


class ModerationAction(Enum):
    """Actions that can be taken on content"""
    APPROVE = "approve"
    BLOCK = "block"
    FLAG = "flag"
    WARN = "warn"


class ContentCategory(Enum):
    """Categories of content violations"""
    PROFANITY = "profanity"
    SPAM = "spam"
    HARASSMENT = "harassment"
    VIOLENCE = "violence"
    HATE_SPEECH = "hate_speech"
    SEXUAL = "sexual"
    SCAM = "scam"
    LINKS = "links"
    CAPS = "caps"
    REPETITION = "repetition"


@dataclass
class ModerationResult:
    """Result of content moderation analysis"""
    action: ModerationAction
    is_allowed: bool
    confidence: float
    categories: Dict[str, float]  # Category -> confidence score
    matched_patterns: List[str]
    reason: Optional[str] = None
    should_mute: bool = False
    mute_duration: Optional[int] = None  # seconds


class SpamDetector:
    """Detect spam patterns in chat messages"""

    def __init__(self):
        self.user_messages: Dict[int, List[Tuple[datetime, str]]] = defaultdict(list)
        self.message_window = timedelta(seconds=30)
        self.duplicate_threshold = 3
        self.rate_limit_threshold = 5  # messages per window

    def check_spam(self, user_id: int, content: str) -> Tuple[bool, float]:
        """
        Check if a message appears to be spam.
        Returns (is_spam, confidence)
        """
        now = datetime.utcnow()
        content_lower = content.lower().strip()

        # Clean old messages
        self.user_messages[user_id] = [
            (ts, msg) for ts, msg in self.user_messages[user_id]
            if now - ts < self.message_window
        ]

        recent_messages = self.user_messages[user_id]

        # Check for duplicate messages
        duplicate_count = sum(1 for _, msg in recent_messages if msg == content_lower)
        if duplicate_count >= self.duplicate_threshold:
            return True, 0.95

        # Check for rate limiting
        if len(recent_messages) >= self.rate_limit_threshold:
            return True, 0.8

        # Check for similar messages (fuzzy duplicate)
        for _, msg in recent_messages:
            similarity = self._calculate_similarity(content_lower, msg)
            if similarity > 0.85:
                duplicate_count += 1

        if duplicate_count >= self.duplicate_threshold - 1:
            return True, 0.75

        # Record this message
        self.user_messages[user_id].append((now, content_lower))

        return False, 0.0

    def _calculate_similarity(self, s1: str, s2: str) -> float:
        """Simple similarity check based on character overlap"""
        if not s1 or not s2:
            return 0.0
        set1 = set(s1)
        set2 = set(s2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    def clear_user_history(self, user_id: int):
        """Clear message history for a user"""
        if user_id in self.user_messages:
            del self.user_messages[user_id]


class ContentModerator:
    """Main content moderation class"""

    # Default patterns for common violations
    DEFAULT_SCAM_PATTERNS = [
        r'(?i)free\s*(vbucks|robux|nitro|crypto|bitcoin)',
        r'(?i)(click|visit)\s*this\s*link',
        r'(?i)free\s*gift\s*card',
        r'(?i)make\s*\$?\d+.*per\s*(day|hour|week)',
        r'(?i)get\s*rich\s*quick',
    ]

    DEFAULT_LINK_PATTERN = r'https?://\S+|www\.\S+'

    def __init__(self, db: Session):
        self.db = db
        self.spam_detector = SpamDetector()
        self._filters_cache: Optional[List[ContentFilter]] = None
        self._filters_cache_time: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)

        # Initialize profanity filter if available
        if PROFANITY_AVAILABLE:
            profanity.load_censor_words()

    def _get_active_filters(self) -> List[ContentFilter]:
        """Get active content filters with caching"""
        now = datetime.utcnow()
        if (
            self._filters_cache is None or
            self._filters_cache_time is None or
            now - self._filters_cache_time > self._cache_ttl
        ):
            self._filters_cache = self.db.query(ContentFilter).filter(
                ContentFilter.is_active == True
            ).all()
            self._filters_cache_time = now
        return self._filters_cache

    def invalidate_cache(self):
        """Invalidate the filters cache"""
        self._filters_cache = None
        self._filters_cache_time = None

    async def analyze_message(
        self,
        content: str,
        user_id: int,
        stream_id: Optional[int] = None,
        user_trust_score: float = 1.0
    ) -> ModerationResult:
        """
        Analyze a chat message for violations.

        Args:
            content: The message content to analyze
            user_id: The user who sent the message
            stream_id: Optional stream ID for stream-specific settings
            user_trust_score: User's trust score (0.0-1.0)

        Returns:
            ModerationResult with action to take
        """
        categories: Dict[str, float] = {}
        matched_patterns: List[str] = []
        max_confidence = 0.0

        # Get stream-specific settings
        stream_settings = None
        if stream_id:
            stream_settings = self.db.query(StreamModerationSettings).filter(
                StreamModerationSettings.stream_id == stream_id
            ).first()

        moderation_level = stream_settings.moderation_level if stream_settings else "standard"

        # Skip moderation if turned off
        if moderation_level == "off":
            return ModerationResult(
                action=ModerationAction.APPROVE,
                is_allowed=True,
                confidence=1.0,
                categories={},
                matched_patterns=[]
            )

        # Check if user is muted
        if await self.is_user_muted(user_id, stream_id):
            return ModerationResult(
                action=ModerationAction.BLOCK,
                is_allowed=False,
                confidence=1.0,
                categories={"muted": 1.0},
                matched_patterns=[],
                reason="User is muted"
            )

        # 1. Check profanity
        profanity_score = self._check_profanity(content)
        if profanity_score > 0:
            categories[ContentCategory.PROFANITY.value] = profanity_score
            max_confidence = max(max_confidence, profanity_score)

        # 2. Check spam
        is_spam, spam_confidence = self.spam_detector.check_spam(user_id, content)
        if is_spam:
            categories[ContentCategory.SPAM.value] = spam_confidence
            matched_patterns.append("spam_detection")
            max_confidence = max(max_confidence, spam_confidence)

        # 3. Check custom filters
        filter_result = self._check_custom_filters(content)
        for category, score in filter_result["categories"].items():
            categories[category] = max(categories.get(category, 0), score)
            max_confidence = max(max_confidence, score)
        matched_patterns.extend(filter_result["patterns"])

        # 4. Check caps (excessive capitals)
        if stream_settings and stream_settings.auto_mod_caps_percent > 0:
            caps_ratio = self._check_caps_ratio(content)
            if caps_ratio * 100 > stream_settings.auto_mod_caps_percent:
                categories[ContentCategory.CAPS.value] = caps_ratio
                matched_patterns.append("excessive_caps")
                max_confidence = max(max_confidence, caps_ratio)

        # 5. Check links
        if stream_settings and not stream_settings.allow_links:
            if re.search(self.DEFAULT_LINK_PATTERN, content):
                categories[ContentCategory.LINKS.value] = 1.0
                matched_patterns.append("link_detected")
                max_confidence = max(max_confidence, 1.0)

        # 6. Check for scam patterns
        scam_score = self._check_scam_patterns(content)
        if scam_score > 0:
            categories[ContentCategory.SCAM.value] = scam_score
            matched_patterns.append("scam_pattern")
            max_confidence = max(max_confidence, scam_score)

        # 7. Check repetition
        rep_score = self._check_repetition(content)
        if rep_score > 0.5:
            categories[ContentCategory.REPETITION.value] = rep_score
            matched_patterns.append("repetitive_content")
            max_confidence = max(max_confidence, rep_score)

        # 8. Check stream-specific blocked words
        if stream_settings and stream_settings.blocked_words:
            blocked_result = self._check_blocked_words(content, stream_settings.blocked_words)
            if blocked_result:
                categories["custom_blocked"] = 1.0
                matched_patterns.extend(blocked_result)
                max_confidence = 1.0

        # Determine action based on confidence and moderation level
        action, reason, should_mute, mute_duration = self._determine_action(
            categories, max_confidence, moderation_level, user_trust_score
        )

        return ModerationResult(
            action=action,
            is_allowed=action == ModerationAction.APPROVE,
            confidence=max_confidence,
            categories=categories,
            matched_patterns=matched_patterns,
            reason=reason,
            should_mute=should_mute,
            mute_duration=mute_duration
        )

    def _check_profanity(self, content: str) -> float:
        """Check content for profanity using better-profanity library"""
        if not PROFANITY_AVAILABLE:
            return 0.0

        if profanity.contains_profanity(content):
            # Count profane words to estimate severity
            censored = profanity.censor(content)
            asterisk_count = censored.count('*')
            word_count = len(content.split())
            if word_count > 0:
                return min(1.0, asterisk_count / (word_count * 3))
            return 0.5
        return 0.0

    def _check_custom_filters(self, content: str) -> Dict[str, Any]:
        """Check content against custom filter rules"""
        result = {"categories": {}, "patterns": []}
        filters = self._get_active_filters()

        for filter_rule in filters:
            matched = False

            if filter_rule.filter_type == "keyword":
                # Case-insensitive keyword match
                if filter_rule.pattern.lower() in content.lower():
                    matched = True

            elif filter_rule.filter_type == "regex":
                try:
                    if re.search(filter_rule.pattern, content, re.IGNORECASE):
                        matched = True
                except re.error:
                    pass

            if matched:
                category = filter_rule.category or "custom"
                severity_score = {
                    "low": 0.3,
                    "medium": 0.6,
                    "high": 0.85,
                    "critical": 1.0
                }.get(filter_rule.severity, 0.6)

                result["categories"][category] = max(
                    result["categories"].get(category, 0),
                    severity_score
                )
                result["patterns"].append(filter_rule.pattern)

        return result

    def _check_caps_ratio(self, content: str) -> float:
        """Calculate the ratio of uppercase letters in content"""
        alpha_chars = [c for c in content if c.isalpha()]
        if len(alpha_chars) < 5:  # Ignore very short messages
            return 0.0
        upper_count = sum(1 for c in alpha_chars if c.isupper())
        return upper_count / len(alpha_chars)

    def _check_scam_patterns(self, content: str) -> float:
        """Check for common scam patterns"""
        for pattern in self.DEFAULT_SCAM_PATTERNS:
            if re.search(pattern, content):
                return 0.9
        return 0.0

    def _check_repetition(self, content: str) -> float:
        """Check for repetitive character patterns"""
        if len(content) < 5:
            return 0.0

        # Check for repeated characters (e.g., "aaaaaaa")
        max_repeat = 1
        current_repeat = 1
        for i in range(1, len(content)):
            if content[i] == content[i-1]:
                current_repeat += 1
                max_repeat = max(max_repeat, current_repeat)
            else:
                current_repeat = 1

        if max_repeat > 5:
            return min(1.0, max_repeat / 10)

        return 0.0

    def _check_blocked_words(self, content: str, blocked_words: List[str]) -> List[str]:
        """Check for stream-specific blocked words"""
        matched = []
        content_lower = content.lower()
        for word in blocked_words:
            if word.lower() in content_lower:
                matched.append(f"blocked:{word}")
        return matched

    def _determine_action(
        self,
        categories: Dict[str, float],
        max_confidence: float,
        moderation_level: str,
        user_trust_score: float
    ) -> Tuple[ModerationAction, Optional[str], bool, Optional[int]]:
        """
        Determine what action to take based on analysis results.

        Returns: (action, reason, should_mute, mute_duration)
        """
        # Adjust thresholds based on moderation level
        thresholds = {
            "relaxed": {"block": 0.95, "flag": 0.8, "warn": 0.6},
            "standard": {"block": 0.85, "flag": 0.6, "warn": 0.4},
            "strict": {"block": 0.7, "flag": 0.4, "warn": 0.2},
        }
        level_thresholds = thresholds.get(moderation_level, thresholds["standard"])

        # Adjust based on user trust score (higher trust = more lenient)
        trust_adjustment = (user_trust_score - 0.5) * 0.2  # -0.1 to +0.1

        block_threshold = level_thresholds["block"] + trust_adjustment
        flag_threshold = level_thresholds["flag"] + trust_adjustment
        warn_threshold = level_thresholds["warn"] + trust_adjustment

        # Critical categories always result in blocking
        critical_categories = [
            ContentCategory.SCAM.value,
            ContentCategory.HATE_SPEECH.value,
            ContentCategory.VIOLENCE.value
        ]

        for cat in critical_categories:
            if categories.get(cat, 0) > 0.7:
                reason = f"Detected {cat} content"
                should_mute = categories.get(cat, 0) > 0.9
                mute_duration = 300 if should_mute else None  # 5 minute mute
                return ModerationAction.BLOCK, reason, should_mute, mute_duration

        # Determine action based on max confidence
        if max_confidence >= block_threshold:
            primary_category = max(categories.items(), key=lambda x: x[1])[0] if categories else "violation"
            should_mute = max_confidence > 0.95
            mute_duration = 60 if should_mute else None  # 1 minute mute for high confidence
            return ModerationAction.BLOCK, f"Content blocked: {primary_category}", should_mute, mute_duration

        if max_confidence >= flag_threshold:
            return ModerationAction.FLAG, "Content flagged for review", False, None

        if max_confidence >= warn_threshold:
            return ModerationAction.WARN, "Content warning issued", False, None

        return ModerationAction.APPROVE, None, False, None

    async def is_user_muted(self, user_id: int, stream_id: Optional[int] = None) -> bool:
        """Check if a user is currently muted (globally or in a specific stream)"""
        now = datetime.utcnow()

        # Check global mute on user
        user = self.db.query(User).filter(User.id == user_id).first()
        if user and user.muted_until and user.muted_until > now:
            return True

        # Check stream-specific and global mutes in chat_mutes table
        query = self.db.query(ChatMute).filter(
            ChatMute.user_id == user_id,
            ChatMute.is_active == True,
            or_(
                ChatMute.muted_until == None,  # Permanent mute
                ChatMute.muted_until > now
            )
        )

        if stream_id:
            # Check for stream-specific OR global mute
            query = query.filter(
                or_(
                    ChatMute.stream_id == stream_id,
                    ChatMute.stream_id == None
                )
            )
        else:
            # Only check global mutes
            query = query.filter(ChatMute.stream_id == None)

        return query.first() is not None

    async def mute_user(
        self,
        user_id: int,
        muted_by: int,
        stream_id: Optional[int] = None,
        duration_seconds: Optional[int] = None,
        reason: Optional[str] = None
    ) -> ChatMute:
        """
        Mute a user in chat.

        Args:
            user_id: User to mute
            muted_by: User performing the mute (moderator)
            stream_id: Stream to mute in (None for global)
            duration_seconds: Mute duration (None for permanent)
            reason: Reason for mute
        """
        muted_until = None
        if duration_seconds:
            muted_until = datetime.utcnow() + timedelta(seconds=duration_seconds)

        mute = ChatMute(
            user_id=user_id,
            stream_id=stream_id,
            muted_by=muted_by,
            reason=reason,
            muted_until=muted_until,
            is_active=True
        )
        self.db.add(mute)

        # Update user's mute count
        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.mute_count = (user.mute_count or 0) + 1
            # Decrease moderation score
            user.moderation_score = max(0.0, (user.moderation_score or 1.0) - 0.1)

        self.db.commit()
        self.db.refresh(mute)

        return mute

    async def unmute_user(
        self,
        user_id: int,
        stream_id: Optional[int] = None
    ) -> bool:
        """Unmute a user"""
        query = self.db.query(ChatMute).filter(
            ChatMute.user_id == user_id,
            ChatMute.is_active == True
        )

        if stream_id:
            query = query.filter(ChatMute.stream_id == stream_id)
        else:
            query = query.filter(ChatMute.stream_id == None)

        mutes = query.all()
        if not mutes:
            return False

        for mute in mutes:
            mute.is_active = False

        self.db.commit()
        return True

    async def calculate_trust_score(self, user_id: int) -> float:
        """
        Calculate a user's trust score based on their history.
        Score ranges from 0.0 (untrusted) to 1.0 (fully trusted).
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return 0.5  # Default for unknown users

        score = 1.0

        # Reduce score for warnings
        score -= user.warning_count * 0.1

        # Reduce score for mutes
        score -= (user.mute_count or 0) * 0.15

        # Reduce score based on moderation history
        if user.moderation_score:
            score = (score + user.moderation_score) / 2

        # Increase score for account age (max +0.2 for accounts > 30 days old)
        if user.created_at:
            account_age_days = (datetime.utcnow() - user.created_at).days
            age_bonus = min(0.2, account_age_days / 150)
            score += age_bonus

        # Increase score for verified users
        if user.is_verified:
            score += 0.1

        return max(0.0, min(1.0, score))

    async def add_to_queue(
        self,
        content_type: str,
        content_text: str,
        flagged_reason: str,
        user_id: Optional[int] = None,
        stream_id: Optional[int] = None,
        content_id: Optional[int] = None,
        confidence: Optional[float] = None,
        flagged_patterns: Optional[List[str]] = None
    ) -> ModerationQueueItem:
        """Add content to the moderation queue for manual review"""
        queue_item = ModerationQueueItem(
            content_type=content_type,
            content_id=content_id,
            content_text=content_text,
            user_id=user_id,
            stream_id=stream_id,
            flagged_reason=flagged_reason,
            flagged_patterns=flagged_patterns,
            confidence=confidence,
            status="pending"
        )
        self.db.add(queue_item)
        self.db.commit()
        self.db.refresh(queue_item)
        return queue_item

    async def get_queue_items(
        self,
        status: str = "pending",
        content_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ModerationQueueItem]:
        """Get items from the moderation queue"""
        query = self.db.query(ModerationQueueItem).filter(
            ModerationQueueItem.status == status
        )

        if content_type:
            query = query.filter(ModerationQueueItem.content_type == content_type)

        return query.order_by(
            ModerationQueueItem.created_at.desc()
        ).offset(offset).limit(limit).all()

    async def review_queue_item(
        self,
        item_id: int,
        reviewer_id: int,
        approved: bool,
        notes: Optional[str] = None,
        action_taken: Optional[str] = None
    ) -> Optional[ModerationQueueItem]:
        """Review and resolve a moderation queue item"""
        item = self.db.query(ModerationQueueItem).filter(
            ModerationQueueItem.id == item_id
        ).first()

        if not item:
            return None

        item.status = "approved" if approved else "rejected"
        item.reviewed_by = reviewer_id
        item.reviewed_at = datetime.utcnow()
        item.review_notes = notes
        item.action_taken = action_taken

        self.db.commit()
        self.db.refresh(item)
        return item


# Global spam detector instance (shared across requests for rate limiting)
_spam_detector = SpamDetector()


def get_content_moderator(db: Session) -> ContentModerator:
    """Factory function to get a ContentModerator instance"""
    moderator = ContentModerator(db)
    moderator.spam_detector = _spam_detector
    return moderator
