"""
Streamura Human-in-the-Loop (HITL) Service

Provides approval gates for critical autonomous agent decisions.
Ensures human oversight for high-impact actions.

Categories requiring HITL approval:
- Account termination/bans
- High-value payouts (>$10,000)
- Content removal with legal implications
- Emergency system actions
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import AgentDecision, HITLApprovalQueue, User

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

# Timeout settings
DEFAULT_APPROVAL_TIMEOUT_HOURS = 24
URGENT_APPROVAL_TIMEOUT_HOURS = 2
CRITICAL_APPROVAL_TIMEOUT_MINUTES = 30

# Thresholds for automatic HITL triggers
PAYOUT_HITL_THRESHOLD = Decimal("10000.00")  # $10k+ requires approval
BAN_REQUIRES_APPROVAL = True  # All permanent bans require approval
CONTENT_REMOVAL_REQUIRES_APPROVAL = True  # Stream terminations require approval


class ApprovalPriority(Enum):
    """Priority levels for HITL approvals"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ApprovalCategory(Enum):
    """Categories of actions requiring HITL approval"""
    ACCOUNT_ACTION = "account_action"  # Bans, suspensions
    PAYOUT = "payout"  # Large financial transactions
    CONTENT_REMOVAL = "content_removal"  # Stream termination, video removal
    LEGAL = "legal"  # DMCA, legal requests
    EMERGENCY = "emergency"  # Emergency system actions
    DATA_DELETION = "data_deletion"  # GDPR deletion requests


