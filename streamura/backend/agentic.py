"""
Streamura Agentic Layer - Foundation

Orchestrator agent and specialist agents for autonomous platform operations.
Based on DNA Strand Master Plan's Agentic Crew design.

Agent Boundaries (Strict Rules):
- Moderation Agent: Can flag, warn, temp-restrict. Cannot permanently ban.
- Payout Agent: Can calculate, initiate <$1000. Cannot override fraud holds.
- Discovery Agent: Can surface events, rank streams. Cannot modify content.
- Trust Agent: Can verify, score. Cannot access financial data.

All high-risk actions require human approval.
All actions logged with reasoning.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
import logging
import uuid

logger = logging.getLogger(__name__)


class AgentType(Enum):
    """Types of specialist agents in the Streamura Crew."""
    ORCHESTRATOR = "orchestrator"
    DISCOVERY = "discovery"
    MODERATION = "moderation"
    PAYOUT = "payout"
    TRUST = "trust"
    LICENSING = "licensing"
    EMERGENCY = "emergency"


class ActionRisk(Enum):
    """Risk level of agent actions."""
    LOW = "low"           # Auto-approved
    MEDIUM = "medium"     # Logged, may escalate
    HIGH = "high"         # Requires human approval
    CRITICAL = "critical" # Requires senior human approval


@dataclass
class AgentAction:
    """Represents an action taken by an agent."""
    action_id: str
    agent_type: AgentType
    action_type: str
    target_entity: str
    target_id: Optional[int]
    inputs: Dict[str, Any]
    outputs: Dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""
    confidence: float = 0.0
    risk_level: ActionRisk = ActionRisk.LOW
    requires_approval: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            "action_id": self.action_id,
            "agent_type": self.agent_type.value,
            "action_type": self.action_type,
            "target_entity": self.target_entity,
            "target_id": self.target_id,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "reasoning": self.reasoning,
            "confidence": self.confidence,
            "risk_level": self.risk_level.value,
            "requires_approval": self.requires_approval,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat()
        }


class AgentPolicy:
    """Defines what an agent can and cannot do."""
    
    def __init__(
        self,
        agent_type: AgentType,
        can_do: List[str],
        cannot_do: List[str],
        requires_approval_for: List[str]
    ):
        self.agent_type = agent_type
        self.can_do = set(can_do)
        self.cannot_do = set(cannot_do)
        self.requires_approval_for = set(requires_approval_for)
    
    def is_allowed(self, action: str) -> bool:
        """Check if action is allowed."""
        if action in self.cannot_do:
            return False
        return action in self.can_do or action in self.requires_approval_for
    
    def needs_approval(self, action: str) -> bool:
        """Check if action requires human approval."""
        return action in self.requires_approval_for


# Agent Policies
AGENT_POLICIES = {
    AgentType.MODERATION: AgentPolicy(
        agent_type=AgentType.MODERATION,
        can_do=[
            "flag_content_for_review",
            "apply_temporary_restriction",  # Max 24 hours
            "send_warning_to_creator",
            "add_to_moderation_queue",
            "auto_block_chat_message",
        ],
        cannot_do=[
            "permanently_ban_account",
            "delete_content_permanently", 
            "access_payout_data",
            "modify_trust_score",
        ],
        requires_approval_for=[
            "restrict_monetization",
            "escalate_to_legal",
            "suspend_account_7_days",
        ]
    ),
    
    AgentType.PAYOUT: AgentPolicy(
        agent_type=AgentType.PAYOUT,
        can_do=[
            "calculate_earnings",
            "initiate_payout_under_1000",
            "flag_suspicious_activity",
            "generate_tax_report",
        ],
        cannot_do=[
            "modify_revenue_share",
            "access_identity_documents",
            "override_fraud_holds",
        ],
        requires_approval_for=[
            "payout_over_1000",
            "unhold_flagged_payout",
            "refund_transaction",
        ]
    ),
    
    AgentType.DISCOVERY: AgentPolicy(
        agent_type=AgentType.DISCOVERY,
        can_do=[
            "surface_trending_event",
            "rank_streams_for_homepage",
            "cluster_streams_by_location",
            "detect_breaking_news",
            "recommend_streams_to_viewer",
        ],
        cannot_do=[
            "modify_stream_content",
            "access_payment_data",
            "ban_users",
        ],
        requires_approval_for=[
            "feature_event_on_homepage",
            "mark_event_as_verified",
        ]
    ),
    
    AgentType.TRUST: AgentPolicy(
        agent_type=AgentType.TRUST,
        can_do=[
            "calculate_trust_score",
            "verify_identity_documents",
            "recommend_verification_steps",
            "issue_trust_badge",
        ],
        cannot_do=[
            "access_financial_data",
            "process_payments",
            "ban_users",
        ],
        requires_approval_for=[
            "upgrade_to_platinum_tier",
            "manual_trust_score_override",
        ]
    ),
    
    AgentType.EMERGENCY: AgentPolicy(
        agent_type=AgentType.EMERGENCY,
        can_do=[
            "activate_crisis_mode",
            "priority_route_emergency_streams",
            "notify_authorities",
            "suspend_monetization_during_crisis",
        ],
        cannot_do=[
            "modify_user_data",
            "process_payments",
        ],
        requires_approval_for=[
            "platform_wide_alert",
            "emergency_broadcast_takeover",
        ]
    ),
    
    AgentType.LICENSING: AgentPolicy(
        agent_type=AgentType.LICENSING,
        can_do=[
            "check_content_rights",
            "detect_copyrighted_music",
            "generate_license_request",
            "track_usage_metrics",
            "verify_media_ownership",
        ],
        cannot_do=[
            "auto_approve_licenses",
            "modify_content",
            "access_payment_data",
        ],
        requires_approval_for=[
            "grant_syndication_rights",
            "issue_dmca_takedown",
            "negotiate_bulk_license",
        ]
    ),
}


class ActionLogger:
    """Immutable log of all agent actions."""
    
    def __init__(self, db: Session):
        self.db = db
        self._actions: List[AgentAction] = []  # In-memory for now
    
    def log_action(self, action: AgentAction) -> str:
        """Log an agent action."""
        self._actions.append(action)
        
        logger.info(
            f"AGENT_ACTION: {action.agent_type.value} "
            f"action={action.action_type} "
            f"target={action.target_entity}:{action.target_id} "
            f"risk={action.risk_level.value} "
            f"confidence={action.confidence:.2f}"
        )
        
        return action.action_id
    
    def get_actions(
        self,
        agent_type: Optional[AgentType] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get logged actions."""
        actions = self._actions
        
        if agent_type:
            actions = [a for a in actions if a.agent_type == agent_type]
        
        return [a.to_dict() for a in actions[-limit:]]


