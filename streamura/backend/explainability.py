"""
Streamura Multi-View Explainability Engine

Provides 4-layer explanation system for agentic decisions:
- Viewer: Plain language, action-focused
- Creator: Metrics, comparisons, improvement tips  
- Moderator: Evidence, policy references, similar cases
- Auditor: Complete trail, inputs, versions, timestamps

Based on DNA Strand Master Plan C.4 Multi-View Explainability.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
import json
import hashlib
import logging

logger = logging.getLogger(__name__)


class ViewLevel(Enum):
    """Explanation view levels corresponding to different audiences."""
    VIEWER = "viewer"        # Plain language, action-focused
    CREATOR = "creator"      # Metrics, comparisons, improvement tips
    MODERATOR = "moderator"  # Evidence, policy refs, similar cases
    AUDITOR = "auditor"      # Complete trail, inputs, versions


class DecisionType(Enum):
    """Types of decisions that can be explained."""
    MODERATION = "moderation"
    TRUST_SCORE = "trust_score"
    PAYOUT = "payout"
    DISCOVERY = "discovery"
    CONTENT_FLAG = "content_flag"
    ACCOUNT_ACTION = "account_action"


@dataclass
class ViewerExplanation:
    """Simple, plain language explanation for general users."""
    summary: str
    action_taken: str
    what_you_can_do: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "summary": self.summary,
            "action_taken": self.action_taken,
            "what_you_can_do": self.what_you_can_do
        }


@dataclass
class CreatorExplanation:
    """Detailed explanation with metrics for creators."""
    summary: str
    what_happened: str
    why_it_happened: str
    metrics: Dict[str, Any]
    peer_comparison: Optional[Dict[str, Any]] = None
    improvement_tips: List[str] = field(default_factory=list)
    impact_on_trust_score: Optional[float] = None
    
    def to_dict(self) -> Dict:
        return {
            "summary": self.summary,
            "what_happened": self.what_happened,
            "why_it_happened": self.why_it_happened,
            "metrics": self.metrics,
            "peer_comparison": self.peer_comparison,
            "improvement_tips": self.improvement_tips,
            "impact_on_trust_score": self.impact_on_trust_score
        }


@dataclass
class ModeratorExplanation:
    """Evidence-based explanation for moderators."""
    summary: str
    decision_rationale: str
    evidence: List[Dict[str, Any]]
    policy_violations: List[Dict[str, str]]
    similar_cases: List[Dict[str, Any]]
    recommended_action: str
    confidence_score: float
    flags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "summary": self.summary,
            "decision_rationale": self.decision_rationale,
            "evidence": self.evidence,
            "policy_violations": self.policy_violations,
            "similar_cases": self.similar_cases,
            "recommended_action": self.recommended_action,
            "confidence_score": self.confidence_score,
            "flags": self.flags
        }


@dataclass
class AuditorExplanation:
    """Complete audit trail for compliance and legal review."""
    decision_id: str
    decision_type: str
    timestamp: datetime
    decision_chain: List[Dict[str, Any]]
    input_snapshot: Dict[str, Any]
    output_snapshot: Dict[str, Any]
    model_versions: Dict[str, str]
    policy_versions: Dict[str, str]
    operator_trail: List[Dict[str, Any]]
    evidence_refs: List[str]
    checksum: str
    
    def to_dict(self) -> Dict:
        return {
            "decision_id": self.decision_id,
            "decision_type": self.decision_type,
            "timestamp": self.timestamp.isoformat(),
            "decision_chain": self.decision_chain,
            "input_snapshot": self.input_snapshot,
            "output_snapshot": self.output_snapshot,
            "model_versions": self.model_versions,
            "policy_versions": self.policy_versions,
            "operator_trail": self.operator_trail,
            "evidence_refs": self.evidence_refs,
            "checksum": self.checksum
        }


@dataclass
class ExplanationResult:
    """Container for explanation at any view level."""
    view_level: ViewLevel
    decision_type: DecisionType
    explanation: Any  # ViewerExplanation | CreatorExplanation | etc.
    generated_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            "view_level": self.view_level.value,
            "decision_type": self.decision_type.value,
            "explanation": self.explanation.to_dict(),
            "generated_at": self.generated_at.isoformat()
        }


class ExplainabilityEngine:
    """
    Multi-view explanation system for agentic decisions.
    
    Provides appropriate explanations based on viewer role:
    - Viewer: Simple, actionable language
    - Creator: Detailed metrics and improvement guidance
    - Moderator: Evidence and policy-based reasoning
    - Auditor: Complete immutable audit trail
    """
    
    # Template messages for different scenarios
    VIEWER_TEMPLATES = {
        "moderation_warning": "Your content was flagged for review because it may contain {reason}.",
        "moderation_removed": "Your content was removed because it violated our {policy} policy.",
        "trust_decreased": "Your trust score decreased because {reason}.",
        "trust_increased": "Your trust score increased because {reason}.",
        "payout_delayed": "Your payout is being reviewed because {reason}.",
        "payout_processed": "Your payout of ${amount} has been processed.",
    }
    
    POLICY_REFS = {
        "profanity": {"name": "Community Guidelines §3.1", "url": "/policies/community-guidelines#3-1"},
        "spam": {"name": "Anti-Spam Policy §2.4", "url": "/policies/anti-spam#2-4"},
        "harassment": {"name": "Harassment Policy §1.2", "url": "/policies/harassment#1-2"},
        "violence": {"name": "Violence Policy §4.1", "url": "/policies/violence#4-1"},
        "hate_speech": {"name": "Hate Speech Policy §1.1", "url": "/policies/hate-speech#1-1"},
        "scam": {"name": "Fraud Prevention Policy §5.2", "url": "/policies/fraud#5-2"},
    }
    
    def __init__(self, db: Session):
        self.db = db
        self._version_registry = self._load_version_registry()
    
    def _load_version_registry(self) -> Dict[str, str]:
        """Load current versions of all models and policies."""
        return {
            "moderation_model": "v2.4.1",
            "trust_score_model": "v1.2.0",
            "event_detection_model": "v3.1.0",
            "community_guidelines": "2026-01-15",
            "payout_rules": "2026-01-01",
            "anti_spam_policy": "2026-01-10",
        }
    
    def generate_explanation(
        self,
        decision_type: DecisionType,
        decision_data: Dict[str, Any],
        view_level: ViewLevel,
        user_id: Optional[int] = None
    ) -> ExplanationResult:
        """
        Generate view-appropriate explanation for a decision.
        
        Args:
            decision_type: Type of decision being explained
            decision_data: Raw decision data including inputs, outputs, reasoning
            view_level: Target audience level
            user_id: Optional user ID for personalization
            
        Returns:
            ExplanationResult with appropriate explanation object
        """
        if view_level == ViewLevel.VIEWER:
            explanation = self._generate_viewer_explanation(decision_type, decision_data)
        elif view_level == ViewLevel.CREATOR:
            explanation = self._generate_creator_explanation(decision_type, decision_data, user_id)
        elif view_level == ViewLevel.MODERATOR:
            explanation = self._generate_moderator_explanation(decision_type, decision_data)
        elif view_level == ViewLevel.AUDITOR:
            explanation = self._generate_auditor_explanation(decision_type, decision_data)
        else:
            raise ValueError(f"Unknown view level: {view_level}")
        
        return ExplanationResult(
            view_level=view_level,
            decision_type=decision_type,
            explanation=explanation
        )
    
    def _generate_viewer_explanation(
        self,
        decision_type: DecisionType,
        data: Dict[str, Any]
    ) -> ViewerExplanation:
        """Generate plain language explanation for general users."""
        
        if decision_type == DecisionType.MODERATION:
            action = data.get("action", "reviewed")
            reason = data.get("primary_reason", "potential policy violation")
            
            if action == "block":
                summary = f"Your content was blocked because it may contain {reason}."
                action_taken = "Content was not posted."
                what_you_can_do = "Review our community guidelines and try again with different content."
            elif action == "flag":
                summary = f"Your content was flagged for review because it may contain {reason}."
                action_taken = "Content is visible but under review."
                what_you_can_do = "No action needed. We'll notify you if there's an issue."
            elif action == "warn":
                summary = f"We noticed your content may contain {reason}."
                action_taken = "You've received a warning."
                what_you_can_do = "Please review our community guidelines to avoid future warnings."
            else:
                summary = "Your content was reviewed and approved."
                action_taken = "Content is visible to viewers."
                what_you_can_do = None
        
        elif decision_type == DecisionType.TRUST_SCORE:
            change = data.get("change", 0)
            reason = data.get("primary_reason", "recent activity")
            
            if change > 0:
                summary = f"Your trust score increased by {change:.1f} points!"
                action_taken = f"New score: {data.get('new_score', 0):.0f}/100"
                what_you_can_do = "Keep up the great work to unlock more features."
            elif change < 0:
                summary = f"Your trust score decreased by {abs(change):.1f} points."
                action_taken = f"New score: {data.get('new_score', 0):.0f}/100"
                what_you_can_do = data.get("improvement_tip", "Stream consistently to rebuild trust.")
            else:
                summary = "Your trust score hasn't changed recently."
                action_taken = f"Current score: {data.get('new_score', 0):.0f}/100"
                what_you_can_do = None
        
        elif decision_type == DecisionType.PAYOUT:
            status = data.get("status", "processing")
            amount = data.get("amount", 0)
            
            if status == "processed":
                summary = f"Your payout of ${amount:.2f} has been sent!"
                action_taken = "Funds should arrive within 1-3 business days."
                what_you_can_do = None
            elif status == "delayed":
                summary = f"Your payout of ${amount:.2f} is under review."
                action_taken = "We need to verify some information."
                what_you_can_do = "Check your email for any required actions."
            else:
                summary = f"Your payout of ${amount:.2f} is being processed."
                action_taken = "This typically takes 1-2 hours."
                what_you_can_do = None
        
        else:
            summary = data.get("summary", "A decision was made regarding your account.")
            action_taken = data.get("action_taken", "See details below.")
            what_you_can_do = data.get("next_steps")
        
        return ViewerExplanation(
            summary=summary,
            action_taken=action_taken,
            what_you_can_do=what_you_can_do
        )
    
    def _generate_creator_explanation(
        self,
        decision_type: DecisionType,
        data: Dict[str, Any],
        user_id: Optional[int] = None
    ) -> CreatorExplanation:
        """Generate detailed explanation with metrics for creators."""
        
        if decision_type == DecisionType.MODERATION:
            summary = f"Content moderation decision: {data.get('action', 'reviewed')}"
            what_happened = data.get("description", "Your content was analyzed by our moderation system.")
            
            categories = data.get("categories", {})
            why_it_happened = self._explain_moderation_categories(categories)
            
            metrics = {
                "confidence_score": data.get("confidence", 0),
                "categories_detected": list(categories.keys()),
                "severity": data.get("severity", "low"),
                "processing_time_ms": data.get("processing_time", 0),
            }
            
            # Get peer comparison
            peer_comparison = self._get_peer_comparison(user_id, decision_type)
            
            improvement_tips = self._get_improvement_tips(decision_type, data)
            
            impact = data.get("trust_impact", 0)
        
        elif decision_type == DecisionType.TRUST_SCORE:
            summary = f"Trust score update: {data.get('new_score', 0):.0f}/100"
            what_happened = "Your trust score was recalculated based on recent activity."
            
            breakdown = data.get("breakdown", {})
            why_it_happened = self._explain_trust_breakdown(breakdown)
            
            metrics = {
                "old_score": data.get("old_score", 0),
                "new_score": data.get("new_score", 0),
                "change": data.get("change", 0),
                "tier": data.get("tier", "unverified"),
                "breakdown": breakdown,
            }
            
            peer_comparison = self._get_peer_comparison(user_id, decision_type)
            improvement_tips = data.get("recommendations", [])
            impact = data.get("change", 0)
        
        else:
            summary = data.get("summary", "Decision details")
            what_happened = data.get("description", "A decision was made.")
            why_it_happened = data.get("reasoning", "Based on platform policies.")
            metrics = data.get("metrics", {})
            peer_comparison = None
            improvement_tips = []
            impact = None
        
        return CreatorExplanation(
            summary=summary,
            what_happened=what_happened,
            why_it_happened=why_it_happened,
            metrics=metrics,
            peer_comparison=peer_comparison,
            improvement_tips=improvement_tips,
            impact_on_trust_score=impact
        )
    
    def _generate_moderator_explanation(
        self,
        decision_type: DecisionType,
        data: Dict[str, Any]
    ) -> ModeratorExplanation:
        """Generate evidence-based explanation for moderators."""
        
        summary = f"{decision_type.value.title()} decision: {data.get('action', 'reviewed')}"
        
        # Build decision rationale
        rationale_parts = []
        categories = data.get("categories", {})
        for category, score in categories.items():
            if score > 0.5:
                rationale_parts.append(f"{category}: {score:.1%} confidence")
        decision_rationale = "; ".join(rationale_parts) if rationale_parts else "No specific violations detected."
        
        # Compile evidence
        evidence = []
        if "content" in data:
            evidence.append({
                "type": "content",
                "value": data["content"][:200] + "..." if len(data.get("content", "")) > 200 else data.get("content", ""),
                "timestamp": data.get("timestamp", datetime.utcnow().isoformat())
            })
        if "matched_patterns" in data:
            evidence.append({
                "type": "pattern_matches",
                "value": data["matched_patterns"]
            })
        if "user_history" in data:
            evidence.append({
                "type": "user_history",
                "value": data["user_history"]
            })
        
        # Policy violations
        policy_violations = []
        for category in categories.keys():
            if category in self.POLICY_REFS:
                policy_violations.append(self.POLICY_REFS[category])
        
        # Similar cases (would query database in production)
        similar_cases = data.get("similar_cases", [])
        
        # Recommended action
        confidence = data.get("confidence", 0)
        if confidence > 0.9:
            recommended_action = "Auto-action recommended: High confidence"
        elif confidence > 0.7:
            recommended_action = "Manual review recommended: Medium confidence"
        else:
            recommended_action = "Low confidence: Suggest approve unless other signals"
        
        # Flags
        flags = []
        if data.get("repeat_offender"):
            flags.append("REPEAT_OFFENDER")
        if data.get("high_follower_count"):
            flags.append("HIGH_PROFILE_USER")
        if data.get("monetizing"):
            flags.append("MONETIZED_CREATOR")
        
        return ModeratorExplanation(
            summary=summary,
            decision_rationale=decision_rationale,
            evidence=evidence,
            policy_violations=policy_violations,
            similar_cases=similar_cases,
            recommended_action=recommended_action,
            confidence_score=confidence,
            flags=flags
        )
    
    def _generate_auditor_explanation(
        self,
        decision_type: DecisionType,
        data: Dict[str, Any]
    ) -> AuditorExplanation:
        """Generate complete audit trail for compliance review."""
        
        decision_id = data.get("decision_id", str(hash(json.dumps(data, default=str))))
        timestamp = data.get("timestamp", datetime.utcnow())
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        
        # Build complete decision chain
        decision_chain = data.get("decision_chain", [])
        if not decision_chain:
            decision_chain = [{
                "step": 1,
                "action": "initial_analysis",
                "timestamp": timestamp.isoformat(),
                "result": data.get("action", "unknown"),
                "confidence": data.get("confidence", 0)
            }]
        
        # Capture input snapshot (immutable)
        input_snapshot = {
            "content": data.get("content"),
            "user_id": data.get("user_id"),
            "context": data.get("context", {}),
            "request_timestamp": timestamp.isoformat(),
        }
        
        # Capture output snapshot
        output_snapshot = {
            "action": data.get("action"),
            "categories": data.get("categories", {}),
            "confidence": data.get("confidence", 0),
            "reasoning": data.get("reasoning"),
        }
        
        # Model versions used
        model_versions = self._version_registry.copy()
        
        # Policy versions
        policy_versions = {
            "community_guidelines": self._version_registry.get("community_guidelines", "unknown"),
            "payout_rules": self._version_registry.get("payout_rules", "unknown"),
        }
        
        # Operator trail
        operator_trail = data.get("operator_trail", [])
        if not operator_trail:
            operator_trail = [{
                "operator_type": "system",
                "operator_id": "moderation_agent",
                "action": data.get("action", "review"),
                "timestamp": timestamp.isoformat()
            }]
        
        # Evidence references
        evidence_refs = data.get("evidence_refs", [])
        
        # Generate checksum for immutability verification
        checksum_data = json.dumps({
            "decision_id": decision_id,
            "input_snapshot": input_snapshot,
            "output_snapshot": output_snapshot,
            "timestamp": timestamp.isoformat()
        }, sort_keys=True)
        checksum = hashlib.sha256(checksum_data.encode()).hexdigest()
        
        return AuditorExplanation(
            decision_id=decision_id,
            decision_type=decision_type.value,
            timestamp=timestamp,
            decision_chain=decision_chain,
            input_snapshot=input_snapshot,
            output_snapshot=output_snapshot,
            model_versions=model_versions,
            policy_versions=policy_versions,
            operator_trail=operator_trail,
            evidence_refs=evidence_refs,
            checksum=checksum
        )
    
    def _explain_moderation_categories(self, categories: Dict[str, float]) -> str:
        """Generate human-readable explanation for moderation categories."""
        if not categories:
            return "No specific issues detected."
        
        explanations = []
        for category, score in sorted(categories.items(), key=lambda x: -x[1]):
            if score > 0.7:
                explanations.append(f"High likelihood of {category} ({score:.0%})")
            elif score > 0.4:
                explanations.append(f"Possible {category} ({score:.0%})")
        
        return "; ".join(explanations) if explanations else "Low-confidence signals detected."
    
    def _explain_trust_breakdown(self, breakdown: Dict[str, Any]) -> str:
        """Generate human-readable explanation for trust score breakdown."""
        if not breakdown:
            return "Score calculated based on standard factors."
        
        parts = []
        for factor, data in breakdown.items():
            if isinstance(data, dict):
                score = data.get("score", 0)
                max_score = data.get("max", 10)
                parts.append(f"{factor}: {score}/{max_score}")
            else:
                parts.append(f"{factor}: {data}")
        
        return "Breakdown: " + ", ".join(parts)
    
    def _get_peer_comparison(
        self,
        user_id: Optional[int],
        decision_type: DecisionType
    ) -> Optional[Dict[str, Any]]:
        """Get anonymized peer comparison data."""
        # In production, this would query aggregated peer data
        if decision_type == DecisionType.TRUST_SCORE:
            return {
                "your_percentile": 75,
                "average_score": 62,
                "top_10_percent_threshold": 85,
                "creators_in_tier": 1250
            }
        elif decision_type == DecisionType.MODERATION:
            return {
                "your_flag_rate": 0.02,
                "average_flag_rate": 0.05,
                "percentile": 80
            }
        return None
    
    def _get_improvement_tips(
        self,
        decision_type: DecisionType,
        data: Dict[str, Any]
    ) -> List[str]:
        """Generate actionable improvement tips."""
        tips = []
        
        if decision_type == DecisionType.MODERATION:
            action = data.get("action", "")
            categories = data.get("categories", {})
            
            if "profanity" in categories:
                tips.append("Consider using less explicit language in your content.")
            if "spam" in categories:
                tips.append("Avoid repetitive messages and excessive self-promotion.")
            if action in ["block", "flag"]:
                tips.append("Review our community guidelines at /policies/community-guidelines")
        
        elif decision_type == DecisionType.TRUST_SCORE:
            if data.get("new_score", 0) < 50:
                tips.append("Complete identity verification to boost your score.")
                tips.append("Stream consistently (at least 2x per week) to build history.")
            
        return tips


def get_explainability_engine(db: Session) -> ExplainabilityEngine:
    """Factory function to get ExplainabilityEngine instance."""
    return ExplainabilityEngine(db)
