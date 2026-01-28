"""
Streamura Appeals API Routes

This module provides API endpoints for the appeals system,
allowing users to appeal moderation actions and admins to review appeals.
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

# Import will be added to api.py - this is the appeals routes module
# from .database import get_db
# from .auth import get_current_active_user, get_current_admin_user
# from .models import Appeal, ModerationAction, User


class AppealCreate(BaseModel):
    """Request model for creating an appeal"""
    moderation_action_id: int
    reason: str
    evidence: Optional[str] = None


class AppealResponse(BaseModel):
    """Response model for an appeal"""
    id: int
    user_id: int
    moderation_action_id: int
    reason: str
    evidence: Optional[str]
    status: str
    priority: str
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    outcome: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AppealReview(BaseModel):
    """Request model for reviewing an appeal"""
    status: str  # approved, denied, escalated
    review_notes: str
    outcome: str  # action_reversed, action_reduced, action_upheld, dismissed
    new_action_type: Optional[str] = None
    new_duration: Optional[int] = None


# These routes will be added to api.py
"""
@router.post("/appeals", response_model=AppealResponse, tags=["Appeals"])
async def create_appeal(
    appeal_data: AppealCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Check if moderation action exists and belongs to user
    action = db.query(ModerationAction).filter(
        ModerationAction.id == appeal_data.moderation_action_id,
        ModerationAction.target_user_id == current_user.id
    ).first()
    
    if not action:
        raise HTTPException(status_code=404, detail="Moderation action not found")
    
    # Check for existing appeal
    existing = db.query(Appeal).filter(
        Appeal.moderation_action_id == appeal_data.moderation_action_id,
        Appeal.status.in_(["pending", "under_review"])
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="An appeal is already pending for this action")
    
    appeal = Appeal(
        user_id=current_user.id,
        moderation_action_id=appeal_data.moderation_action_id,
        reason=appeal_data.reason,
        evidence=appeal_data.evidence,
        status="pending"
    )
    db.add(appeal)
    db.commit()
    db.refresh(appeal)
    
    return appeal


@router.get("/appeals", response_model=List[AppealResponse], tags=["Appeals"])
async def get_my_appeals(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    appeals = db.query(Appeal).filter(Appeal.user_id == current_user.id).order_by(Appeal.created_at.desc()).all()
    return appeals


@router.get("/admin/appeals", response_model=List[AppealResponse], tags=["Appeals"])
async def get_all_appeals(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(Appeal)
    if status:
        query = query.filter(Appeal.status == status)
    return query.order_by(Appeal.created_at.desc()).limit(100).all()


@router.put("/admin/appeals/{appeal_id}", response_model=AppealResponse, tags=["Appeals"])
async def review_appeal(
    appeal_id: int,
    review: AppealReview,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    appeal = db.query(Appeal).filter(Appeal.id == appeal_id).first()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")
    
    appeal.status = review.status
    appeal.review_notes = review.review_notes
    appeal.outcome = review.outcome
    appeal.reviewed_by = current_user.id
    appeal.reviewed_at = datetime.utcnow()
    
    if review.new_action_type:
        appeal.new_action_type = review.new_action_type
    if review.new_duration:
        appeal.new_duration = review.new_duration
    
    # If action reversed, clear user's ban/mute
    if review.outcome == "action_reversed":
        target_user = db.query(User).filter(User.id == appeal.moderation_action.target_user_id).first()
        if target_user:
            target_user.is_banned = False
            target_user.muted_until = None
    
    db.commit()
    db.refresh(appeal)
    return appeal
"""