class BaseAgent:
    """Base class for all specialist agents."""
    
    def __init__(
        self,
        db: Session,
        action_logger: ActionLogger,
        agent_type: AgentType
    ):
        self.db = db
        self.action_logger = action_logger
        self.agent_type = agent_type
        self.policy = AGENT_POLICIES.get(agent_type)
    
    def _create_action(
        self,
        action_type: str,
        target_entity: str,
        target_id: Optional[int],
        inputs: Dict[str, Any],
        reasoning: str,
        confidence: float = 0.0
    ) -> AgentAction:
        """Create an action record."""
        risk_level = self._assess_risk(action_type)
        requires_approval = self.policy.needs_approval(action_type) if self.policy else False
        
        return AgentAction(
            action_id=str(uuid.uuid4()),
            agent_type=self.agent_type,
            action_type=action_type,
            target_entity=target_entity,
            target_id=target_id,
            inputs=inputs,
            reasoning=reasoning,
            confidence=confidence,
            risk_level=risk_level,
            requires_approval=requires_approval
        )
    
    def _assess_risk(self, action_type: str) -> ActionRisk:
        """Assess risk level of an action."""
        high_risk_actions = {
            "suspend_account", "restrict_monetization", 
            "payout_over_1000", "manual_trust_score_override"
        }
        critical_actions = {
            "permanently_ban_account", "platform_wide_alert",
            "emergency_broadcast_takeover"
        }
        medium_risk_actions = {
            "apply_temporary_restriction", "flag_suspicious_activity",
            "feature_event_on_homepage"
        }
        
        if action_type in critical_actions:
            return ActionRisk.CRITICAL
        elif action_type in high_risk_actions:
            return ActionRisk.HIGH
        elif action_type in medium_risk_actions:
            return ActionRisk.MEDIUM
        return ActionRisk.LOW
    
    def _can_execute(self, action_type: str) -> bool:
        """Check if agent can execute this action."""
        if not self.policy:
            return False
        return self.policy.is_allowed(action_type)
    
    async def execute(
        self,
        action_type: str,
        target_entity: str,
        target_id: Optional[int],
        inputs: Dict[str, Any],
        reasoning: str,
        confidence: float = 0.0
    ) -> Dict:
        """Execute an action with policy checks and logging."""
        
        # Check policy
        if not self._can_execute(action_type):
            return {
                "success": False,
                "error": f"Action '{action_type}' not allowed for {self.agent_type.value}",
                "policy_violation": True
            }
        
        # Create action record
        action = self._create_action(
            action_type=action_type,
            target_entity=target_entity,
            target_id=target_id,
            inputs=inputs,
            reasoning=reasoning,
            confidence=confidence
        )
        
        # Check if approval required
        if action.requires_approval:
            action.outputs = {"status": "pending_approval"}
            self.action_logger.log_action(action)
            return {
                "success": True,
                "action_id": action.action_id,
                "requires_approval": True,
                "message": f"Action queued for human approval"
            }
        
        # Execute action
        try:
            result = await self._execute_action(action)
            action.outputs = result
            self.action_logger.log_action(action)
            return {
                "success": True,
                "action_id": action.action_id,
                "result": result
            }
        except Exception as e:
            logger.error(f"Agent action failed: {e}")
            action.outputs = {"error": str(e)}
            self.action_logger.log_action(action)
            return {
                "success": False,
                "action_id": action.action_id,
                "error": str(e)
            }
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        """Override in subclasses to implement specific actions."""
        raise NotImplementedError


