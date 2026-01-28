"""
Streamura KYC (Know Your Customer) Service

Provides identity verification integration with support for
Persona and Onfido providers.

Based on DNA Strand Master Plan Step 3.2 Identity Verification.
"""

import os
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, Optional, Any
import hashlib
import secrets

logger = logging.getLogger(__name__)


class KYCProvider(Enum):
    """Supported KYC providers."""
    PERSONA = "persona"
    ONFIDO = "onfido"
    MOCK = "mock"  # Development/testing


class KYCStatus(Enum):
    """Verification status states."""
    NOT_STARTED = "not_started"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"
    EXPIRED = "expired"


class DocumentType(Enum):
    """Accepted document types for verification."""
    PASSPORT = "passport"
    DRIVERS_LICENSE = "drivers_license"
    NATIONAL_ID = "national_id"
    RESIDENCE_PERMIT = "residence_permit"


@dataclass
class VerificationSession:
    """Represents an active verification session."""
    session_id: str
    user_id: int
    provider: KYCProvider
    status: KYCStatus
    inquiry_id: Optional[str] = None
    hosted_url: Optional[str] = None
    created_at: datetime = None
    expires_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "provider": self.provider.value,
            "status": self.status.value,
            "inquiry_id": self.inquiry_id,
            "hosted_url": self.hosted_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


@dataclass
class VerificationResult:
    """Result of a completed verification."""
    user_id: int
    status: KYCStatus
    provider: KYCProvider
    verified_at: Optional[datetime] = None
    document_type: Optional[DocumentType] = None
    document_country: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address_verified: bool = False
    rejection_reasons: Optional[list] = None
    
    def to_dict(self) -> Dict:
        result = {
            "user_id": self.user_id,
            "status": self.status.value,
            "provider": self.provider.value,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "document_type": self.document_type.value if self.document_type else None,
            "document_country": self.document_country,
            "address_verified": self.address_verified,
        }
        if self.rejection_reasons:
            result["rejection_reasons"] = self.rejection_reasons
        return result


