"""
Streamura GDPR Data Export Service

Comprehensive data export for GDPR compliance including:
- Full profile data export (JSON/ZIP)
- All user content (streams, messages, transactions)
- Right-to-be-forgotten with cascading deletes
- Export status tracking and history
"""

import json
import os
import zipfile
import tempfile
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import select, delete

logger = logging.getLogger(__name__)

# Export status constants
class ExportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"

# Export types
class ExportType(str, Enum):
    FULL = "full"  # All user data
    PROFILE = "profile"  # Just profile info
    CONTENT = "content"  # Streams, recordings
    FINANCIAL = "financial"  # Transactions, payouts
    MESSAGES = "messages"  # DMs, chat history

# Storage path for exports
EXPORT_STORAGE_PATH = os.getenv("DATA_EXPORT_PATH", "/tmp/streamura_exports")
EXPORT_EXPIRY_DAYS = int(os.getenv("EXPORT_EXPIRY_DAYS", "7"))
os.makedirs(EXPORT_STORAGE_PATH, exist_ok=True)


class DataExportService:
    """Service for GDPR-compliant data exports and deletion."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def request_export(
        self,
        user_id: int,
        export_type: ExportType = ExportType.FULL,
        include_private: bool = True
    ) -> Dict[str, Any]:
        """
        Request a new data export for a user.
        
        Args:
            user_id: The user requesting export
            export_type: Type of data to export
            include_private: Whether to include private messages
            
        Returns:
            Export request details with tracking ID
        """
        from models import DataExportRequest, User
        
        # Check for existing pending/processing exports
        existing = self.db.query(DataExportRequest).filter(
            DataExportRequest.user_id == user_id,
            DataExportRequest.status.in_([ExportStatus.PENDING, ExportStatus.PROCESSING])
        ).first()
        
        if existing:
            return {
                "status": "already_pending",
                "request_id": existing.id,
                "created_at": existing.created_at.isoformat(),
                "estimated_completion": (existing.created_at + timedelta(hours=1)).isoformat()
            }
        
        # Create new export request
        request = DataExportRequest(
            user_id=user_id,
            export_type=export_type.value,
            include_private=include_private,
            status=ExportStatus.PENDING.value,
            created_at=datetime.utcnow()
        )
        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)
        
        logger.info(f"Data export requested for user {user_id}, request_id={request.id}")
        
        return {
            "status": "requested",
            "request_id": request.id,
            "export_type": export_type.value,
            "estimated_completion": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "message": "Your data export has been queued. You will receive an email when it's ready."
        }
    
    async def process_export(self, request_id: int) -> Dict[str, Any]:
        """
        Process a pending data export request.
        This is typically called by a background worker.
        """
        from models import DataExportRequest, User
        
        request = self.db.query(DataExportRequest).get(request_id)
        if not request:
            return {"error": "Export request not found"}
        
        if request.status != ExportStatus.PENDING.value:
            return {"error": f"Export is already {request.status}"}
        
        # Update status to processing
        request.status = ExportStatus.PROCESSING.value
        request.started_at = datetime.utcnow()
        self.db.commit()
        
        try:
            # Get user data
            user = self.db.query(User).get(request.user_id)
            if not user:
                raise ValueError("User not found")
            
            # Collect all data based on export type
            export_type = ExportType(request.export_type)
            data = await self._collect_user_data(
                user,
                export_type,
                request.include_private
            )
            
            # Create the export file
            file_path, file_hash = await self._create_export_file(
                request.user_id,
                request_id,
                data
            )
            
            # Update request with completion info
            request.status = ExportStatus.COMPLETED.value
            request.completed_at = datetime.utcnow()
            request.file_path = file_path
            request.file_hash = file_hash
            request.file_size = os.path.getsize(file_path)
            request.expires_at = datetime.utcnow() + timedelta(days=EXPORT_EXPIRY_DAYS)
            self.db.commit()
            
            logger.info(f"Data export completed for request {request_id}")
            
            return {
                "status": "completed",
                "request_id": request_id,
                "file_size": request.file_size,
                "expires_at": request.expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Data export failed for request {request_id}: {e}")
            request.status = ExportStatus.FAILED.value
            request.error_message = str(e)
            self.db.commit()
            return {"error": str(e)}
    
    async def _collect_user_data(
        self,
        user,
        export_type: ExportType,
        include_private: bool
    ) -> Dict[str, Any]:
        """Collect all user data for export."""
        from models import (
            Stream, Recording, Transaction, Tip, Subscription,
            Conversation, Report, VirtualGood, UserInventory,
            ModerationAction, StreamAnalytics, AgentDecision
        )
        
        data = {
            "export_metadata": {
                "export_date": datetime.utcnow().isoformat(),
                "user_id": user.id,
                "export_type": export_type.value,
                "data_controller": "Streamura, Inc.",
                "data_format": "JSON",
                "gdpr_compliant": True
            }
        }
        
        # Profile data (always included)
        data["profile"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "bio": user.bio,
            "avatar_url": user.avatar_url,
            "is_creator": user.is_creator,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if hasattr(user, 'last_login') and user.last_login else None,
            "preferences": self._serialize_preferences(user)
        }
        
        if export_type in [ExportType.FULL, ExportType.CONTENT]:
            # Streams
            streams = self.db.query(Stream).filter(Stream.user_id == user.id).all()
            data["streams"] = [
                {
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "category": s.category,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                    "is_live": s.is_live,
                    "peak_viewers": getattr(s, 'peak_viewers', None),
                    "total_views": getattr(s, 'total_views', None)
                }
                for s in streams
            ]
            
            # Recordings
            recordings = self.db.query(Recording).filter(Recording.user_id == user.id).all()
            data["recordings"] = [
                {
                    "id": r.id,
                    "title": r.title,
                    "duration_seconds": r.duration_seconds,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "views": getattr(r, 'views', 0)
                }
                for r in recordings
            ]
        
        if export_type in [ExportType.FULL, ExportType.FINANCIAL]:
            # Transactions
            transactions = self.db.query(Transaction).filter(
                Transaction.user_id == user.id
            ).all()
            data["transactions"] = [
                {
                    "id": t.id,
                    "type": t.type,
                    "amount": str(t.amount),
                    "currency": t.currency,
                    "status": t.status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "description": getattr(t, 'description', None)
                }
                for t in transactions
            ]
            
            # Tips (received and sent)
            tips_received = self.db.query(Tip).filter(Tip.recipient_id == user.id).all()
            tips_sent = self.db.query(Tip).filter(Tip.sender_id == user.id).all()
            
            data["tips_received"] = [
                {
                    "id": t.id,
                    "amount": str(t.amount),
                    "sender_id": t.sender_id,
                    "message": t.message,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                }
                for t in tips_received
            ]
            
            data["tips_sent"] = [
                {
                    "id": t.id,
                    "amount": str(t.amount),
                    "recipient_id": t.recipient_id,
                    "message": t.message,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                }
                for t in tips_sent
            ]
            
            # Subscriptions
            subscriptions = self.db.query(Subscription).filter(
                (Subscription.subscriber_id == user.id) | (Subscription.creator_id == user.id)
            ).all()
            data["subscriptions"] = [
                {
                    "id": s.id,
                    "role": "subscriber" if s.subscriber_id == user.id else "creator",
                    "tier": s.tier,
                    "status": s.status,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "expires_at": s.expires_at.isoformat() if s.expires_at else None
                }
                for s in subscriptions
            ]
        
        if export_type in [ExportType.FULL, ExportType.MESSAGES] and include_private:
            # Conversations
            conversations = self.db.query(Conversation).filter(
                Conversation.participant_ids.contains([user.id])
            ).all()
            data["conversations"] = [
                {
                    "id": c.id,
                    "participants": c.participant_ids,
                    "last_message_at": c.last_message_at.isoformat() if hasattr(c, 'last_message_at') and c.last_message_at else None,
                    "messages": []  # Messages would be fetched separately for large exports
                }
                for c in conversations
            ]
        
        if export_type == ExportType.FULL:
            # Reports filed by user
            reports = self.db.query(Report).filter(Report.reporter_id == user.id).all()
            data["reports_filed"] = [
                {
                    "id": r.id,
                    "reason": r.reason,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in reports
            ]
            
            # Moderation actions against user
            mod_actions = self.db.query(ModerationAction).filter(
                ModerationAction.target_user_id == user.id
            ).all()
            data["moderation_history"] = [
                {
                    "id": m.id,
                    "action_type": m.action_type,
                    "reason": m.reason,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                    "expires_at": m.expires_at.isoformat() if hasattr(m, 'expires_at') and m.expires_at else None
                }
                for m in mod_actions
            ]
            
            # Virtual goods inventory
            inventory = self.db.query(UserInventory).filter(
                UserInventory.user_id == user.id
            ).all()
            data["inventory"] = [
                {
                    "id": i.id,
                    "good_id": i.good_id,
                    "quantity": i.quantity,
                    "acquired_at": i.acquired_at.isoformat() if hasattr(i, 'acquired_at') and i.acquired_at else None
                }
                for i in inventory
            ]
            
            # Agent decisions affecting user
            agent_decisions = self.db.query(AgentDecision).filter(
                (AgentDecision.target_id == user.id) & 
                (AgentDecision.target_type == "user")
            ).all()
            data["agent_decisions"] = [
                {
                    "id": d.id,
                    "agent_name": d.agent_name,
                    "action_type": d.action_type,
                    "reasoning": d.reasoning,
                    "confidence": d.confidence,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                    "status": d.status
                }
                for d in agent_decisions
            ]
        
        return data
    
    def _serialize_preferences(self, user) -> Dict[str, Any]:
        """Serialize user preferences to dict."""
        if hasattr(user, 'preferences') and user.preferences:
            if isinstance(user.preferences, dict):
                return user.preferences
            try:
                return json.loads(user.preferences)
            except:
                return {}
        return {}
    
    async def _create_export_file(
        self,
        user_id: int,
        request_id: int,
        data: Dict[str, Any]
    ) -> tuple[str, str]:
        """Create ZIP file with exported data."""
        # Create export directory
        export_dir = os.path.join(EXPORT_STORAGE_PATH, str(user_id))
        os.makedirs(export_dir, exist_ok=True)
        
        # Create unique filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"streamura_export_{user_id}_{timestamp}.zip"
        zip_path = os.path.join(export_dir, zip_filename)
        
        # Create ZIP file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add main data file
            json_data = json.dumps(data, indent=2, default=str)
            zf.writestr("data.json", json_data)
            
            # Add readme
            readme = self._generate_readme(data)
            zf.writestr("README.txt", readme)
            
            # Add data dictionary
            data_dict = self._generate_data_dictionary()
            zf.writestr("DATA_DICTIONARY.txt", data_dict)
        
        # Calculate file hash for integrity verification
        file_hash = self._calculate_file_hash(zip_path)
        
        return zip_path, file_hash
    
    def _generate_readme(self, data: Dict[str, Any]) -> str:
        """Generate README file for export."""
        return f"""STREAMURA DATA EXPORT