class ModerationAgent(BaseAgent):
    """Agent for content moderation tasks."""
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.MODERATION)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "flag_content_for_review":
            # Logic to flag content
            return {"flagged": True, "queue_position": 1}
        
        elif action.action_type == "send_warning_to_creator":
            # Logic to send warning
            return {"warning_sent": True}
        
        elif action.action_type == "apply_temporary_restriction":
            # Logic for temp restriction (max 24 hours)
            duration = min(action.inputs.get("duration_hours", 1), 24)
            return {"restricted": True, "duration_hours": duration}
        
        return {"executed": True}


class DiscoveryAgent(BaseAgent):
    """Agent for event discovery and stream ranking."""
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.DISCOVERY)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "cluster_streams_by_location":
            # Logic for geo-clustering
            return {"clusters_formed": 0, "events_detected": 0}
        
        elif action.action_type == "rank_streams_for_homepage":
            # Logic for stream ranking
            return {"streams_ranked": 0}
        
        elif action.action_type == "detect_breaking_news":
            # Logic for news detection
            return {"breaking_news_detected": False}
        
        return {"executed": True}


class TrustAgent(BaseAgent):
    """Agent for trust score and verification."""
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.TRUST)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "calculate_trust_score":
            from .trust_score import get_trust_score_engine
            engine = get_trust_score_engine(self.db)
            user_id = action.target_id
            result = await engine.calculate_trust_score(user_id)
            return result
        
        elif action.action_type == "recommend_verification_steps":
            # Get recommendations for improving trust score
            return {"recommendations": [
                "Complete identity verification",
                "Link payment method",
                "Start streaming regularly"
            ]}
        
        return {"executed": True}


