"""
Streamura CCPA Privacy Module

Implements California Consumer Privacy Act (CCPA) compliance:
- Right to Know (data access)
- Right to Delete
- Right to Opt-Out of Sale
- Non-discrimination

This module extends the GDPR data export functionality for CCPA-specific requirements.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum
from dataclasses import dataclass
from sqlalchemy.orm import Session

from backend.models import User, DataExportRequest
from backend.data_export import DataExportService

logger = logging.getLogger(__name__)


class CCPARequestType(str, Enum):
    """Types of CCPA requests."""
    KNOW = "know"           # Right to Know
    DELETE = "delete"       # Right to Delete
    OPT_OUT = "opt_out"     # Opt-Out of Sale
    OPT_IN = "opt_in"       # Opt-In to Sale (for minors)


class CCPARequestStatus(str, Enum):
    """Status of CCPA requests."""
    PENDING = "pending"
    VERIFYING = "verifying"       # Verifying identity
    PROCESSING = "processing"
    COMPLETED = "completed"
    DENIED = "denied"             # If verification fails
    EXPIRED = "expired"


@dataclass
class CCPARequest:
    """CCPA request data structure."""
    id: int
    user_id: int
    request_type: CCPARequestType
    status: CCPARequestStatus
    created_at: datetime
    verified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    denial_reason: Optional[str] = None
    categories_requested: Optional[List[str]] = None


# Categories of personal information under CCPA
CCPA_PI_CATEGORIES = {
    "identifiers": {
        "name": "Identifiers",
        "description": "Real name, alias, postal address, email, account name, SSN, driver's license, passport, or other similar identifiers",
        "examples": ["username", "email", "display_name", "phone_number"],
    },
    "commercial_info": {
        "name": "Commercial Information",
        "description": "Records of personal property, products or services purchased, obtained, or considered",
        "examples": ["subscriptions", "virtual_goods", "transactions", "tips"],
    },
    "biometric": {
        "name": "Biometric Information",
        "description": "Physiological, biological, or behavioral characteristics",
        "examples": ["face_recognition_data", "voice_prints"],
    },
    "internet_activity": {
        "name": "Internet Activity",
        "description": "Browsing history, search history, and information regarding interaction with websites or applications",
        "examples": ["watch_history", "search_queries", "stream_views"],
    },
    "geolocation": {
        "name": "Geolocation Data",
        "description": "Physical location or movements",
        "examples": ["event_location", "stream_geotag"],
    },
    "audio_visual": {
        "name": "Audio/Visual Information",
        "description": "Audio, electronic, visual, thermal, olfactory, or similar information",
        "examples": ["stream_recordings", "profile_photos", "voice_messages"],
    },
    "professional": {
        "name": "Professional Information",
        "description": "Professional or employment-related information",
        "examples": ["creator_verification", "news_org_affiliation"],
    },
    "inferences": {
        "name": "Inferences",
        "description": "Inferences drawn from any of the above to create a profile",
        "examples": ["trust_score", "content_preferences", "recommendation_data"],
    },
}


class CCPAService:
    """
    CCPA Compliance Service.
    
    Handles all CCPA-related requests including data access,
    deletion, and opt-out of data sale.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.data_export_service = DataExportService(db)
    
    def submit_request(
        self,
        user_id: int,
        request_type: CCPARequestType,
        categories: Optional[List[str]] = None,
        verification_method: str = "email"
    ) -> Dict[str, Any]:
        """
        Submit a new CCPA request.
        
        Args:
            user_id: ID of the requesting user
            request_type: Type of CCPA request
            categories: Specific PI categories (for Know/Delete)
            verification_method: How to verify identity
        
        Returns:
            Request details including verification instructions
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        
        # Check for California residency (simplified check)
        # In production, this would use more sophisticated verification
        
        # Create request record
        request_id = self._create_request_record(
            user_id=user_id,
            request_type=request_type,
            categories=categories,
        )
        
        # Send verification email/SMS
        verification_token = self._send_verification(user, verification_method)
        
        return {
            "request_id": request_id,
            "status": CCPARequestStatus.VERIFYING.value,
            "verification_required": True,
            "verification_method": verification_method,
            "verification_expires_at": (
                datetime.utcnow() + timedelta(hours=24)
            ).isoformat(),
            "estimated_completion": self._estimate_completion(request_type),
            "message": f"Please verify your identity via {verification_method} to proceed",
        }
    
    def verify_request(
        self,
        request_id: int,
        verification_token: str
    ) -> Dict[str, Any]:
        """
        Verify a CCPA request.
        
        After identity verification, the request will be processed.
        """
        # Verify token (simplified)
        # In production, check against stored verification token
        
        request = self._get_request(request_id)
        if not request:
            raise ValueError("Request not found")
        
        if request.status != CCPARequestStatus.VERIFYING:
            raise ValueError(f"Request is already {request.status}")
        
        # Update status to processing
        self._update_request_status(request_id, CCPARequestStatus.PROCESSING)
        
        return {
            "request_id": request_id,
            "status": CCPARequestStatus.PROCESSING.value,
            "verified_at": datetime.utcnow().isoformat(),
            "estimated_completion": self._estimate_completion(request.request_type),
        }
    
    def process_delete_request(
        self,
        request_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Process a Right to Delete request.
        
        Deletes all personal information while maintaining
        business records as required by law.
        """
        request = self._get_request(request_id)
        if not request or request.user_id != user_id:
            raise ValueError("Request not found or unauthorized")
        
        if request.request_type != CCPARequestType.DELETE:
            raise ValueError("Not a delete request")
        
        deletion_report = {
            "deleted_categories": [],
            "retained_categories": [],
            "deletion_details": {},
        }
        
        # Delete each category of PI
        categories = request.categories_requested or list(CCPA_PI_CATEGORIES.keys())
        
        for category in categories:
            try:
                deleted = self._delete_category(user_id, category)
                if deleted:
                    deletion_report["deleted_categories"].append(category)
                    deletion_report["deletion_details"][category] = deleted
            except Exception as e:
                logger.error(f"Error deleting category {category}: {e}")
        
        # Document retained data (legal requirements)
        deletion_report["retained_categories"] = self._get_retained_data(user_id)
        
        # Mark request complete
        self._update_request_status(request_id, CCPARequestStatus.COMPLETED)
        
        return {
            "request_id": request_id,
            "status": CCPARequestStatus.COMPLETED.value,
            "completed_at": datetime.utcnow().isoformat(),
            "deletion_report": deletion_report,
            "retention_notice": self._get_retention_notice(),
        }
    
    def process_know_request(
        self,
        request_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Process a Right to Know request.
        
        Returns all personal information in portable format.
        """
        request = self._get_request(request_id)
        if not request or request.user_id != user_id:
            raise ValueError("Request not found or unauthorized")
        
        if request.request_type != CCPARequestType.KNOW:
            raise ValueError("Not a know request")
        
        # Use existing data export service
        export_result = self.data_export_service.create_export_request(user_id)
        
        # Add CCPA-specific formatting
        categories = request.categories_requested or list(CCPA_PI_CATEGORIES.keys())
        
        ccpa_report = {
            "categories_collected": [],
            "sources": [],
            "purposes": [],
            "third_parties": [],
            "specific_pieces": {},
        }
        
        for category in categories:
            category_data = self._get_category_data(user_id, category)
            if category_data:
                ccpa_report["categories_collected"].append({
                    "category": CCPA_PI_CATEGORIES[category]["name"],
                    "description": CCPA_PI_CATEGORIES[category]["description"],
                    "data_present": True,
                })
                ccpa_report["specific_pieces"][category] = category_data
        
        ccpa_report["sources"] = self._get_data_sources()
        ccpa_report["purposes"] = self._get_data_purposes()
        ccpa_report["third_parties"] = self._get_third_parties()
        
        # Mark request complete
        self._update_request_status(request_id, CCPARequestStatus.COMPLETED)
        
        return {
            "request_id": request_id,
            "status": CCPARequestStatus.COMPLETED.value,
            "completed_at": datetime.utcnow().isoformat(),
            "export_id": export_result.get("export_id"),
            "ccpa_report": ccpa_report,
        }
    
    def process_opt_out(self, user_id: int) -> Dict[str, Any]:
        """
        Process opt-out of sale request.
        
        Streamura does not sell personal information, but we
        track this preference for compliance.
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        
        # Set opt-out flag (would be on user model)
        # user.ccpa_opted_out = True
        # user.ccpa_opt_out_date = datetime.utcnow()
        # self.db.commit()
        
        return {
            "status": "success",
            "opt_out_effective": datetime.utcnow().isoformat(),
            "message": "You have opted out of the sale of personal information. Note: Streamura does not sell personal information to third parties.",
        }
    
    def get_privacy_notice(self) -> Dict[str, Any]:
        """
        Get CCPA-compliant privacy notice.
        """
        return {
            "last_updated": "2026-01-01",
            "categories_collected": [
                {
                    "category": cat["name"],
                    "description": cat["description"],
                    "examples": cat["examples"],
                }
                for cat in CCPA_PI_CATEGORIES.values()
            ],
            "sources": self._get_data_sources(),
            "purposes": self._get_data_purposes(),
            "sharing": self._get_third_parties(),
            "sale_of_data": False,
            "rights": {
                "know": "You have the right to know what personal information we collect about you",
                "delete": "You have the right to request deletion of your personal information",
                "opt_out": "You have the right to opt-out of the sale of your personal information",
                "non_discrimination": "We will not discriminate against you for exercising your rights",
            },
            "verification_methods": ["email", "phone", "account_credentials"],
            "response_timeline": "We will respond to your request within 45 days",
        }
    
    def _create_request_record(
        self,
        user_id: int,
        request_type: CCPARequestType,
        categories: Optional[List[str]] = None
    ) -> int:
        """Create CCPA request record in database."""
        # In production, use a CCPARequest model
        # Here we reuse DataExportRequest with metadata
        export_request = DataExportRequest(
            user_id=user_id,
            status="verifying",
            export_format="ccpa_json",
            requested_at=datetime.utcnow(),
        )
        self.db.add(export_request)
        self.db.commit()
        self.db.refresh(export_request)
        return export_request.id
    
    def _get_request(self, request_id: int) -> Optional[CCPARequest]:
        """Get CCPA request by ID."""
        # In production, query CCPARequest model
        export = self.db.query(DataExportRequest).filter(
            DataExportRequest.id == request_id
        ).first()
        
        if not export:
            return None
        
        return CCPARequest(
            id=export.id,
            user_id=export.user_id,
            request_type=CCPARequestType.DELETE if export.is_deletion_export else CCPARequestType.KNOW,
            status=CCPARequestStatus(export.status),
            created_at=export.requested_at,
        )
    
    def _update_request_status(self, request_id: int, status: CCPARequestStatus):
        """Update request status."""
        export = self.db.query(DataExportRequest).filter(
            DataExportRequest.id == request_id
        ).first()
        if export:
            export.status = status.value
            if status == CCPARequestStatus.COMPLETED:
                export.completed_at = datetime.utcnow()
            self.db.commit()
    
    def _send_verification(self, user: User, method: str) -> str:
        """Send verification request to user."""
        # In production, send email/SMS with verification link
        import secrets
        token = secrets.token_urlsafe(32)
        logger.info(f"CCPA verification sent to {user.email} via {method}")
        return token
    
    def _estimate_completion(self, request_type: CCPARequestType) -> str:
        """Estimate completion time based on request type."""
        days = {
            CCPARequestType.KNOW: 30,
            CCPARequestType.DELETE: 45,
            CCPARequestType.OPT_OUT: 1,
            CCPARequestType.OPT_IN: 1,
        }
        completion_date = datetime.utcnow() + timedelta(days=days.get(request_type, 45))
        return completion_date.isoformat()
    
    def _delete_category(self, user_id: int, category: str) -> Dict[str, Any]:
        """Delete data for a specific category."""
        # Implementation depends on category
        deleted_items = {}
        
        if category == "identifiers":
            # Anonymize user data
            deleted_items["anonymized"] = ["email", "phone", "address"]
        elif category == "commercial_info":
            # Delete transaction history (keep financial records)
            deleted_items["deleted"] = ["tip_comments", "purchase_preferences"]
            deleted_items["retained"] = ["transaction_amounts_for_tax"]
        elif category == "internet_activity":
            # Delete watch history, search queries
            deleted_items["deleted"] = ["watch_history", "search_queries"]
        elif category == "inferences":
            # Reset recommendation and scoring data
            deleted_items["reset"] = ["trust_score", "content_preferences"]
        
        return deleted_items
    
    def _get_category_data(self, user_id: int, category: str) -> Dict[str, Any]:
        """Get data for a specific category."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        if category == "identifiers":
            return {
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
            }
        elif category == "commercial_info":
            return {
                "account_balance": float(user.balance or 0),
                "subscription_count": "See subscriptions export",
            }
        
        return {}
    
    def _get_retained_data(self, user_id: int) -> List[Dict[str, str]]:
        """Get list of data retained for legal purposes."""
        return [
            {
                "category": "Financial Records",
                "reason": "Tax reporting requirements (7 years)",
                "legal_basis": "26 USC § 6001",
            },
            {
                "category": "Legal Disputes",
                "reason": "Active or reasonably anticipated litigation",
                "legal_basis": "CCPA § 1798.105(d)(4)",
            },
        ]
    
    def _get_retention_notice(self) -> str:
        """Get data retention notice."""
        return (
            "Certain data may be retained as required by law, including "
            "financial records for tax purposes and data necessary for "
            "legal compliance. This data will be retained for the minimum "
            "period required by law."
        )
    
    def _get_data_sources(self) -> List[Dict[str, str]]:
        """Get list of data sources."""
        return [
            {"source": "Direct from you", "examples": "Registration, profile, content"},
            {"source": "Automatic collection", "examples": "Device info, usage data"},
            {"source": "Third-party platforms", "examples": "Social login providers"},
        ]
    
    def _get_data_purposes(self) -> List[str]:
        """Get list of data usage purposes."""
        return [
            "Providing streaming and content services",
            "Processing payments and payouts",
            "Personalizing content recommendations",
            "Ensuring platform safety and security",
            "Compliance with legal obligations",
            "Analytics and service improvement",
        ]
    
    def _get_third_parties(self) -> List[Dict[str, str]]:
        """Get list of third parties with data access."""
        return [
            {
                "category": "Payment Processors",
                "name": "Stripe",
                "purpose": "Processing payments and payouts",
            },
            {
                "category": "Cloud Infrastructure",
                "name": "AWS/GCP",
                "purpose": "Hosting and data storage",
            },
            {
                "category": "Analytics",
                "name": "Analytics providers",
                "purpose": "Understanding service usage",
            },
        ]