class KYCService:
    """
    Identity verification integration service.
    
    Supports Persona and Onfido with automatic fallback to mock mode
    for development.
    """
    
    # Environment configuration
    PERSONA_API_KEY = os.getenv("PERSONA_API_KEY", "")
    PERSONA_TEMPLATE_ID = os.getenv("PERSONA_TEMPLATE_ID", "")
    ONFIDO_API_TOKEN = os.getenv("ONFIDO_API_TOKEN", "")
    
    # Webhook URLs
    PERSONA_WEBHOOK_URL = os.getenv("PERSONA_WEBHOOK_URL", "")
    ONFIDO_WEBHOOK_URL = os.getenv("ONFIDO_WEBHOOK_URL", "")
    
    def __init__(self, provider: Optional[KYCProvider] = None):
        """
        Initialize KYC service.
        
        Args:
            provider: Specific provider to use (auto-detected if None)
        """
        self.provider = provider or self._detect_provider()
        self._sessions: Dict[str, VerificationSession] = {}
        self._configure()
    
    def _detect_provider(self) -> KYCProvider:
        """Auto-detect KYC provider from environment variables."""
        if self.PERSONA_API_KEY and self.PERSONA_TEMPLATE_ID:
            logger.info("KYC: Detected Persona configuration")
            return KYCProvider.PERSONA
        elif self.ONFIDO_API_TOKEN:
            logger.info("KYC: Detected Onfido configuration")
            return KYCProvider.ONFIDO
        else:
            logger.warning("KYC: No provider configured, using mock mode")
            return KYCProvider.MOCK
    
    def _configure(self):
        """Configure provider-specific settings."""
        if self.provider == KYCProvider.PERSONA:
            self._api_endpoint = "https://withpersona.com/api/v1"
        elif self.provider == KYCProvider.ONFIDO:
            self._api_endpoint = "https://api.onfido.com/v3.6"
        else:
            self._api_endpoint = None
    
    @property
    def is_production_mode(self) -> bool:
        """Check if running with a real KYC provider."""
        return self.provider != KYCProvider.MOCK
    
    def create_verification_session(self, user_id: int, email: str = "") -> VerificationSession:
        """
        Create a new verification session.
        
        Args:
            user_id: Internal user ID
            email: User's email for verification
            
        Returns:
            VerificationSession with hosted URL for redirect
        """
        session_id = secrets.token_urlsafe(16)
        
        if self.provider == KYCProvider.PERSONA:
            return self._create_persona_session(session_id, user_id, email)
        elif self.provider == KYCProvider.ONFIDO:
            return self._create_onfido_session(session_id, user_id, email)
        else:
            return self._create_mock_session(session_id, user_id, email)
    
    def _create_persona_session(
        self,
        session_id: str,
        user_id: int,
        email: str
    ) -> VerificationSession:
        """Create a Persona Inquiry session."""
        # In production, would call Persona API:
        # POST /inquiries
        # with template_id and reference_id
        
        inquiry_id = f"inq_{secrets.token_hex(12)}"
        hosted_url = f"https://withpersona.com/verify?inquiry-id={inquiry_id}"
        
        session = VerificationSession(
            session_id=session_id,
            user_id=user_id,
            provider=KYCProvider.PERSONA,
            status=KYCStatus.PENDING,
            inquiry_id=inquiry_id,
            hosted_url=hosted_url,
        )
        
        self._sessions[session_id] = session
        logger.info(f"Created Persona session for user {user_id}: {inquiry_id}")
        
        return session
    
    def _create_onfido_session(
        self,
        session_id: str,
        user_id: int,
        email: str
    ) -> VerificationSession:
        """Create an Onfido SDK session."""
        # In production, would call Onfido API:
        # 1. Create applicant
        # 2. Generate SDK token
        
        applicant_id = f"applicant_{secrets.token_hex(12)}"
        sdk_token = secrets.token_urlsafe(32)
        
        session = VerificationSession(
            session_id=session_id,
            user_id=user_id,
            provider=KYCProvider.ONFIDO,
            status=KYCStatus.PENDING,
            inquiry_id=applicant_id,
            hosted_url=f"onfido-sdk://{sdk_token}",  # SDK flow, not hosted URL
        )
        
        self._sessions[session_id] = session
        logger.info(f"Created Onfido session for user {user_id}: {applicant_id}")
        
        return session
    
    def _create_mock_session(
        self,
        session_id: str,
        user_id: int,
        email: str
    ) -> VerificationSession:
        """Create a mock verification session for development."""
        mock_id = f"mock_{secrets.token_hex(8)}"
        
        session = VerificationSession(
            session_id=session_id,
            user_id=user_id,
            provider=KYCProvider.MOCK,
            status=KYCStatus.PENDING,
            inquiry_id=mock_id,
            hosted_url=f"/kyc/mock-verify?session={session_id}",
        )
        
        self._sessions[session_id] = session
        logger.info(f"Created mock KYC session for user {user_id}: {mock_id}")
        
        return session
    
    def get_verification_status(self, user_id: int) -> KYCStatus:
        """
        Get current verification status for a user.
        
        Args:
            user_id: User ID to check
            
        Returns:
            KYCStatus enum value
        """
        # Find most recent session for user
        user_sessions = [
            s for s in self._sessions.values()
            if s.user_id == user_id
        ]
        
        if not user_sessions:
            return KYCStatus.NOT_STARTED
        
        # Return status of most recent session
        latest = max(user_sessions, key=lambda s: s.created_at)
        return latest.status
    
    def handle_webhook(self, payload: bytes, signature: str) -> Dict:
        """
        Process KYC provider webhook.
        
        Args:
            payload: Raw webhook payload
            signature: Signature header for verification
            
        Returns:
            Processing result
        """
        if self.provider == KYCProvider.PERSONA:
            return self._handle_persona_webhook(payload, signature)
        elif self.provider == KYCProvider.ONFIDO:
            return self._handle_onfido_webhook(payload, signature)
        else:
            return self._handle_mock_webhook(payload)
    
    def _handle_persona_webhook(self, payload: bytes, signature: str) -> Dict:
        """Process Persona webhook events."""
        # In production, would:
        # 1. Verify webhook signature
        # 2. Parse event type (inquiry.completed, inquiry.failed, etc.)
        # 3. Update user verification status
        
        logger.info("Processing Persona webhook")
        return {"status": "processed", "provider": "persona"}
    
    def _handle_onfido_webhook(self, payload: bytes, signature: str) -> Dict:
        """Process Onfido webhook events."""
        # In production, would:
        # 1. Verify webhook signature
        # 2. Parse event type (check.completed, etc.)
        # 3. Update user verification status
        
        logger.info("Processing Onfido webhook")
        return {"status": "processed", "provider": "onfido"}
    
    def _handle_mock_webhook(self, payload: bytes) -> Dict:
        """Process mock webhook for testing."""
        logger.info("Processing mock webhook")
        return {"status": "processed", "provider": "mock"}
    
    def complete_mock_verification(
        self,
        session_id: str,
        approve: bool = True
    ) -> VerificationResult:
        """
        Complete a mock verification (for testing).
        
        Args:
            session_id: Session to complete
            approve: Whether to approve or reject
            
        Returns:
            VerificationResult
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        if approve:
            session.status = KYCStatus.APPROVED
            result = VerificationResult(
                user_id=session.user_id,
                status=KYCStatus.APPROVED,
                provider=KYCProvider.MOCK,
                verified_at=datetime.utcnow(),
                document_type=DocumentType.PASSPORT,
                document_country="US",
                first_name="Test",
                last_name="User",
                date_of_birth="1990-01-01",
                address_verified=True,
            )
        else:
            session.status = KYCStatus.REJECTED
            result = VerificationResult(
                user_id=session.user_id,
                status=KYCStatus.REJECTED,
                provider=KYCProvider.MOCK,
                rejection_reasons=["Document quality too low", "Face not visible"],
            )
        
        return result
    
    def get_status(self) -> Dict:
        """Get overall KYC service status."""
        return {
            "provider": self.provider.value,
            "is_production": self.is_production_mode,
            "active_sessions": len(self._sessions),
            "api_endpoint": self._api_endpoint,
        }


# Singleton instance
_kyc_instance: Optional[KYCService] = None


def get_kyc_service() -> KYCService:
    """Get or create the singleton KYCService instance."""
    global _kyc_instance
    if _kyc_instance is None:
        _kyc_instance = KYCService()
    return _kyc_instance


def reset_kyc_service():
    """Reset the singleton instance (useful for testing)."""
    global _kyc_instance
    _kyc_instance = None