class EmergencyAgent(BaseAgent):
    """
    Agent for crisis and emergency situations.
    
    Handles:
    - Breaking news/crisis detection
    - Emergency stream prioritization
    - Authority notification
    - Platform-wide alerts (requires approval)
    """
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.EMERGENCY)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "activate_crisis_mode":
            # Activate crisis mode for an event or location
            event_id = action.inputs.get("event_id")
            location = action.inputs.get("location")
            crisis_type = action.inputs.get("crisis_type", "unspecified")
            
            from .models import Event, Stream
            
            # Find affected streams
            affected_streams = []
            if event_id:
                event = self.db.query(Event).filter(Event.id == event_id).first()
                if event:
                    streams = self.db.query(Stream).filter(
                        Stream.event_id == event_id,
                        Stream.status == "live"
                    ).all()
                    affected_streams = [s.id for s in streams]
            
            return {
                "crisis_mode_activated": True,
                "crisis_type": crisis_type,
                "affected_streams": affected_streams,
                "timestamp": datetime.utcnow().isoformat(),
                "priority_level": "high"
            }
        
        elif action.action_type == "priority_route_emergency_streams":
            # Boost emergency-related streams in discovery
            stream_ids = action.inputs.get("stream_ids", [])
            priority_boost = action.inputs.get("priority_boost", 100)
            
            return {
                "streams_prioritized": len(stream_ids),
                "priority_boost": priority_boost,
                "duration_minutes": 60
            }
        
        elif action.action_type == "notify_authorities":
            # Log notification to authorities (in production, would integrate with APIs)
            authority_type = action.inputs.get("authority_type", "general")
            location = action.inputs.get("location")
            description = action.inputs.get("description")
            
            # Would integrate with emergency services API in production
            logger.warning(
                f"AUTHORITY_NOTIFICATION: type={authority_type} "
                f"location={location} desc={description}"
            )
            
            return {
                "notification_logged": True,
                "authority_type": authority_type,
                "requires_manual_followup": True,
                "reference_id": str(uuid.uuid4())[:8]
            }
        
        elif action.action_type == "suspend_monetization_during_crisis":
            # Temporarily suspend monetization for crisis-related streams
            stream_ids = action.inputs.get("stream_ids", [])
            
            return {
                "monetization_suspended": True,
                "affected_streams": len(stream_ids),
                "reason": "crisis_response",
                "auto_restore_after_hours": 24
            }
        
        return {"executed": True}
    
    async def detect_crisis(self, event_id: int = None, keywords: List[str] = None) -> Dict:
        """
        Analyze streams for potential crisis situations.
        Uses content signals and viewer behavior patterns.
        """
        crisis_indicators = []
        confidence = 0.0
        
        # Check for crisis keywords in stream titles/descriptions
        if keywords:
            crisis_keywords = {"emergency", "fire", "shooting", "evacuate", "help", "danger"}
            matching = set(keywords) & crisis_keywords
            if matching:
                crisis_indicators.append(f"keywords_detected: {matching}")
                confidence += 0.3
        
        # Would add more sophisticated detection in production:
        # - Sudden viewer spike
        # - High chat activity with crisis keywords
        # - Multiple streams from same location
        # - Social media cross-reference
        
        return {
            "crisis_detected": confidence > 0.5,
            "confidence": confidence,
            "indicators": crisis_indicators,
            "recommendation": "monitor" if confidence < 0.5 else "activate_crisis_mode"
        }


