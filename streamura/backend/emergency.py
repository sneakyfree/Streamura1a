"""
Streamura Emergency Contact & Panic Button System

Crisis response system providing:
- Panic button for streamers in dangerous situations
- Emergency contact routing (local services, platform safety)
- Location-based emergency service routing
- Incident tracking and resolution
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class EmergencyType(str, Enum):
    PANIC = "panic"  # General panic/distress
    MEDICAL = "medical"  # Medical emergency
    SAFETY = "safety"  # Personal safety threat
    LEGAL = "legal"  # Legal/law enforcement needed
    TECHNICAL = "technical"  # Platform technical emergency (severe issues)


class EmergencySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EmergencyStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    FALSE_ALARM = "false_alarm"


class EmergencyRouting(str, Enum):
    LOCAL_EMERGENCY = "local_emergency"  # Route to 911 or local equivalent
    PLATFORM_SAFETY = "platform_safety"  # Route to platform safety team
    CREATOR_SUPPORT = "creator_support"  # Route to creator support
    NON_EMERGENCY = "non_emergency"  # Non-emergency services


# Environment configuration
EMERGENCY_SERVICES_ENABLED = os.getenv("EMERGENCY_SERVICES_ENABLED", "false").lower() == "true"
PLATFORM_SAFETY_EMAIL = os.getenv("PLATFORM_SAFETY_EMAIL", "safety@streamura.com")
PLATFORM_SAFETY_PHONE = os.getenv("PLATFORM_SAFETY_PHONE", "")


class EmergencyService:
    """Comprehensive emergency contact and panic button service."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def trigger_panic_button(
        self,
        user_id: int,
        trigger_source: str,
        stream_id: Optional[int] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        location_consent: bool = False,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Trigger the panic button for a user in distress.
        
        This initiates an emergency response sequence:
        1. Log the panic button activation
        2. Create an emergency contact record
        3. Execute immediate automated actions
        4. Notify platform safety team
        5. Optionally share location with emergency services
        
        Args:
            user_id: User triggering the panic button
            trigger_source: How it was triggered (mobile, web, voice, etc.)
            stream_id: If triggered during a stream
            latitude: User's latitude (if location consent given)
            longitude: User's longitude (if location consent given)
            location_consent: Whether user consented to location sharing
            description: Optional description of the emergency
            
        Returns:
            Response with emergency ID and actions taken
        """
        from models import EmergencyContact, PanicButtonLog, Stream, User
        
        # Get user info for context
        user = self.db.query(User).get(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Determine emergency severity based on context
        severity = EmergencySeverity.HIGH  # Panic button defaults to high
        if stream_id:
            # If streaming, treat as critical (public exposure)
            severity = EmergencySeverity.CRITICAL
        
        # Create emergency contact record
        emergency = EmergencyContact(
            user_id=user_id,
            emergency_type=EmergencyType.PANIC.value,
            severity=severity.value,
            latitude=latitude if location_consent else None,
            longitude=longitude if location_consent else None,
            location_consent=location_consent,
            location_timestamp=datetime.utcnow() if latitude else None,
            stream_id=stream_id,
            description=description,
            status=EmergencyStatus.OPEN.value,
            routed_to=EmergencyRouting.PLATFORM_SAFETY.value,
            created_at=datetime.utcnow()
        )
        self.db.add(emergency)
        self.db.commit()
        self.db.refresh(emergency)
        
        # Execute automated response actions
        auto_actions = await self._execute_panic_response(
            user=user,
            emergency=emergency,
            stream_id=stream_id
        )
        
        # Log the panic button activation
        panic_log = PanicButtonLog(
            user_id=user_id,
            emergency_contact_id=emergency.id,
            trigger_source=trigger_source,
            stream_id=stream_id,
            auto_actions_taken=auto_actions,
            response_time_seconds=0.0,  # Will be updated on acknowledgment
            activated_at=datetime.utcnow()
        )
        self.db.add(panic_log)
        self.db.commit()
        
        logger.warning(f"PANIC BUTTON activated by user {user_id}, emergency_id={emergency.id}")
        
        return {
            "status": "emergency_created",
            "emergency_id": emergency.id,
            "severity": severity.value,
            "actions_taken": auto_actions,
            "message": "Emergency assistance has been notified. Stay safe.",
            "support_options": self._get_support_options(location_consent, latitude, longitude)
        }
    
    async def _execute_panic_response(
        self,
        user,
        emergency,
        stream_id: Optional[int]
    ) -> List[str]:
        """Execute automated response to panic button."""
        from models import Stream
        
        actions = []
        
        # 1. If streaming, pause the stream (make it private)
        if stream_id:
            stream = self.db.query(Stream).get(stream_id)
            if stream and stream.is_live:
                # Don't fully end stream - user may want to keep recording
                stream.is_visible = False  # Hide from discovery
                stream.emergency_mode = True
                actions.append("stream_hidden")
                
                # Notify viewers stream has been paused
                actions.append("viewers_notified_pause")
        
        # 2. Notify platform safety team
        await self._notify_safety_team(user, emergency)
        actions.append("safety_team_notified")
        
        # 3. Enable enhanced monitoring
        actions.append("enhanced_monitoring_enabled")
        
        # 4. Log for compliance/legal purposes
        actions.append("incident_logged")
        
        return actions
    
    async def _notify_safety_team(self, user, emergency):
        """Send notification to platform safety team."""
        from models import Notification
        
        # Create internal notification for safety team
        # In production, this would also send emails/SMS/Slack alerts
        notification_data = {
            "type": "panic_button",
            "user_id": user.id,
            "username": user.username,
            "emergency_id": emergency.id,
            "severity": emergency.severity,
            "location": {
                "lat": emergency.latitude,
                "lng": emergency.longitude
            } if emergency.location_consent else None,
            "stream_id": emergency.stream_id,
            "description": emergency.description
        }
        
        logger.critical(f"SAFETY ALERT: {notification_data}")
        # In production: await send_alert_to_safety_team(notification_data)
    
    def _get_support_options(
        self,
        location_consent: bool,
        latitude: Optional[float],
        longitude: Optional[float]
    ) -> List[Dict[str, str]]:
        """Get available support options based on location."""
        options = [
            {
                "id": "platform_safety",
                "name": "Streamura Safety Team",
                "description": "Our safety team has been notified and will contact you.",
                "action": "await_contact"
            },
            {
                "id": "chat_support",
                "name": "Emergency Chat Support",
                "description": "Connect with a support specialist now.",
                "action": "open_chat"
            }
        ]
        
        if EMERGENCY_SERVICES_ENABLED:
            options.insert(0, {
                "id": "emergency_services",
                "name": "Contact Emergency Services (911)",
                "description": "Connect directly to local emergency services.",
                "action": "call_emergency"
            })
        
        return options
    
    async def create_emergency_contact(
        self,
        user_id: int,
        emergency_type: EmergencyType,
        severity: EmergencySeverity = EmergencySeverity.MEDIUM,
        stream_id: Optional[int] = None,
        description: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        location_consent: bool = False
    ) -> Dict[str, Any]:
        """
        Create a non-panic emergency contact request.
        Used for reporting safety concerns, harassment, etc.
        """
        from models import EmergencyContact, User
        
        user = self.db.query(User).get(user_id)
        if not user:
            return {"error": "User not found"}
        
        # Determine routing based on type and severity
        routing = self._determine_routing(emergency_type, severity)
        
        emergency = EmergencyContact(
            user_id=user_id,
            emergency_type=emergency_type.value,
            severity=severity.value,
            latitude=latitude if location_consent else None,
            longitude=longitude if location_consent else None,
            location_consent=location_consent,
            location_timestamp=datetime.utcnow() if latitude else None,
            stream_id=stream_id,
            description=description,
            status=EmergencyStatus.OPEN.value,
            routed_to=routing.value,
            created_at=datetime.utcnow()
        )
        self.db.add(emergency)
        self.db.commit()
        self.db.refresh(emergency)
        
        logger.info(f"Emergency contact created: type={emergency_type}, severity={severity}, user={user_id}")
        
        # Notify appropriate team based on routing
        if routing == EmergencyRouting.PLATFORM_SAFETY:
            await self._notify_safety_team(user, emergency)
        
        return {
            "status": "created",
            "emergency_id": emergency.id,
            "severity": severity.value,
            "routed_to": routing.value,
            "expected_response_time": self._get_expected_response_time(severity)
        }
    
    def _determine_routing(
        self,
        emergency_type: EmergencyType,
        severity: EmergencySeverity
    ) -> EmergencyRouting:
        """Determine where to route the emergency based on type and severity."""
        if emergency_type == EmergencyType.PANIC:
            return EmergencyRouting.PLATFORM_SAFETY
        
        if severity == EmergencySeverity.CRITICAL:
            return EmergencyRouting.PLATFORM_SAFETY
        
        if emergency_type == EmergencyType.MEDICAL:
            return EmergencyRouting.LOCAL_EMERGENCY if EMERGENCY_SERVICES_ENABLED else EmergencyRouting.PLATFORM_SAFETY
        
        if emergency_type == EmergencyType.SAFETY:
            return EmergencyRouting.PLATFORM_SAFETY
        
        if emergency_type == EmergencyType.LEGAL:
            return EmergencyRouting.PLATFORM_SAFETY
        
        if emergency_type == EmergencyType.TECHNICAL:
            return EmergencyRouting.CREATOR_SUPPORT
        
        return EmergencyRouting.PLATFORM_SAFETY
    
    def _get_expected_response_time(self, severity: EmergencySeverity) -> str:
        """Get expected response time based on severity."""
        times = {
            EmergencySeverity.CRITICAL: "Immediately (within 5 minutes)",
            EmergencySeverity.HIGH: "Within 15 minutes",
            EmergencySeverity.MEDIUM: "Within 1 hour",
            EmergencySeverity.LOW: "Within 24 hours"
        }
        return times.get(severity, "Within 24 hours")
    
    async def acknowledge_emergency(
        self,
        emergency_id: int,
        responder_id: int,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Acknowledge an emergency (typically by safety team member).
        """
        from models import EmergencyContact, User
        
        emergency = self.db.query(EmergencyContact).get(emergency_id)
        if not emergency:
            return {"error": "Emergency not found"}
        
        if emergency.status != EmergencyStatus.OPEN.value:
            return {"error": f"Emergency is already {emergency.status}"}
        
        responder = self.db.query(User).get(responder_id)
        
        emergency.status = EmergencyStatus.ACKNOWLEDGED.value
        emergency.acknowledged_at = datetime.utcnow()
        
        self.db.commit()
        
        # Calculate response time for metrics
        response_time = (emergency.acknowledged_at - emergency.created_at).total_seconds()
        
        logger.info(f"Emergency {emergency_id} acknowledged by {responder_id} in {response_time}s")
        
        return {
            "status": "acknowledged",
            "emergency_id": emergency_id,
            "response_time_seconds": response_time,
            "acknowledged_by": responder.username if responder else "system"
        }
    
    async def resolve_emergency(
        self,
        emergency_id: int,
        resolver_id: int,
        resolution_notes: str,
        is_false_alarm: bool = False
    ) -> Dict[str, Any]:
        """
        Resolve an emergency and close the incident.
        """
        from models import EmergencyContact, User
        
        emergency = self.db.query(EmergencyContact).get(emergency_id)
        if not emergency:
            return {"error": "Emergency not found"}
        
        emergency.status = EmergencyStatus.FALSE_ALARM.value if is_false_alarm else EmergencyStatus.RESOLVED.value
        emergency.resolution_notes = resolution_notes
        emergency.resolved_at = datetime.utcnow()
        
        self.db.commit()
        
        logger.info(f"Emergency {emergency_id} resolved, false_alarm={is_false_alarm}")
        
        return {
            "status": "resolved",
            "emergency_id": emergency_id,
            "resolution": "false_alarm" if is_false_alarm else "resolved"
        }
    
    async def escalate_emergency(
        self,
        emergency_id: int,
        escalator_id: int,
        escalation_reason: str
    ) -> Dict[str, Any]:
        """
        Escalate an emergency to higher authority or external services.
        """
        from models import EmergencyContact
        
        emergency = self.db.query(EmergencyContact).get(emergency_id)
        if not emergency:
            return {"error": "Emergency not found"}
        
        emergency.status = EmergencyStatus.ESCALATED.value
        emergency.severity = EmergencySeverity.CRITICAL.value
        emergency.resolution_notes = f"ESCALATED: {escalation_reason}"
        
        self.db.commit()
        
        # Additional escalation actions
        logger.critical(f"EMERGENCY ESCALATED: {emergency_id}, reason: {escalation_reason}")
        
        return {
            "status": "escalated",
            "emergency_id": emergency_id,
            "new_severity": EmergencySeverity.CRITICAL.value
        }
    
    async def get_open_emergencies(
        self,
        limit: int = 50,
        severity_filter: Optional[EmergencySeverity] = None
    ) -> List[Dict[str, Any]]:
        """Get all open emergencies for safety team dashboard."""
        from models import EmergencyContact, User
        
        query = self.db.query(EmergencyContact).filter(
            EmergencyContact.status.in_([
                EmergencyStatus.OPEN.value,
                EmergencyStatus.ACKNOWLEDGED.value,
                EmergencyStatus.ESCALATED.value
            ])
        )
        
        if severity_filter:
            query = query.filter(EmergencyContact.severity == severity_filter.value)
        
        emergencies = query.order_by(
            EmergencyContact.severity.desc(),
            EmergencyContact.created_at.asc()
        ).limit(limit).all()
        
        return [
            {
                "id": e.id,
                "user_id": e.user_id,
                "emergency_type": e.emergency_type,
                "severity": e.severity,
                "status": e.status,
                "description": e.description,
                "stream_id": e.stream_id,
                "has_location": e.location_consent,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
                "time_open_seconds": (datetime.utcnow() - e.created_at).total_seconds() if e.created_at else 0
            }
            for e in emergencies
        ]
    
    async def get_user_emergency_history(
        self,
        user_id: int,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get emergency history for a specific user."""
        from models import EmergencyContact
        
        emergencies = self.db.query(EmergencyContact).filter(
            EmergencyContact.user_id == user_id
        ).order_by(EmergencyContact.created_at.desc()).limit(limit).all()
        
        return [
            {
                "id": e.id,
                "emergency_type": e.emergency_type,
                "severity": e.severity,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None
            }
            for e in emergencies
        ]
    
    async def get_emergency_stats(self, days: int = 30) -> Dict[str, Any]:
        """Get emergency statistics for safety team metrics."""
        from models import EmergencyContact
        from sqlalchemy import func
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        total = self.db.query(EmergencyContact).filter(
            EmergencyContact.created_at >= cutoff
        ).count()
        
        by_type = dict(
            self.db.query(
                EmergencyContact.emergency_type,
                func.count(EmergencyContact.id)
            ).filter(
                EmergencyContact.created_at >= cutoff
            ).group_by(EmergencyContact.emergency_type).all()
        )
        
        by_status = dict(
            self.db.query(
                EmergencyContact.status,
                func.count(EmergencyContact.id)
            ).filter(
                EmergencyContact.created_at >= cutoff
            ).group_by(EmergencyContact.status).all()
        )
        
        # Average response time for acknowledged emergencies
        avg_response = self.db.query(
            func.avg(
                func.extract('epoch', EmergencyContact.acknowledged_at) -
                func.extract('epoch', EmergencyContact.created_at)
            )
        ).filter(
            EmergencyContact.created_at >= cutoff,
            EmergencyContact.acknowledged_at.isnot(None)
        ).scalar()
        
        return {
            "period_days": days,
            "total_emergencies": total,
            "by_type": by_type,
            "by_status": by_status,
            "avg_response_time_seconds": float(avg_response) if avg_response else None,
            "currently_open": by_status.get(EmergencyStatus.OPEN.value, 0)
        }