class ApprovalStatus(Enum):
    """Status of HITL approval items"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    EXPIRED = "expired"


@dataclass
class ApprovalRequest:
    """Request for HITL approval"""
    agent_name: str
    action_type: str
    target_type: str
    target_id: int
    reasoning: str
    confidence: float
    priority: ApprovalPriority = ApprovalPriority.NORMAL
    category: ApprovalCategory = ApprovalCategory.ACCOUNT_ACTION
    factors: Optional[Dict[str, Any]] = None
    input_snapshot: Optional[Dict[str, Any]] = None
    timeout_hours: Optional[int] = None


@dataclass
class ApprovalResult:
    """Result of an approval decision"""
    decision_id: int
    approved: bool
    approver_id: int
    notes: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class HITLService:
    """
    Human-in-the-Loop approval service.
    
    Provides a queue-based system for human review of critical
    agent decisions before they are executed.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def requires_approval(
        self,
        action_type: str,
        target_type: str,
        context: Dict[str, Any]
    ) -> Tuple[bool, Optional[ApprovalCategory], Optional[ApprovalPriority]]:
        """
        Determine if an action requires HITL approval.
        
        Args:
            action_type: Type of action (e.g., 'ban_user', 'terminate_stream')
            target_type: Type of target (e.g., 'user', 'stream')
            context: Additional context (e.g., amount for payouts)
            
        Returns:
            Tuple of (requires_approval, category, priority)
        """
        # Account actions
        if action_type in ["ban_user", "perm_ban", "terminate_account"]:
            return True, ApprovalCategory.ACCOUNT_ACTION, ApprovalPriority.HIGH
        
        # Temporary suspensions for verified/high-value creators
        if action_type == "suspend_user":
            trust_score = context.get("trust_score", 0)
            if trust_score > 0.8:
                return True, ApprovalCategory.ACCOUNT_ACTION, ApprovalPriority.HIGH
        
        # Large payouts (large amounts are high-priority by definition)
        if action_type in ["approve_payout", "instant_payout", "process_payout"]:
            amount = Decimal(str(context.get("amount", 0)))
            if amount >= PAYOUT_HITL_THRESHOLD:
                return True, ApprovalCategory.PAYOUT, ApprovalPriority.HIGH
        
        # Content removal
        if action_type in ["terminate_stream", "remove_video", "delete_content"]:
            # Check if it's a verified creator or high-viewer stream
            is_verified = context.get("is_verified", False)
            viewer_count = context.get("viewer_count", 0)
            if is_verified or viewer_count > 1000:
                return True, ApprovalCategory.CONTENT_REMOVAL, ApprovalPriority.URGENT
            return True, ApprovalCategory.CONTENT_REMOVAL, ApprovalPriority.NORMAL
        
        # Legal requests
        if action_type in ["dmca_takedown", "legal_request", "law_enforcement"]:
            return True, ApprovalCategory.LEGAL, ApprovalPriority.HIGH
        
        # Data deletion (GDPR)
        if action_type in ["delete_user_data", "gdpr_erasure"]:
            return True, ApprovalCategory.DATA_DELETION, ApprovalPriority.NORMAL
        
        # Emergency actions
        if action_type in ["emergency_shutdown", "platform_alert"]:
            return True, ApprovalCategory.EMERGENCY, ApprovalPriority.URGENT
        
        return False, None, None
    
    async def create_approval_request(
        self,
        request: ApprovalRequest
    ) -> Tuple[AgentDecision, HITLApprovalQueue]:
        """
        Create a new HITL approval request.
        
        Args:
            request: ApprovalRequest with details
            
        Returns:
            Tuple of (AgentDecision, HITLApprovalQueue)
        """
        # Calculate timeout
        if request.priority == ApprovalPriority.URGENT:
            timeout_hours = URGENT_APPROVAL_TIMEOUT_HOURS
        elif request.priority == ApprovalPriority.HIGH:
            timeout_hours = DEFAULT_APPROVAL_TIMEOUT_HOURS / 2
        else:
            timeout_hours = DEFAULT_APPROVAL_TIMEOUT_HOURS
        
        if request.timeout_hours:
            timeout_hours = request.timeout_hours
        
        timeout_at = datetime.utcnow() + timedelta(hours=timeout_hours)
        
        # Create agent decision record
        decision = AgentDecision(
            agent_name=request.agent_name,
            action_type=request.action_type,
            action_category=request.category.value,
            target_type=request.target_type,
            target_id=request.target_id,
            reasoning=request.reasoning,
            factors=request.factors,
            confidence=request.confidence,
            input_snapshot=request.input_snapshot,
            requires_approval=True,
            approval_category=request.category.value,
            status="pending",
        )
        self.db.add(decision)
        self.db.flush()  # Get the ID
        
        # Create queue item
        queue_item = HITLApprovalQueue(
            decision_id=decision.id,
            priority=request.priority.value,
            category=request.category.value,
            timeout_at=timeout_at,
            status="pending",
        )
        self.db.add(queue_item)
        self.db.commit()
        
        self.db.refresh(decision)
        self.db.refresh(queue_item)
        
        logger.info(f"Created HITL approval request: decision_id={decision.id}, action={request.action_type}")
        
        # TODO: Send WebSocket notification to admins
        
        return decision, queue_item
    
    async def get_pending_approvals(
        self,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get pending approval items from the queue.
        
        Returns list of approval items with full decision details.
        """
        query = self.db.query(HITLApprovalQueue).filter(
            HITLApprovalQueue.status.in_(["pending", "assigned", "reviewing"])
        )
        
        if category:
            query = query.filter(HITLApprovalQueue.category == category)
        
        if priority:
            query = query.filter(HITLApprovalQueue.priority == priority)
        
        # Order by priority and creation time
        priority_order = {
            "urgent": 0,
            "high": 1,
            "normal": 2,
            "low": 3,
        }
        
        items = query.order_by(
            HITLApprovalQueue.priority.asc(),  # urgent first
            HITLApprovalQueue.created_at.asc()  # oldest first
        ).offset(offset).limit(limit).all()
        
        result = []
        for item in items:
            decision = self.db.query(AgentDecision).filter(
                AgentDecision.id == item.decision_id
            ).first()
            
            if decision:
                result.append({
                    "queue_id": item.id,
                    "decision_id": decision.id,
                    "agent_name": decision.agent_name,
                    "action_type": decision.action_type,
                    "target_type": decision.target_type,
                    "target_id": decision.target_id,
                    "reasoning": decision.reasoning,
                    "confidence": decision.confidence,
                    "factors": decision.factors,
                    "priority": item.priority,
                    "category": item.category,
                    "status": item.status,
                    "timeout_at": item.timeout_at.isoformat() if item.timeout_at else None,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "assigned_to": item.assigned_to,
                })
        
        return result
    
    async def assign_approval(
        self,
        queue_id: int,
        assignee_id: int
    ) -> Optional[HITLApprovalQueue]:
        """Assign an approval item to a specific admin."""
        item = self.db.query(HITLApprovalQueue).filter(
            HITLApprovalQueue.id == queue_id
        ).first()
        
        if not item:
            return None
        
        item.assigned_to = assignee_id
        item.assigned_at = datetime.utcnow()
        item.status = "assigned"
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    async def approve_decision(
        self,
        decision_id: int,
        approver_id: int,
        notes: Optional[str] = None
    ) -> Optional[AgentDecision]:
        """
        Approve an agent decision.
        
        Args:
            decision_id: ID of the decision to approve
            approver_id: ID of the approving admin
            notes: Optional approval notes
            
        Returns:
            Updated AgentDecision
        """
        decision = self.db.query(AgentDecision).filter(
            AgentDecision.id == decision_id
        ).first()
        
        if not decision:
            return None
        
        decision.approved = True
        decision.approved_by = approver_id
        decision.approved_at = datetime.utcnow()
        decision.approval_notes = notes
        decision.status = "approved"
        
        # Update queue item
        queue_item = self.db.query(HITLApprovalQueue).filter(
            HITLApprovalQueue.decision_id == decision_id
        ).first()
        
        if queue_item:
            queue_item.status = "completed"
            queue_item.completed_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(decision)
        
        logger.info(f"Decision {decision_id} approved by user {approver_id}")
        
        return decision
    
    async def reject_decision(
        self,
        decision_id: int,
        rejector_id: int,
        notes: Optional[str] = None
    ) -> Optional[AgentDecision]:
        """
        Reject an agent decision.
        
        Args:
            decision_id: ID of the decision to reject
            rejector_id: ID of the rejecting admin
            notes: Required rejection notes (reason)
            
        Returns:
            Updated AgentDecision
        """
        decision = self.db.query(AgentDecision).filter(
            AgentDecision.id == decision_id
        ).first()
        
        if not decision:
            return None
        
        decision.approved = False
        decision.approved_by = rejector_id
        decision.approved_at = datetime.utcnow()
        decision.approval_notes = notes
        decision.status = "rejected"
        
        # Update queue item
        queue_item = self.db.query(HITLApprovalQueue).filter(
            HITLApprovalQueue.decision_id == decision_id
        ).first()
        
        if queue_item:
            queue_item.status = "completed"
            queue_item.completed_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(decision)
        
        logger.info(f"Decision {decision_id} rejected by user {rejector_id}")
        
        return decision
    
    async def execute_approved_decision(
        self,
        decision_id: int
    ) -> Dict[str, Any]:
        """
        Execute a previously approved decision.
        
        This should be called after approval to actually perform the action.
        """
        decision = self.db.query(AgentDecision).filter(
            AgentDecision.id == decision_id,
            AgentDecision.approved == True,
            AgentDecision.status == "approved"
        ).first()
        
        if not decision:
            return {"error": "Decision not found or not approved"}
        
        try:
            # Route to appropriate action executor
            result = await self._execute_action(
                action_type=decision.action_type,
                target_type=decision.target_type,
                target_id=decision.target_id,
                context=decision.input_snapshot or {}
            )
            
            decision.status = "executed"
            decision.executed_at = datetime.utcnow()
            decision.execution_result = result
            
            self.db.commit()
            
            logger.info(f"Decision {decision_id} executed successfully")
            return result
            
        except Exception as e:
            decision.status = "failed"
            decision.error_message = str(e)
            self.db.commit()
            
            logger.error(f"Decision {decision_id} execution failed: {e}")
            return {"error": str(e)}
    
    async def _execute_action(
        self,
        action_type: str,
        target_type: str,
        target_id: int,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute the actual action (placeholder for integration)."""
        # This would integrate with the actual services
        # For now, return a success placeholder
        return {
            "success": True,
            "action_type": action_type,
            "target_type": target_type,
            "target_id": target_id,
            "executed_at": datetime.utcnow().isoformat(),
        }
    
    async def check_timeouts(self) -> List[Dict[str, Any]]:
        """
        Check for timed-out approvals and escalate.
        Should be called periodically (e.g., every 5 minutes).
        """
        now = datetime.utcnow()
        
        expired = self.db.query(HITLApprovalQueue).filter(
            HITLApprovalQueue.status.in_(["pending", "assigned"]),
            HITLApprovalQueue.timeout_at < now
        ).all()
        
        escalated = []
        for item in expired:
            item.escalation_level += 1
            
            if item.escalation_level >= 3:
                item.status = "expired"
                logger.warning(f"HITL item {item.id} expired after 3 escalations")
            else:
                # Extend timeout and notify
                item.timeout_at = now + timedelta(hours=URGENT_APPROVAL_TIMEOUT_HOURS)
                item.status = "escalated"
                logger.warning(f"HITL item {item.id} escalated to level {item.escalation_level}")
            
            escalated.append({
                "queue_id": item.id,
                "decision_id": item.decision_id,
                "escalation_level": item.escalation_level,
                "status": item.status,
            })
        
        if escalated:
            self.db.commit()
        
        return escalated
    
    async def get_decision_audit_trail(
        self,
        agent_name: Optional[str] = None,
        action_type: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Query the agent decision audit trail.
        
        Used for compliance reporting and debugging.
        """
        query = self.db.query(AgentDecision)
        
        if agent_name:
            query = query.filter(AgentDecision.agent_name == agent_name)
        if action_type:
            query = query.filter(AgentDecision.action_type == action_type)
        if target_type:
            query = query.filter(AgentDecision.target_type == target_type)
        if target_id:
            query = query.filter(AgentDecision.target_id == target_id)
        if start_date:
            query = query.filter(AgentDecision.created_at >= start_date)
        if end_date:
            query = query.filter(AgentDecision.created_at <= end_date)
        
        decisions = query.order_by(
            AgentDecision.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        return [
            {
                "id": d.id,
                "agent_name": d.agent_name,
                "action_type": d.action_type,
                "action_category": d.action_category,
                "target_type": d.target_type,
                "target_id": d.target_id,
                "reasoning": d.reasoning,
                "confidence": d.confidence,
                "requires_approval": d.requires_approval,
                "approved": d.approved,
                "approved_by": d.approved_by,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "executed_at": d.executed_at.isoformat() if d.executed_at else None,
            }
            for d in decisions
        ]


def get_hitl_service(db: Session) -> HITLService:
    """Factory function to get HITLService instance."""
    return HITLService(db)