class PayoutAgent(BaseAgent):
    """
    Agent for autonomous payout processing.
    
    Handles:
    - Automatic payout eligibility assessment
    - Payout initiation (under $1000)
    - Fraud detection and flagging
    - Tax report generation
    
    Cannot:
    - Process payouts over $1000 (requires approval)
    - Override fraud holds
    - Modify revenue share settings
    """
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.PAYOUT)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "calculate_earnings":
            user_id = action.target_id
            
            from .models import User, Transaction
            from decimal import Decimal
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"error": "User not found"}
            
            # Calculate earnings breakdown
            total_earnings = Decimal(str(user.lifetime_earnings or 0))
            available_balance = Decimal(str(user.balance or 0))
            pending_payout = Decimal(str(user.pending_payout or 0))
            
            # Get recent transactions
            recent_tx = self.db.query(Transaction).filter(
                Transaction.user_id == user_id
            ).order_by(Transaction.created_at.desc()).limit(10).all()
            
            return {
                "user_id": user_id,
                "lifetime_earnings": float(total_earnings),
                "available_balance": float(available_balance),
                "pending_payout": float(pending_payout),
                "recent_transactions": len(recent_tx),
                "can_payout": available_balance >= Decimal("1.00")
            }
        
        elif action.action_type == "initiate_payout_under_1000":
            user_id = action.target_id
            amount = action.inputs.get("amount")
            
            if amount and amount >= 1000:
                return {
                    "error": "Amount exceeds agent limit. Requires human approval.",
                    "requires_approval": True
                }
            
            # Use instant payout service
            from .instant_payout import get_instant_payout_service
            from decimal import Decimal
            
            service = get_instant_payout_service(self.db)
            
            try:
                result = await service.request_instant_payout(
                    user_id=user_id,
                    amount=Decimal(str(amount)) if amount else None,
                    speed="standard"  # Agent uses standard to minimize fees
                )
                return {
                    "payout_initiated": True,
                    "payout_id": result.get("payout_id"),
                    "amount": result.get("amount"),
                    "estimated_arrival": result.get("estimated_arrival")
                }
            except Exception as e:
                return {"error": str(e), "payout_initiated": False}
        
        elif action.action_type == "flag_suspicious_activity":
            user_id = action.target_id
            reason = action.inputs.get("reason", "Unusual activity pattern")
            
            from .models import User
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                # Flag for review (would set a flag in production)
                logger.warning(
                    f"FRAUD_FLAG: user_id={user_id} reason={reason}"
                )
            
            return {
                "flagged": True,
                "user_id": user_id,
                "reason": reason,
                "review_required": True
            }
        
        elif action.action_type == "generate_tax_report":
            user_id = action.target_id
            year = action.inputs.get("year", datetime.utcnow().year)
            
            from .models import Transaction
            from sqlalchemy import extract
            
            # Get all completed transactions for the year
            transactions = self.db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.status == "completed",
                extract('year', Transaction.created_at) == year
            ).all()
            
            total_earnings = sum(t.net_amount or 0 for t in transactions)
            total_fees = sum(t.fee or 0 for t in transactions)
            
            return {
                "report_generated": True,
                "user_id": user_id,
                "tax_year": year,
                "total_earnings": total_earnings,
                "total_fees": total_fees,
                "transaction_count": len(transactions),
                "format": "summary"  # Would generate PDF in production
            }
        
        return {"executed": True}
    
    async def assess_payout_eligibility(self, user_id: int) -> Dict:
        """
        Assess whether a user is eligible for automatic payout.
        Checks balance, account status, and fraud indicators.
        """
        from .models import User
        from decimal import Decimal
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"eligible": False, "reason": "User not found"}
        
        checks = {
            "has_stripe_account": bool(user.stripe_account_id),
            "payout_enabled": bool(user.payout_enabled),
            "above_minimum": Decimal(str(user.balance or 0)) >= Decimal("1.00"),
            "not_banned": not user.is_banned,
            "verified": bool(user.is_verified)
        }
        
        all_passed = all(checks.values())
        
        return {
            "eligible": all_passed,
            "checks": checks,
            "available_balance": float(user.balance or 0),
            "recommendation": "proceed" if all_passed else "manual_review"
        }


