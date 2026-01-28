"""
Streamura Contradiction Detection Engine

Detects conflicting information in user data and transactions.
Provides blockers and recommendations for users.

Based on DNA Strand Master Plan C.1 Contradiction Detection.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class ContradictionSeverity(Enum):
    """Severity levels for contradictions."""
    INFO = "info"        # Noteworthy but allowed
    WARNING = "warning"  # Flag for review, user can proceed
    BLOCK = "block"      # Prevent action until resolved


class ContradictionCategory(Enum):
    """Categories of contradictions."""
    IDENTITY = "identity"
    FINANCIAL = "financial"
    CONTENT = "content"
    BEHAVIORAL = "behavioral"
    COMPLIANCE = "compliance"


@dataclass
class Contradiction:
    """A detected contradiction in user data."""
    id: str
    rule_name: str
    category: ContradictionCategory
    severity: ContradictionSeverity
    title: str
    message: str
    impact: str
    fix_action: Optional[str] = None
    fix_url: Optional[str] = None
    fix_time_estimate: Optional[str] = None
    data: Optional[Dict] = None
    detected_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "rule_name": self.rule_name,
            "category": self.category.value,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "impact": self.impact,
            "fix_action": self.fix_action,
            "fix_url": self.fix_url,
            "fix_time_estimate": self.fix_time_estimate,
            "detected_at": self.detected_at.isoformat(),
        }


@dataclass
class ContradictionRule:
    """A rule for detecting contradictions."""
    name: str
    description: str
    category: ContradictionCategory
    severity: ContradictionSeverity
    condition: Callable[[Any, Dict], bool]
    message_template: str
    impact_template: str
    fix_action: Optional[str] = None
    fix_url: Optional[str] = None
    fix_time_estimate: Optional[str] = None


class ContradictionDetector:
    """
    Detects conflicting information in user data.
    
    Provides:
    - Automatic contradiction detection based on rules
    - Blocker identification for user onboarding
    - Quick win recommendations for score improvement
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._rules = self._initialize_rules()
    
    def _initialize_rules(self) -> List[ContradictionRule]:
        """Initialize all contradiction detection rules."""
        return [
            # Identity rules
            ContradictionRule(
                name="age_content_mismatch",
                description="User claims age that conflicts with content restrictions",
                category=ContradictionCategory.IDENTITY,
                severity=ContradictionSeverity.BLOCK,
                condition=lambda user, ctx: (
                    hasattr(user, 'date_of_birth') and 
                    user.date_of_birth and 
                    self._calculate_age(user.date_of_birth) < 18 and
                    any(cat in (getattr(user, 'categories', []) or []) 
                        for cat in ['adult', 'gambling', 'alcohol'])
                ),
                message_template="Age-restricted categories require age verification (18+).",
                impact_template="Cannot stream in age-restricted categories.",
                fix_action="Complete age verification or remove restricted categories.",
                fix_url="/settings/verification",
                fix_time_estimate="5 minutes",
            ),
            
            ContradictionRule(
                name="unverified_high_earner",
                description="User earning above threshold without identity verification",
                category=ContradictionCategory.IDENTITY,
                severity=ContradictionSeverity.WARNING,
                condition=lambda user, ctx: (
                    getattr(user, 'balance', 0) > 100 and
                    not getattr(user, 'is_verified', False)
                ),
                message_template="High earnings require identity verification for payout.",
                impact_template="Payouts will be delayed until verification completes.",
                fix_action="Complete identity verification to unlock payouts.",
                fix_url="/kyc",
                fix_time_estimate="10 minutes",
            ),
            
            ContradictionRule(
                name="kyc_without_verification",
                description="Claims verified status without completed KYC",
                category=ContradictionCategory.IDENTITY,
                severity=ContradictionSeverity.BLOCK,
                condition=lambda user, ctx: (
                    getattr(user, 'is_verified', False) and
                    not getattr(user, 'kyc_completed', False)
                ),
                message_template="Verified status requires completed identity verification.",
                impact_template="Verified badge will be removed.",
                fix_action="Complete KYC verification.",
                fix_url="/kyc",
                fix_time_estimate="10 minutes",
            ),
            
            # Financial rules
            ContradictionRule(
                name="location_payout_mismatch",
                description="Streaming location differs from payout country",
                category=ContradictionCategory.FINANCIAL,
                severity=ContradictionSeverity.WARNING,
                condition=lambda user, ctx: (
                    getattr(user, 'country', None) and
                    getattr(user, 'payout_country', None) and
                    user.country != user.payout_country and
                    not getattr(user, 'location_explanation', None)
                ),
                message_template="Your streaming location ({country}) differs from your payout country ({payout_country}).",
                impact_template="Additional verification may be required for payouts.",
                fix_action="Provide explanation or update payout country.",
                fix_url="/settings/payments",
                fix_time_estimate="2 minutes",
            ),
            
            ContradictionRule(
                name="duplicate_tax_id",
                description="Tax ID already registered to another account",
                category=ContradictionCategory.FINANCIAL,
                severity=ContradictionSeverity.BLOCK,
                condition=lambda user, ctx: ctx.get('duplicate_tax_id', False),
                message_template="This tax ID is already registered to another account.",
                impact_template="Cannot process payouts with duplicate tax information.",
                fix_action="Contact support if this is an error.",
                fix_url="/support",
                fix_time_estimate="Contact required",
            ),
            
            ContradictionRule(
                name="payout_without_streams",
                description="Payout requested with no streaming history",
                category=ContradictionCategory.FINANCIAL,
                severity=ContradictionSeverity.WARNING,
                condition=lambda user, ctx: (
                    ctx.get('payout_requested', False) and
                    getattr(user, 'total_streams', 0) == 0
                ),
                message_template="Payout requested but you have no streaming history.",
                impact_template="Payout may be flagged for review.",
                fix_action="Start streaming to build history.",
                fix_url="/go-live",
                fix_time_estimate="Varies",
            ),
            
            ContradictionRule(
                name="high_earnings_low_trust",
                description="High pending balance with low trust score",
                category=ContradictionCategory.FINANCIAL,
                severity=ContradictionSeverity.WARNING,
                condition=lambda user, ctx: (
                    getattr(user, 'balance', 0) > 500 and
                    getattr(user, 'trust_score', 100) < 30
                ),
                message_template="High earnings with low trust score flagged for review.",
                impact_template="Payouts may be subject to additional review.",
                fix_action="Improve trust score by completing verification steps.",
                fix_url="/trust-score",
                fix_time_estimate="Varies",
            ),
            
            # Content rules
            ContradictionRule(
                name="monetization_without_requirements",
                description="Monetization enabled without meeting requirements",
                category=ContradictionCategory.CONTENT,
                severity=ContradictionSeverity.BLOCK,
                condition=lambda user, ctx: (
                    getattr(user, 'is_monetized', False) and
                    (getattr(user, 'follower_count', 0) < 100 or
                     getattr(user, 'total_watch_hours', 0) < 10)
                ),
                message_template="Monetization requires 100+ followers and 10+ watch hours.",
                impact_template="Monetization features disabled.",
                fix_action="Continue building your audience to unlock monetization.",
                fix_url="/analytics",
                fix_time_estimate="Varies",
            ),
            
            # Behavioral rules
            ContradictionRule(
                name="rapid_location_changes",
                description="Unusually rapid changes in streaming location",
                category=ContradictionCategory.BEHAVIORAL,
                severity=ContradictionSeverity.INFO,
                condition=lambda user, ctx: ctx.get('rapid_location_changes', False),
                message_template="Unusual location pattern detected.",
                impact_template="No immediate impact, flagged for monitoring.",
                fix_action=None,
                fix_url=None,
            ),
            
            ContradictionRule(
                name="engagement_anomaly",
                description="Engagement patterns suggest artificial activity",
                category=ContradictionCategory.BEHAVIORAL,
                severity=ContradictionSeverity.WARNING,
                condition=lambda user, ctx: ctx.get('engagement_anomaly', False),
                message_template="Unusual engagement patterns detected on your streams.",
                impact_template="Trust score may be affected.",
                fix_action="Ensure authentic engagement on your streams.",
                fix_url="/analytics",
            ),
            
            # Compliance rules
            ContradictionRule(
                name="banned_region_streaming",
                description="Streaming from or to a banned region",
                category=ContradictionCategory.COMPLIANCE,
                severity=ContradictionSeverity.BLOCK,
                condition=lambda user, ctx: (
                    getattr(user, 'country', None) in ctx.get('banned_countries', [])
                ),
                message_template="Streaming is not available in your region.",
                impact_template="Cannot go live.",
                fix_action="Contact support if you believe this is an error.",
                fix_url="/support",
            ),
        ]
    
    def _calculate_age(self, date_of_birth) -> int:
        """Calculate age from date of birth."""
        if isinstance(date_of_birth, str):
            date_of_birth = datetime.fromisoformat(date_of_birth)
        today = datetime.utcnow()
        return today.year - date_of_birth.year - (
            (today.month, today.day) < (date_of_birth.month, date_of_birth.day)
        )
    
    def check_user(
        self,
        user: Any,
        context: Optional[Dict] = None
    ) -> List[Contradiction]:
        """
        Check user data for contradictions.
        
        Args:
            user: User object to check
            context: Additional context (e.g., transaction data)
            
        Returns:
            List of detected contradictions
        """
        context = context or {}
        contradictions = []
        
        for rule in self._rules:
            try:
                if rule.condition(user, context):
                    contradiction = Contradiction(
                        id=f"contra_{user.id}_{rule.name}",
                        rule_name=rule.name,
                        category=rule.category,
                        severity=rule.severity,
                        title=rule.description,
                        message=rule.message_template.format(
                            country=getattr(user, 'country', 'Unknown'),
                            payout_country=getattr(user, 'payout_country', 'Unknown'),
                        ),
                        impact=rule.impact_template,
                        fix_action=rule.fix_action,
                        fix_url=rule.fix_url,
                        fix_time_estimate=rule.fix_time_estimate,
                    )
                    contradictions.append(contradiction)
                    logger.debug(f"Detected contradiction: {rule.name} for user {user.id}")
            except Exception as e:
                logger.warning(f"Error evaluating rule {rule.name}: {e}")
        
        return contradictions
    
    def get_blockers(self, user: Any) -> List[Contradiction]:
        """Get all blocking contradictions for a user."""
        all_contradictions = self.check_user(user)
        return [c for c in all_contradictions if c.severity == ContradictionSeverity.BLOCK]
    
    def get_warnings(self, user: Any) -> List[Contradiction]:
        """Get all warning-level contradictions for a user."""
        all_contradictions = self.check_user(user)
        return [c for c in all_contradictions if c.severity == ContradictionSeverity.WARNING]
    
    def get_quick_wins(self, user: Any) -> List[Dict]:
        """
        Get quick wins - issues that can be fixed in under 30 minutes.
        
        Returns highest-impact, lowest-effort fixes first.
        """
        quick_times = ["5 minutes", "10 minutes", "2 minutes", "15 minutes"]
        all_contradictions = self.check_user(user)
        
        quick_wins = []
        for c in all_contradictions:
            if c.fix_time_estimate in quick_times:
                quick_wins.append({
                    **c.to_dict(),
                    "priority": self._calculate_priority(c),
                })
        
        # Sort by priority (higher is better to fix first)
        quick_wins.sort(key=lambda x: x["priority"], reverse=True)
        return quick_wins
    
    def _calculate_priority(self, contradiction: Contradiction) -> int:
        """Calculate fix priority based on severity and impact."""
        severity_score = {
            ContradictionSeverity.BLOCK: 100,
            ContradictionSeverity.WARNING: 50,
            ContradictionSeverity.INFO: 10,
        }
        
        time_score = {
            "2 minutes": 50,
            "5 minutes": 40,
            "10 minutes": 30,
            "15 minutes": 20,
            "Varies": 5,
            "Contact required": 1,
        }
        
        base = severity_score.get(contradiction.severity, 0)
        time_bonus = time_score.get(contradiction.fix_time_estimate or "Varies", 0)
        
        return base + time_bonus
    
    def get_user_blockers_summary(self, user: Any) -> Dict:
        """
        Get a comprehensive summary of blockers and recommendations.
        
        Returns structured data for the Blockers/Unlockers UI.
        """
        all_contradictions = self.check_user(user)
        
        blockers = [c for c in all_contradictions if c.severity == ContradictionSeverity.BLOCK]
        warnings = [c for c in all_contradictions if c.severity == ContradictionSeverity.WARNING]
        info = [c for c in all_contradictions if c.severity == ContradictionSeverity.INFO]
        
        quick_wins = self.get_quick_wins(user)[:5]  # Top 5 quick wins
        
        return {
            "summary": {
                "total_issues": len(all_contradictions),
                "blockers": len(blockers),
                "warnings": len(warnings),
                "info": len(info),
            },
            "critical_blockers": [c.to_dict() for c in blockers],
            "warnings": [c.to_dict() for c in warnings],
            "quick_wins": quick_wins,
            "categories": {
                category.value: len([c for c in all_contradictions if c.category == category])
                for category in ContradictionCategory
            },
            "generated_at": datetime.utcnow().isoformat(),
        }


def get_contradiction_detector(db: Session) -> ContradictionDetector:
    """Factory function to get ContradictionDetector instance."""
    return ContradictionDetector(db)
