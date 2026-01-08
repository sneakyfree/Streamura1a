"""
Streamura Content Moderation Rules Configuration

This module contains default filter rules and configuration
for the AI content moderation system.
"""

from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum


class FilterType(Enum):
    KEYWORD = "keyword"
    REGEX = "regex"
    ML_CATEGORY = "ml_category"


class FilterAction(Enum):
    BLOCK = "block"
    FLAG = "flag"
    WARN = "warn"


class Severity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class FilterRule:
    """A content filter rule"""
    pattern: str
    filter_type: FilterType
    action: FilterAction
    severity: Severity
    category: str
    description: str


# Default keyword blocklist for common violations
DEFAULT_KEYWORD_FILTERS: List[FilterRule] = [
    # Scam-related keywords
    FilterRule(
        pattern="free nitro",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="scam",
        description="Discord Nitro scam"
    ),
    FilterRule(
        pattern="free vbucks",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="scam",
        description="Fortnite V-Bucks scam"
    ),
    FilterRule(
        pattern="free robux",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="scam",
        description="Roblox Robux scam"
    ),
    FilterRule(
        pattern="claim your prize",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.HIGH,
        category="scam",
        description="Prize scam"
    ),
    FilterRule(
        pattern="wire money",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.FLAG,
        severity=Severity.HIGH,
        category="scam",
        description="Potential money scam"
    ),

    # Harassment keywords
    FilterRule(
        pattern="kys",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="harassment",
        description="Self-harm encouragement"
    ),
    FilterRule(
        pattern="kill yourself",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="harassment",
        description="Self-harm encouragement"
    ),

    # Spam keywords
    FilterRule(
        pattern="follow4follow",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.WARN,
        severity=Severity.LOW,
        category="spam",
        description="Follow spam"
    ),
    FilterRule(
        pattern="f4f",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.WARN,
        severity=Severity.LOW,
        category="spam",
        description="Follow spam abbreviation"
    ),
    FilterRule(
        pattern="check out my stream",
        filter_type=FilterType.KEYWORD,
        action=FilterAction.WARN,
        severity=Severity.LOW,
        category="spam",
        description="Self-promotion"
    ),
]


# Regex patterns for more complex matching
DEFAULT_REGEX_FILTERS: List[FilterRule] = [
    # URLs (configurable per stream)
    FilterRule(
        pattern=r"https?://(?!streamura\.)[^\s]+",
        filter_type=FilterType.REGEX,
        action=FilterAction.FLAG,
        severity=Severity.LOW,
        category="links",
        description="External links (non-Streamura)"
    ),

    # IP grabber patterns
    FilterRule(
        pattern=r"(?i)(grabify|iplogger|2no\.co|ipgrabber)",
        filter_type=FilterType.REGEX,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="malicious",
        description="IP grabber link"
    ),

    # Crypto scam patterns
    FilterRule(
        pattern=r"(?i)(send|transfer)\s*(btc|eth|crypto|bitcoin|ethereum)\s*to",
        filter_type=FilterType.REGEX,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="scam",
        description="Crypto transfer scam"
    ),

    # Investment scam patterns
    FilterRule(
        pattern=r"(?i)(make|earn)\s*\$?\d+[k]?\s*(per|a)\s*(day|hour|week)",
        filter_type=FilterType.REGEX,
        action=FilterAction.FLAG,
        severity=Severity.HIGH,
        category="scam",
        description="Income promise scam"
    ),

    # Repeated characters (spam)
    FilterRule(
        pattern=r"(.)\1{10,}",
        filter_type=FilterType.REGEX,
        action=FilterAction.BLOCK,
        severity=Severity.MEDIUM,
        category="spam",
        description="Excessive character repetition"
    ),

    # Unicode abuse (zalgo text, etc.)
    FilterRule(
        pattern=r"[\u0300-\u036f]{5,}",
        filter_type=FilterType.REGEX,
        action=FilterAction.BLOCK,
        severity=Severity.MEDIUM,
        category="spam",
        description="Zalgo text or unicode abuse"
    ),

    # Phone number patterns (potential doxxing)
    FilterRule(
        pattern=r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",
        filter_type=FilterType.REGEX,
        action=FilterAction.FLAG,
        severity=Severity.MEDIUM,
        category="personal_info",
        description="Possible phone number"
    ),

    # Social security number pattern (doxxing)
    FilterRule(
        pattern=r"\b\d{3}-\d{2}-\d{4}\b",
        filter_type=FilterType.REGEX,
        action=FilterAction.BLOCK,
        severity=Severity.CRITICAL,
        category="personal_info",
        description="SSN pattern detected"
    ),
]