class LicensingAgent(BaseAgent):
    """
    Agent for content rights and licensing management.
    
    Handles:
    - Copyrighted music detection
    - Content ownership verification
    - License request generation
    - Syndication rights management
    - DMCA compliance
    
    Cannot:
    - Auto-approve licenses
    - Modify content directly
    - Access payment data
    """
    
    def __init__(self, db: Session, action_logger: ActionLogger):
        super().__init__(db, action_logger, AgentType.LICENSING)
    
    async def _execute_action(self, action: AgentAction) -> Dict:
        if action.action_type == "check_content_rights":
            stream_id = action.target_id
            
            from .models import Stream
            
            stream = self.db.query(Stream).filter(Stream.id == stream_id).first()
            if not stream:
                return {"error": "Stream not found"}
            
            # In production, would integrate with content ID systems
            rights_check = {
                "has_music": False,
                "copyrighted_detected": False,
                "license_required": False,
                "owner_verified": True,
            }
            
            return {
                "stream_id": stream_id,
                "rights_clear": not rights_check["copyrighted_detected"],
                "details": rights_check,
                "recommendation": "proceed" if not rights_check["license_required"] else "request_license"
            }
        
        elif action.action_type == "detect_copyrighted_music":
            stream_id = action.target_id
            
            # In production, would use audio fingerprinting (ACRCloud, Audible Magic)
            # Placeholder detection logic
            detected_tracks = []
            
            return {
                "stream_id": stream_id,
                "tracks_detected": len(detected_tracks),
                "tracks": detected_tracks,
                "action_required": len(detected_tracks) > 0,
                "recommendation": "mute_audio" if detected_tracks else "none"
            }
        
        elif action.action_type == "generate_license_request":
            content_id = action.inputs.get("content_id")
            license_type = action.inputs.get("license_type", "streaming")
            duration = action.inputs.get("duration_days", 365)
            
            # Generate license request document
            request_id = str(uuid.uuid4())[:8]
            
            return {
                "request_id": request_id,
                "content_id": content_id,
                "license_type": license_type,
                "duration_days": duration,
                "status": "pending_review",
                "estimated_cost": None,  # Would calculate based on content type
                "created_at": datetime.utcnow().isoformat()
            }
        
        elif action.action_type == "track_usage_metrics":
            content_id = action.inputs.get("content_id")
            
            # Track content usage for royalty calculations
            # In production, would aggregate view counts, duration, etc.
            
            return {
                "content_id": content_id,
                "total_views": 0,
                "total_minutes": 0,
                "unique_streams": 0,
                "period": "last_30_days",
                "royalty_estimate": 0.0
            }
        
        elif action.action_type == "verify_media_ownership":
            user_id = action.target_id
            media_hash = action.inputs.get("media_hash")
            
            # Verify user owns the content they're streaming
            # In production, would check against registered content hashes
            
            return {
                "user_id": user_id,
                "media_hash": media_hash,
                "ownership_verified": True,  # Placeholder
                "verification_method": "hash_comparison",
                "confidence": 0.95
            }
        
        return {"executed": True}
    
    async def analyze_stream_for_licensing(self, stream_id: int) -> Dict:
        """
        Comprehensive licensing analysis for a stream.
        Checks music, ownership, and generates recommendations.
        """
        results = {
            "stream_id": stream_id,
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "issues": [],
            "recommendations": [],
            "clear_to_monetize": True
        }
        
        # Check content rights
        rights_result = await self.execute(
            "check_content_rights",
            "stream",
            stream_id,
            {},
            "Automated licensing analysis",
            0.9
        )
        
        if not rights_result.get("result", {}).get("rights_clear", True):
            results["issues"].append("Content rights unclear")
            results["clear_to_monetize"] = False
        
        # Check for copyrighted music
        music_result = await self.execute(
            "detect_copyrighted_music",
            "stream",
            stream_id,
            {},
            "Music detection for licensing",
            0.9
        )
        
        if music_result.get("result", {}).get("tracks_detected", 0) > 0:
            results["issues"].append("Copyrighted music detected")
            results["recommendations"].append("Request music license or use royalty-free music")
            results["clear_to_monetize"] = False
        
        if results["clear_to_monetize"]:
            results["recommendations"].append("Stream cleared for full monetization")
        
        return results