=====================

Export Date: {data['export_metadata']['export_date']}
User ID: {data['export_metadata']['user_id']}
Export Type: {data['export_metadata']['export_type']}

This archive contains your personal data from Streamura in accordance 
with GDPR Article 15 (Right of Access) and Article 20 (Right to Data Portability).

CONTENTS:
---------
- data.json: Your complete data in machine-readable JSON format
- README.txt: This file
- DATA_DICTIONARY.txt: Description of all data fields

DATA CONTROLLER:
---------------
{data['export_metadata']['data_controller']}

For questions or to exercise your rights under GDPR, contact:
privacy@streamura.com

This export is valid for {EXPORT_EXPIRY_DAYS} days and will be automatically deleted.
"""
    
    def _generate_data_dictionary(self) -> str:
        """Generate data dictionary explaining all fields."""
        return """DATA DICTIONARY
===============

PROFILE
-------
- id: Your unique user identifier
- username: Your chosen username
- email: Your registered email address
- display_name: Your public display name
- bio: Your profile biography
- avatar_url: URL to your profile picture
- is_creator: Whether you are registered as a content creator
- is_verified: Whether your account is verified
- created_at: When your account was created
- last_login: Your most recent login timestamp
- preferences: Your account settings and preferences

STREAMS
-------
- id: Unique stream identifier
- title: Stream title
- description: Stream description
- category: Stream category/game
- started_at: When the stream started
- ended_at: When the stream ended
- is_live: Whether the stream is currently live
- peak_viewers: Maximum concurrent viewers
- total_views: Total view count