# Moderation level presets
MODERATION_LEVELS: Dict[str, Dict[str, Any]] = {
    "off": {
        "description": "No automated moderation",
        "enable_profanity": False,
        "enable_spam_detection": False,
        "enable_custom_filters": False,
        "allow_links": True,
        "auto_mod_caps_percent": 0,
        "block_threshold": 1.0,  # Never blocks
        "flag_threshold": 1.0,   # Never flags
    },
    "relaxed": {
        "description": "Light moderation for trusted communities",
        "enable_profanity": True,
        "enable_spam_detection": True,
        "enable_custom_filters": True,
        "allow_links": True,
        "auto_mod_caps_percent": 90,
        "block_threshold": 0.95,
        "flag_threshold": 0.8,
    },
    "standard": {
        "description": "Balanced moderation (recommended)",
        "enable_profanity": True,
        "enable_spam_detection": True,
        "enable_custom_filters": True,
        "allow_links": True,
        "auto_mod_caps_percent": 70,
        "block_threshold": 0.85,
        "flag_threshold": 0.6,
    },
    "strict": {
        "description": "Aggressive moderation for all-ages content",
        "enable_profanity": True,
        "enable_spam_detection": True,
        "enable_custom_filters": True,
        "allow_links": False,
        "auto_mod_caps_percent": 50,
        "block_threshold": 0.7,
        "flag_threshold": 0.4,
    },
}


# Auto-mute escalation settings
MUTE_ESCALATION = {
    "first_offense": 60,       # 1 minute
    "second_offense": 300,     # 5 minutes
    "third_offense": 900,      # 15 minutes
    "fourth_offense": 3600,    # 1 hour
    "fifth_offense": 86400,    # 24 hours
    "repeated_offense": None,  # Permanent until manual review
}


def get_mute_duration(offense_count: int) -> int | None:
    """Get mute duration based on number of offenses"""
    if offense_count <= 0:
        return MUTE_ESCALATION["first_offense"]
    elif offense_count == 1:
        return MUTE_ESCALATION["first_offense"]
    elif offense_count == 2:
        return MUTE_ESCALATION["second_offense"]
    elif offense_count == 3:
        return MUTE_ESCALATION["third_offense"]
    elif offense_count == 4:
        return MUTE_ESCALATION["fourth_offense"]
    elif offense_count == 5:
        return MUTE_ESCALATION["fifth_offense"]
    else:
        return MUTE_ESCALATION["repeated_offense"]


# Categories and their severity weights
CATEGORY_WEIGHTS: Dict[str, float] = {
    "profanity": 0.6,
    "spam": 0.7,
    "harassment": 0.95,
    "violence": 0.9,
    "hate_speech": 0.95,
    "sexual": 0.85,
    "scam": 0.95,
    "malicious": 1.0,
    "personal_info": 0.9,
    "links": 0.3,
    "caps": 0.4,
    "repetition": 0.5,
    "custom_blocked": 0.8,
}


def get_all_default_filters() -> List[FilterRule]:
    """Get all default filter rules"""
    return DEFAULT_KEYWORD_FILTERS + DEFAULT_REGEX_FILTERS


def seed_default_filters(db_session) -> int:
    """
    Seed the database with default filter rules.
    Returns the number of filters created.
    """
    from models import ContentFilter

    created = 0
    for rule in get_all_default_filters():
        # Check if filter already exists
        existing = db_session.query(ContentFilter).filter(
            ContentFilter.pattern == rule.pattern,
            ContentFilter.filter_type == rule.filter_type.value
        ).first()

        if not existing:
            filter_obj = ContentFilter(
                pattern=rule.pattern,
                filter_type=rule.filter_type.value,
                action=rule.action.value,
                severity=rule.severity.value,
                category=rule.category,
                description=rule.description,
                is_active=True
            )
            db_session.add(filter_obj)
            created += 1

    db_session.commit()
    return created