class OrchestratorAgent:
    """
    Central orchestrator that routes requests to specialist agents.
    
    Responsibilities:
    - Route requests to appropriate specialist agents
    - Enforce cross-agent policies
    - Manage approval workflows
    - Aggregate results from multiple agents
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.action_logger = ActionLogger(db)
        
        # Initialize specialist agents
        self.agents = {
            AgentType.MODERATION: ModerationAgent(db, self.action_logger),
            AgentType.DISCOVERY: DiscoveryAgent(db, self.action_logger),
            AgentType.TRUST: TrustAgent(db, self.action_logger),
            AgentType.EMERGENCY: EmergencyAgent(db, self.action_logger),
            AgentType.PAYOUT: PayoutAgent(db, self.action_logger),
            AgentType.LICENSING: LicensingAgent(db, self.action_logger),
        }
    
    async def route(
        self,
        agent_type: AgentType,
        action_type: str,
        target_entity: str,
        target_id: Optional[int],
        inputs: Dict[str, Any],
        reasoning: str,
        confidence: float = 0.0
    ) -> Dict:
        """Route a request to the appropriate specialist agent."""
        
        agent = self.agents.get(agent_type)
        if not agent:
            return {
                "success": False,
                "error": f"Unknown agent type: {agent_type.value}"
            }
        
        return await agent.execute(
            action_type=action_type,
            target_entity=target_entity,
            target_id=target_id,
            inputs=inputs,
            reasoning=reasoning,
            confidence=confidence
        )
    
    def get_action_log(
        self,
        agent_type: Optional[AgentType] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get action log from all agents."""
        return self.action_logger.get_actions(agent_type, limit)
    
    async def process_approval(
        self,
        action_id: str,
        approved: bool,
        approver_id: str,
        notes: Optional[str] = None
    ) -> Dict:
        """Process a human approval for a pending action."""
        # Find pending action
        for action in self.action_logger._actions:
            if action.action_id == action_id:
                if approved:
                    action.approved_by = approver_id
                    action.approved_at = datetime.utcnow()
                    action.outputs["approval_status"] = "approved"
                    action.outputs["approval_notes"] = notes
                    return {"success": True, "status": "approved"}
                else:
                    action.outputs["approval_status"] = "rejected"
                    action.outputs["rejection_notes"] = notes
                    return {"success": True, "status": "rejected"}
        
        return {"success": False, "error": "Action not found"}
    
    async def multi_agent_workflow(
        self,
        workflow_type: str,
        target_id: int,
        context: Dict[str, Any]
    ) -> Dict:
        """
        Execute a multi-agent workflow that coordinates multiple specialists.
        
        Example workflows:
        - new_creator_onboarding: Trust + Payout agents
        - crisis_response: Emergency + Moderation + Discovery agents
        - creator_payout: Payout + Trust agents
        """
        results = {}
        
        if workflow_type == "new_creator_onboarding":
            # Trust agent calculates initial score
            trust_result = await self.route(
                AgentType.TRUST,
                "calculate_trust_score",
                "user",
                target_id,
                {},
                "New creator onboarding - initial trust assessment"
            )
            results["trust"] = trust_result
            
            # Get verification recommendations
            verify_result = await self.route(
                AgentType.TRUST,
                "recommend_verification_steps",
                "user",
                target_id,
                {},
                "Recommend next steps for new creator"
            )
            results["verification"] = verify_result
            
        elif workflow_type == "creator_payout":
            # Check earnings first
            earnings_result = await self.route(
                AgentType.PAYOUT,
                "calculate_earnings",
                "user",
                target_id,
                {},
                "Pre-payout earnings check"
            )
            results["earnings"] = earnings_result
            
            # Check trust score
            trust_result = await self.route(
                AgentType.TRUST,
                "calculate_trust_score",
                "user",
                target_id,
                {},
                "Trust check for payout eligibility"
            )
            results["trust"] = trust_result
            
            # Only proceed if trust score is adequate
            if trust_result.get("result", {}).get("score", 0) >= 25:
                if earnings_result.get("result", {}).get("can_payout"):
                    payout_result = await self.route(
                        AgentType.PAYOUT,
                        "initiate_payout_under_1000",
                        "user",
                        target_id,
                        {"amount": context.get("amount")},
                        "Automated payout after trust/earnings check"
                    )
                    results["payout"] = payout_result
        
        elif workflow_type == "crisis_response":
            # Activate crisis mode
            crisis_result = await self.route(
                AgentType.EMERGENCY,
                "activate_crisis_mode",
                "event",
                target_id,
                context,
                "Crisis response workflow initiated"
            )
            results["crisis"] = crisis_result
            
            # Prioritize emergency streams
            if crisis_result.get("result", {}).get("affected_streams"):
                priority_result = await self.route(
                    AgentType.EMERGENCY,
                    "priority_route_emergency_streams",
                    "streams",
                    None,
                    {"stream_ids": crisis_result["result"]["affected_streams"]},
                    "Boost visibility of crisis streams"
                )
                results["priority"] = priority_result
        
        return {
            "workflow": workflow_type,
            "target_id": target_id,
            "results": results,
            "completed_at": datetime.utcnow().isoformat()
        }


def get_orchestrator(db: Session) -> OrchestratorAgent:
    """Factory function to get OrchestratorAgent instance."""
    return OrchestratorAgent(db)

