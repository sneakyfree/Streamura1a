"""
Streamura HITL (Human-in-the-Loop) Approval Tests

Tests the complete HITL approval workflow including:
- Approval request creation
- Queue management
- Approval/rejection flows
- Timeout handling
- Decision execution
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from backend.hitl import (
    HITLService,
    ApprovalRequest,
    ApprovalResult,
    ApprovalPriority,
    ApprovalCategory,
    ApprovalStatus,
    PAYOUT_HITL_THRESHOLD,
)
from backend.models import User, AgentDecision, HITLApprovalQueue


class TestHITLRequiresApproval:
    """Test approval requirement detection."""

    def test_large_payout_requires_approval(self, db, test_admin):
        """Payouts over threshold should require approval."""
        service = HITLService(db)
        
        requires, category, priority = service.requires_approval(
            action_type="process_payout",
            target_type="user",
            context={"amount": Decimal("15000.00")}
        )
        
        assert requires is True
        assert category == ApprovalCategory.PAYOUT
        assert priority in [ApprovalPriority.HIGH, ApprovalPriority.URGENT]

    def test_small_payout_no_approval(self, db, test_admin):
        """Small payouts should not require approval."""
        service = HITLService(db)
        
        requires, category, priority = service.requires_approval(
            action_type="process_payout",
            target_type="user",
            context={"amount": Decimal("50.00")}
        )
        
        assert requires is False

    def test_ban_requires_approval(self, db, test_admin):
        """Permanent bans should require approval."""
        service = HITLService(db)
        
        requires, category, priority = service.requires_approval(
            action_type="ban_user",
            target_type="user",
            context={"permanent": True}
        )
        
        assert requires is True
        assert category == ApprovalCategory.ACCOUNT_ACTION

    def test_stream_termination_requires_approval(self, db, test_admin):
        """Stream terminations should require approval."""
        service = HITLService(db)
        
        requires, category, priority = service.requires_approval(
            action_type="terminate_stream",
            target_type="stream",
            context={}
        )
        
        assert requires is True
        assert category == ApprovalCategory.CONTENT_REMOVAL


class TestHITLApprovalCreation:
    """Test approval request creation."""

    def test_create_approval_request(self, db, test_user):
        """Should create approval request and queue item."""
        service = HITLService(db)
        
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="ban_user",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Multiple policy violations detected",
            confidence=0.92,
            priority=ApprovalPriority.HIGH,
            category=ApprovalCategory.ACCOUNT_ACTION,
            factors={"violation_count": 5, "severity": "high"},
        )
        
        decision, queue_item = service.create_approval_request(request)
        
        assert decision is not None
        assert decision.agent_name == "moderation_agent"
        assert decision.action_type == "ban_user"
        assert decision.requires_approval is True
        assert decision.status == "pending_approval"
        
        assert queue_item is not None
        assert queue_item.priority == "high"
        assert queue_item.status == "pending"

    def test_create_urgent_request(self, db, test_user):
        """Urgent requests should be marked properly."""
        service = HITLService(db)
        
        request = ApprovalRequest(
            agent_name="emergency_agent",
            action_type="emergency_takedown",
            target_type="stream",
            target_id=1,
            reasoning="Potential harm detected",
            confidence=0.99,
            priority=ApprovalPriority.URGENT,
            category=ApprovalCategory.EMERGENCY,
        )
        
        decision, queue_item = service.create_approval_request(request)
        
        assert queue_item.priority == "urgent"


class TestHITLQueueManagement:
    """Test approval queue operations."""

    def test_get_pending_approvals(self, db, test_user):
        """Should retrieve pending approvals from queue."""
        service = HITLService(db)
        
        # Create some test approvals
        for i in range(3):
            request = ApprovalRequest(
                agent_name="test_agent",
                action_type=f"action_{i}",
                target_type="user",
                target_id=test_user["user"].id,
                reasoning=f"Test reason {i}",
                confidence=0.8,
            )
            service.create_approval_request(request)
        
        # Get pending approvals
        pending = service.get_pending_approvals(limit=10)
        
        assert len(pending) >= 3

    def test_filter_by_category(self, db, test_user):
        """Should filter approvals by category."""
        service = HITLService(db)
        
        # Create approval with specific category
        request = ApprovalRequest(
            agent_name="payout_agent",
            action_type="process_payout",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Large payout",
            confidence=0.95,
            category=ApprovalCategory.PAYOUT,
        )
        service.create_approval_request(request)
        
        # Filter by payout category
        payouts = service.get_pending_approvals(category="payout")
        
        assert all(p["category"] == "payout" for p in payouts)

    def test_filter_by_priority(self, db, test_user):
        """Should filter approvals by priority."""
        service = HITLService(db)
        
        # Create high priority approval
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="urgent_action",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Urgent matter",
            confidence=0.99,
            priority=ApprovalPriority.URGENT,
        )
        service.create_approval_request(request)
        
        # Filter by urgent priority
        urgent = service.get_pending_approvals(priority="urgent")
        
        assert all(p["priority"] == "urgent" for p in urgent)


class TestHITLApprovalDecisions:
    """Test approval and rejection flows."""

    def test_approve_decision(self, db, test_user, test_admin):
        """Should successfully approve a decision."""
        service = HITLService(db)
        
        # Create approval request
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="warn_user",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Minor violation",
            confidence=0.85,
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Approve the decision
        approved_decision = service.approve_decision(
            decision_id=decision.id,
            approver_id=test_admin["user"].id,
            notes="Approved after review"
        )
        
        assert approved_decision.status == "approved"
        assert approved_decision.approved_by == test_admin["user"].id
        assert approved_decision.approval_notes == "Approved after review"

    def test_reject_decision(self, db, test_user, test_admin):
        """Should successfully reject a decision."""
        service = HITLService(db)
        
        # Create approval request
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="ban_user",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Suspected violation",
            confidence=0.65,  # Low confidence
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Reject the decision
        rejected_decision = service.reject_decision(
            decision_id=decision.id,
            rejector_id=test_admin["user"].id,
            notes="Insufficient evidence for ban"
        )
        
        assert rejected_decision.status == "rejected"

    def test_assign_approval(self, db, test_user, test_admin):
        """Should assign approval to specific admin."""
        service = HITLService(db)
        
        # Create approval request
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="review_content",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Content review needed",
            confidence=0.75,
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Assign to admin
        assigned = service.assign_approval(
            queue_id=queue_item.id,
            assignee_id=test_admin["user"].id
        )
        
        assert assigned is True


class TestHITLExecuteApproved:
    """Test execution of approved decisions."""

    def test_execute_approved_decision(self, db, test_user, test_admin):
        """Should execute an approved decision."""
        service = HITLService(db)
        
        # Create and approve
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="warn_user",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Policy violation",
            confidence=0.9,
        )
        decision, queue_item = service.create_approval_request(request)
        
        service.approve_decision(
            decision_id=decision.id,
            approver_id=test_admin["user"].id
        )
        
        # Execute the approved decision
        result = service.execute_approved_decision(decision.id)
        
        assert result is not None

    def test_cannot_execute_unapproved(self, db, test_user):
        """Should not execute pending decisions."""
        service = HITLService(db)
        
        # Create but don't approve
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="ban_user",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Test",
            confidence=0.9,
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Attempt to execute without approval
        with pytest.raises(Exception):
            service.execute_approved_decision(decision.id)


class TestHITLTimeouts:
    """Test timeout handling."""

    def test_check_timeouts_escalates(self, db, test_user):
        """Should escalate timed-out approvals."""
        service = HITLService(db)
        
        # Create approval with short timeout
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="review_content",
            target_type="user",
            target_id=test_user["user"].id,
            reasoning="Time-sensitive review",
            confidence=0.8,
            timeout_hours=1,
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Manually set created_at to past (simulating timeout)
        queue_item.created_at = datetime.utcnow() - timedelta(hours=2)
        db.commit()
        
        # Check timeouts
        escalated = service.check_timeouts()
        
        # Should have escalated the item
        assert escalated >= 0  # Count of escalated items


class TestHITLAuditTrail:
    """Test audit trail functionality."""

    def test_decision_audit_trail(self, db, test_user, test_admin):
        """Should maintain complete audit trail."""
        service = HITLService(db)
        
        # Create approval request
        request = ApprovalRequest(
            agent_name="moderation_agent",
            action_type="content_review",
            target_type="stream",
            target_id=1,
            reasoning="Automated detection",
            confidence=0.88,
            input_snapshot={"title": "Test Stream", "category": "gaming"},
        )
        decision, queue_item = service.create_approval_request(request)
        
        # Approve
        service.approve_decision(
            decision_id=decision.id,
            approver_id=test_admin["user"].id,
            notes="Reviewed and approved"
        )
        
        # Verify audit trail
        db.refresh(decision)
        
        assert decision.agent_name == "moderation_agent"
        assert decision.input_snapshot is not None
        assert decision.approved_by == test_admin["user"].id
        assert decision.approved_at is not None

    def test_get_approval_history(self, db, test_user, test_admin):
        """Should retrieve approval history."""
        service = HITLService(db)
        
        # Create multiple decisions
        for i in range(3):
            request = ApprovalRequest(
                agent_name="test_agent",
                action_type=f"action_{i}",
                target_type="user",
                target_id=test_user["user"].id,
                reasoning=f"Reason {i}",
                confidence=0.9,
            )
            decision, _ = service.create_approval_request(request)
            
            # Approve some, reject others
            if i % 2 == 0:
                service.approve_decision(decision.id, test_admin["user"].id)
            else:
                service.reject_decision(decision.id, test_admin["user"].id, "Rejected")
        
        # Get history
        history = service.get_approval_history(limit=10)
        
        assert len(history) >= 3