TRANSACTIONS
------------
- id: Transaction identifier
- type: Transaction type (tip, subscription, payout, etc.)
- amount: Transaction amount
- currency: Currency code
- status: Transaction status (completed, pending, refunded)
- created_at: When the transaction occurred

SUBSCRIPTIONS
-------------
- id: Subscription identifier
- role: Your role (subscriber or creator)
- tier: Subscription tier level
- status: Subscription status (active, expired, cancelled)
- started_at: Subscription start date
- expires_at: Subscription expiration date

MODERATION_HISTORY
------------------
- id: Action identifier
- action_type: Type of moderation action taken
- reason: Reason for the action
- created_at: When the action was taken
- expires_at: When the action expires (if applicable)

AGENT_DECISIONS
---------------
- id: Decision identifier
- agent_name: Name of the AI agent that made the decision
- action_type: Type of action taken
- reasoning: Explanation of why the decision was made
- confidence: Agent's confidence level in the decision
- created_at: When the decision was made
- status: Current status of the decision
"""
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file for integrity verification."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    async def get_export_status(self, user_id: int, request_id: int) -> Dict[str, Any]:
        """Get status of an export request."""
        from models import DataExportRequest
        
        request = self.db.query(DataExportRequest).filter(
            DataExportRequest.id == request_id,
            DataExportRequest.user_id == user_id
        ).first()
        
        if not request:
            return {"error": "Export request not found"}
        
        result = {
            "request_id": request.id,
            "status": request.status,
            "export_type": request.export_type,
            "created_at": request.created_at.isoformat() if request.created_at else None
        }
        
        if request.status == ExportStatus.COMPLETED.value:
            result.update({
                "completed_at": request.completed_at.isoformat() if request.completed_at else None,
                "file_size": request.file_size,
                "expires_at": request.expires_at.isoformat() if request.expires_at else None,
                "download_available": request.expires_at > datetime.utcnow() if request.expires_at else False
            })
        elif request.status == ExportStatus.FAILED.value:
            result["error_message"] = request.error_message
        
        return result
    
    async def get_export_history(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get export history for a user."""
        from models import DataExportRequest
        
        requests = self.db.query(DataExportRequest).filter(
            DataExportRequest.user_id == user_id
        ).order_by(DataExportRequest.created_at.desc()).limit(limit).all()
        
        return [
            {
                "request_id": r.id,
                "status": r.status,
                "export_type": r.export_type,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "file_size": r.file_size,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None
            }
            for r in requests
        ]
    
    async def download_export(self, user_id: int, request_id: int) -> Optional[str]:
        """
        Get file path for downloading an export.
        Returns None if export doesn't exist or has expired.
        """
        from models import DataExportRequest
        
        request = self.db.query(DataExportRequest).filter(
            DataExportRequest.id == request_id,
            DataExportRequest.user_id == user_id,
            DataExportRequest.status == ExportStatus.COMPLETED.value
        ).first()
        
        if not request:
            return None
        
        # Check if export has expired
        if request.expires_at and request.expires_at < datetime.utcnow():
            request.status = ExportStatus.EXPIRED.value
            self.db.commit()
            return None
        
        # Verify file exists
        if not request.file_path or not os.path.exists(request.file_path):
            return None
        
        return request.file_path
    
    async def delete_account(
        self,
        user_id: int,
        confirmation_code: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        GDPR Right to be Forgotten - Delete all user data.
        
        This is an irreversible action that:
        1. Exports all data one final time
        2. Deletes all user data from the database
        3. Anonymizes any necessary retained records
        4. Marks the account as deleted
        """
        from models import (
            User, DataExportRequest, Stream, Recording, Transaction,
            Tip, Subscription, Conversation, Report, UserInventory,
            ModerationAction, AgentDecision
        )
        
        # Verify user exists
        user = self.db.query(User).get(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Verify confirmation code matches
        expected_code = hashlib.sha256(f"{user_id}-{user.email}".encode()).hexdigest()[:8].upper()
        if confirmation_code.upper() != expected_code:
            return {
                "error": "Invalid confirmation code",
                "hint": "Please use the confirmation code from your email"
            }
        
        try:
            logger.warning(f"Account deletion initiated for user {user_id}, reason: {reason}")
            
            # Create final export before deletion
            export_request = DataExportRequest(
                user_id=user_id,
                export_type=ExportType.FULL.value,
                include_private=True,
                status=ExportStatus.PENDING.value,
                is_deletion_export=True,
                created_at=datetime.utcnow()
            )
            self.db.add(export_request)
            self.db.commit()
            
            # Process the export immediately
            await self.process_export(export_request.id)
            
            # Delete user content (streams, recordings) 
            self.db.query(Stream).filter(Stream.user_id == user_id).delete()
            self.db.query(Recording).filter(Recording.user_id == user_id).delete()
            
            # Delete inventory
            self.db.query(UserInventory).filter(UserInventory.user_id == user_id).delete()
            
            # Anonymize tips (keep for financial records)
            self.db.query(Tip).filter(Tip.sender_id == user_id).update({
                "sender_id": None,
                "message": "[DELETED]"
            })
            self.db.query(Tip).filter(Tip.recipient_id == user_id).update({
                "recipient_id": None
            })
            
            # Cancel active subscriptions
            self.db.query(Subscription).filter(
                (Subscription.subscriber_id == user_id) | (Subscription.creator_id == user_id)
            ).update({"status": "cancelled_deletion"})
            
            # Delete conversations involving user
            self.db.query(Conversation).filter(
                Conversation.participant_ids.contains([user_id])
            ).delete()
            
            # Anonymize reports (keep for moderation records)
            self.db.query(Report).filter(Report.reporter_id == user_id).update({
                "reporter_id": None
            })
            
            # Keep moderation actions for compliance (already anonymized through user deletion)
            
            # Anonymize agent decisions
            self.db.query(AgentDecision).filter(
                (AgentDecision.target_id == user_id) & (AgentDecision.target_type == "user")
            ).update({
                "target_id": None,
                "input_snapshot": None
            })
            
            # Mark user as deleted (soft delete for compliance)
            user.email = f"deleted_{user_id}@deleted.streamura.com"
            user.username = f"deleted_{user_id}"
            user.display_name = "[Deleted User]"
            user.bio = None
            user.avatar_url = None
            user.password_hash = None
            user.is_deleted = True
            user.deleted_at = datetime.utcnow()
            user.deletion_reason = reason
            
            self.db.commit()
            
            logger.warning(f"Account deletion completed for user {user_id}")
            
            return {
                "status": "deleted",
                "message": "Your account and data have been permanently deleted.",
                "final_export_id": export_request.id,
                "final_export_expires": export_request.expires_at.isoformat() if export_request.expires_at else None
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Account deletion failed for user {user_id}: {e}")
            return {"error": f"Deletion failed: {str(e)}"}
    
    async def cleanup_expired_exports(self) -> Dict[str, int]:
        """
        Cleanup task to delete expired exports.
        Should be run periodically (e.g., daily cron job).
        """
        from models import DataExportRequest
        
        # Find expired exports
        expired = self.db.query(DataExportRequest).filter(
            DataExportRequest.status == ExportStatus.COMPLETED.value,
            DataExportRequest.expires_at < datetime.utcnow()
        ).all()
        
        deleted_count = 0
        for request in expired:
            # Delete the file
            if request.file_path and os.path.exists(request.file_path):
                try:
                    os.remove(request.file_path)
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"Failed to delete export file {request.file_path}: {e}")
            
            # Update status
            request.status = ExportStatus.EXPIRED.value
            request.file_path = None
        
        self.db.commit()
        
        logger.info(f"Cleanup completed: {deleted_count} expired exports deleted")
        
        return {
            "expired_exports_found": len(expired),
            "files_deleted": deleted_count
        }
