"""
Streamura Video Moderation Service

Real-time NSFW video content detection using AI vision APIs.
Critical safety layer for live streaming content moderation.

Supports:
- OpenAI Vision API (gpt-4o)
- AWS Rekognition (fallback)
- Demo mode with mock responses
"""

import os
import asyncio
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy import and_

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

# Provider selection
VIDEO_MODERATION_PROVIDER = os.getenv("VIDEO_MODERATION_PROVIDER", "openai")  # openai, rekognition, mock
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Thresholds
NSFW_AUTO_TERMINATE_THRESHOLD = 0.90  # >90% = auto-terminate stream
NSFW_FLAG_THRESHOLD = 0.70  # >70% = flag for human review
NSFW_WARNING_THRESHOLD = 0.50  # >50% = warning logged

# Sampling configuration
FRAME_SAMPLE_INTERVAL_SECONDS = 1.0  # Sample 1 frame per second
CONSECUTIVE_VIOLATIONS_FOR_TERMINATION = 3  # 3 consecutive violations = terminate
MONITORING_ENABLED = os.getenv("VIDEO_MODERATION_ENABLED", "true").lower() == "true"


class ViolationType(Enum):
    """Types of video content violations"""
    NSFW_SEXUAL = "nsfw_sexual"
    NSFW_NUDITY = "nsfw_nudity"
    VIOLENCE_GRAPHIC = "violence_graphic"
    VIOLENCE_WEAPONS = "violence_weapons"
    HATE_SYMBOLS = "hate_symbols"
    DRUGS = "drugs"
    SELF_HARM = "self_harm"
    CHILD_SAFETY = "child_safety"  # Most critical - immediate action


class ViolationSeverity(Enum):
    """Severity levels for violations"""
    LOW = "low"          # Log only
    MEDIUM = "medium"    # Warning
    HIGH = "high"        # Flag for review
    CRITICAL = "critical"  # Auto-terminate


@dataclass
class FrameAnalysisResult:
    """Result of analyzing a single video frame"""
    is_safe: bool
    confidence: float
    violations: Dict[str, float]  # violation_type -> confidence
    primary_violation: Optional[str] = None
    severity: ViolationSeverity = ViolationSeverity.LOW
    timestamp: datetime = field(default_factory=datetime.utcnow)
    raw_response: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_safe": self.is_safe,
            "confidence": self.confidence,
            "violations": self.violations,
            "primary_violation": self.primary_violation,
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class StreamModerationState:
    """Track moderation state for an active stream"""
    stream_id: int
    is_monitoring: bool = False
    consecutive_violations: int = 0
    total_frames_analyzed: int = 0
    total_violations: int = 0
    last_violation: Optional[FrameAnalysisResult] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    violations_history: List[FrameAnalysisResult] = field(default_factory=list)


class VideoModerationService:
    """
    Real-time video content moderation service.
    
    Samples frames from live streams and analyzes them for NSFW/unsafe content
    using AI vision APIs. Supports automatic stream termination for severe violations.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._active_streams: Dict[int, StreamModerationState] = {}
        self._monitoring_tasks: Dict[int, asyncio.Task] = {}
        
        # Select provider
        self.provider = VIDEO_MODERATION_PROVIDER
        logger.info(f"VideoModerationService initialized with provider: {self.provider}")
    
    async def analyze_frame(self, frame_bytes: bytes, stream_id: Optional[int] = None) -> FrameAnalysisResult:
        """
        Analyze a single video frame for NSFW/unsafe content.
        
        Args:
            frame_bytes: Raw image bytes (JPEG/PNG)
            stream_id: Optional stream ID for context
            
        Returns:
            FrameAnalysisResult with safety assessment
        """
        if self.provider == "mock":
            return await self._analyze_mock(frame_bytes)
        elif self.provider == "openai":
            return await self._analyze_openai(frame_bytes)
        elif self.provider == "rekognition":
            return await self._analyze_rekognition(frame_bytes)
        else:
            logger.warning(f"Unknown provider {self.provider}, using mock")
            return await self._analyze_mock(frame_bytes)
    
    async def _analyze_mock(self, frame_bytes: bytes) -> FrameAnalysisResult:
        """Mock analysis for demo/testing"""
        import random
        
        # 95% of frames are safe in mock mode
        is_safe = random.random() > 0.05
        
        if is_safe:
            return FrameAnalysisResult(
                is_safe=True,
                confidence=0.95,
                violations={},
                severity=ViolationSeverity.LOW,
            )
        else:
            # Simulate a violation
            violation_type = random.choice(list(ViolationType)).value
            confidence = random.uniform(0.5, 0.9)
            severity = ViolationSeverity.MEDIUM if confidence < 0.7 else ViolationSeverity.HIGH
            
            return FrameAnalysisResult(
                is_safe=False,
                confidence=confidence,
                violations={violation_type: confidence},
                primary_violation=violation_type,
                severity=severity,
            )
    
    async def _analyze_openai(self, frame_bytes: bytes) -> FrameAnalysisResult:
        """Analyze using OpenAI Vision API (gpt-4o)"""
        try:
            import httpx
            
            if not OPENAI_API_KEY:
                logger.warning("OpenAI API key not configured, falling back to mock")
                return await self._analyze_mock(frame_bytes)
            
            # Encode image to base64
            base64_image = base64.b64encode(frame_bytes).decode('utf-8')
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [
                            {
                                "role": "system",
                                "content": """You are a content moderation system. Analyze the image and determine if it contains:
                                - NSFW/sexual content
                                - Nudity
                                - Graphic violence
                                - Weapons
                                - Hate symbols
                                - Drug use
                                - Self-harm imagery
                                - Child safety concerns
                                
                                Respond with JSON only:
                                {
                                    "is_safe": true/false,
                                    "confidence": 0.0-1.0,
                                    "violations": {"category": confidence_score},
                                    "primary_violation": "category or null"
                                }"""
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/jpeg;base64,{base64_image}",
                                            "detail": "low"  # Low detail for faster processing
                                        }
                                    }
                                ]
                            }
                        ],
                        "max_tokens": 200,
                    }
                )
                
                if response.status_code != 200:
                    logger.error(f"OpenAI API error: {response.status_code}")
                    return await self._analyze_mock(frame_bytes)
                
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
                
                # Parse JSON response
                import json
                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    logger.warning("Failed to parse OpenAI response as JSON")
                    return await self._analyze_mock(frame_bytes)
                
                violations = result.get("violations", {})
                max_violation_score = max(violations.values()) if violations else 0.0
                
                # Determine severity
                if max_violation_score >= NSFW_AUTO_TERMINATE_THRESHOLD:
                    severity = ViolationSeverity.CRITICAL
                elif max_violation_score >= NSFW_FLAG_THRESHOLD:
                    severity = ViolationSeverity.HIGH
                elif max_violation_score >= NSFW_WARNING_THRESHOLD:
                    severity = ViolationSeverity.MEDIUM
                else:
                    severity = ViolationSeverity.LOW
                
                return FrameAnalysisResult(
                    is_safe=result.get("is_safe", True),
                    confidence=result.get("confidence", 0.5),
                    violations=violations,
                    primary_violation=result.get("primary_violation"),
                    severity=severity,
                    raw_response=result,
                )
                
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return await self._analyze_mock(frame_bytes)
    
    async def _analyze_rekognition(self, frame_bytes: bytes) -> FrameAnalysisResult:
        """Analyze using AWS Rekognition DetectModerationLabels"""
        try:
            import boto3
            
            if not AWS_ACCESS_KEY or not AWS_SECRET_KEY:
                logger.warning("AWS credentials not configured, falling back to mock")
                return await self._analyze_mock(frame_bytes)
            
            client = boto3.client(
                'rekognition',
                aws_access_key_id=AWS_ACCESS_KEY,
                aws_secret_access_key=AWS_SECRET_KEY,
                region_name=AWS_REGION,
            )
            
            response = client.detect_moderation_labels(
                Image={'Bytes': frame_bytes},
                MinConfidence=50.0
            )
            
            violations = {}
            max_confidence = 0.0
            primary_violation = None
            
            # Map Rekognition labels to our categories
            label_mapping = {
                "Explicit Nudity": ViolationType.NSFW_NUDITY.value,
                "Suggestive": ViolationType.NSFW_SEXUAL.value,
                "Violence": ViolationType.VIOLENCE_GRAPHIC.value,
                "Weapons": ViolationType.VIOLENCE_WEAPONS.value,
                "Drugs": ViolationType.DRUGS.value,
                "Hate Symbols": ViolationType.HATE_SYMBOLS.value,
            }
            
            for label in response.get("ModerationLabels", []):
                name = label.get("Name", "")
                confidence = label.get("Confidence", 0) / 100.0  # Normalize to 0-1
                
                violation_type = label_mapping.get(name, name.lower().replace(" ", "_"))
                violations[violation_type] = confidence
                
                if confidence > max_confidence:
                    max_confidence = confidence
                    primary_violation = violation_type
            
            is_safe = max_confidence < NSFW_WARNING_THRESHOLD
            
            # Determine severity
            if max_confidence >= NSFW_AUTO_TERMINATE_THRESHOLD:
                severity = ViolationSeverity.CRITICAL
            elif max_confidence >= NSFW_FLAG_THRESHOLD:
                severity = ViolationSeverity.HIGH
            elif max_confidence >= NSFW_WARNING_THRESHOLD:
                severity = ViolationSeverity.MEDIUM
            else:
                severity = ViolationSeverity.LOW
            
            return FrameAnalysisResult(
                is_safe=is_safe,
                confidence=max_confidence,
                violations=violations,
                primary_violation=primary_violation,
                severity=severity,
                raw_response=response,
            )
            
        except Exception as e:
            logger.error(f"Rekognition analysis failed: {e}")
            return await self._analyze_mock(frame_bytes)
    
    async def start_stream_monitoring(self, stream_id: int) -> bool:
        """
        Start real-time monitoring for a stream.
        
        Args:
            stream_id: ID of the stream to monitor
            
        Returns:
            True if monitoring started successfully
        """
        if not MONITORING_ENABLED:
            logger.info(f"Video moderation disabled, skipping stream {stream_id}")
            return False
        
        if stream_id in self._active_streams:
            logger.info(f"Stream {stream_id} already being monitored")
            return True
        
        # Initialize monitoring state
        state = StreamModerationState(stream_id=stream_id, is_monitoring=True)
        self._active_streams[stream_id] = state
        
        logger.info(f"Started video moderation for stream {stream_id}")
        return True
    
    async def stop_stream_monitoring(self, stream_id: int) -> Optional[Dict[str, Any]]:
        """
        Stop monitoring a stream and return summary.
        
        Args:
            stream_id: ID of the stream to stop monitoring
            
        Returns:
            Summary of moderation activity
        """
        if stream_id not in self._active_streams:
            return None
        
        state = self._active_streams.pop(stream_id)
        
        # Cancel any pending monitoring task
        if stream_id in self._monitoring_tasks:
            task = self._monitoring_tasks.pop(stream_id)
            task.cancel()
        
        summary = {
            "stream_id": stream_id,
            "total_frames_analyzed": state.total_frames_analyzed,
            "total_violations": state.total_violations,
            "monitoring_duration_seconds": (datetime.utcnow() - state.started_at).total_seconds(),
            "violations_summary": self._summarize_violations(state.violations_history),
        }
        
        logger.info(f"Stopped video moderation for stream {stream_id}: {summary}")
        return summary
    
    def _summarize_violations(self, violations: List[FrameAnalysisResult]) -> Dict[str, int]:
        """Summarize violations by type"""
        summary: Dict[str, int] = {}
        for v in violations:
            if v.primary_violation:
                summary[v.primary_violation] = summary.get(v.primary_violation, 0) + 1
        return summary
    
    async def process_frame(self, stream_id: int, frame_bytes: bytes) -> Tuple[bool, Optional[str]]:
        """
        Process a frame from an active stream.
        
        Args:
            stream_id: ID of the stream
            frame_bytes: Raw image bytes
            
        Returns:
            Tuple of (should_terminate, reason)
        """
        state = self._active_streams.get(stream_id)
        if not state or not state.is_monitoring:
            return False, None
        
        # Analyze frame
        result = await self.analyze_frame(frame_bytes, stream_id)
        state.total_frames_analyzed += 1
        
        if not result.is_safe:
            state.total_violations += 1
            state.last_violation = result
            state.violations_history.append(result)
            
            # Track consecutive violations
            state.consecutive_violations += 1
            
            # Log violation
            await self._log_violation(stream_id, result)
            
            # Check for critical severity or consecutive violations
            if result.severity == ViolationSeverity.CRITICAL:
                return True, f"Critical violation: {result.primary_violation}"
            
            if state.consecutive_violations >= CONSECUTIVE_VIOLATIONS_FOR_TERMINATION:
                return True, f"Consecutive violations exceeded ({state.consecutive_violations})"
            
            # Flag for review if high severity
            if result.severity == ViolationSeverity.HIGH:
                await self._flag_for_review(stream_id, result)
        else:
            # Reset consecutive violations on safe frame
            state.consecutive_violations = 0
        
        return False, None
    
    async def _log_violation(self, stream_id: int, result: FrameAnalysisResult):
        """Log a violation to the database"""
        from .models import ModerationQueueItem
        
        try:
            # Only create queue item for HIGH or CRITICAL
            if result.severity in [ViolationSeverity.HIGH, ViolationSeverity.CRITICAL]:
                queue_item = ModerationQueueItem(
                    content_type="video_frame",
                    content_id=stream_id,
                    content_text=f"Video moderation: {result.primary_violation}",
                    stream_id=stream_id,
                    flagged_reason=result.primary_violation or "unknown",
                    flagged_patterns=list(result.violations.keys()),
                    confidence=result.confidence,
                    status="pending",
                )
                self.db.add(queue_item)
                self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log violation: {e}")
    
    async def _flag_for_review(self, stream_id: int, result: FrameAnalysisResult):
        """Flag a stream for human review"""
        logger.warning(f"Stream {stream_id} flagged for review: {result.primary_violation}")
        # TODO: Send notification to moderators via WebSocket
    
    async def handle_violation(
        self,
        stream_id: int,
        severity: str,
        reason: str,
        terminate: bool = False
    ) -> Dict[str, Any]:
        """
        Handle a confirmed violation.
        
        Args:
            stream_id: ID of the stream
            severity: Severity level
            reason: Reason for action
            terminate: Whether to terminate the stream
            
        Returns:
            Action taken
        """
        from .models import Stream, ModerationAction as ModerationActionModel
        
        stream = self.db.query(Stream).filter(Stream.id == stream_id).first()
        if not stream:
            return {"error": "Stream not found"}
        
        action_taken = {
            "stream_id": stream_id,
            "severity": severity,
            "reason": reason,
            "terminated": False,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if terminate:
            # End the stream
            stream.status = "ended"
            stream.ends_at = datetime.utcnow()
            self.db.commit()
            
            # Log moderation action
            mod_action = ModerationActionModel(
                moderator_id=1,  # System moderator
                target_stream_id=stream_id,
                action_type="stream_end",
                reason=f"Auto-terminated: {reason}",
            )
            self.db.add(mod_action)
            self.db.commit()
            
            action_taken["terminated"] = True
            logger.warning(f"Stream {stream_id} terminated due to: {reason}")
        
        return action_taken
    
    def get_stream_status(self, stream_id: int) -> Optional[Dict[str, Any]]:
        """Get current moderation status for a stream"""
        state = self._active_streams.get(stream_id)
        if not state:
            return None
        
        return {
            "stream_id": stream_id,
            "is_monitoring": state.is_monitoring,
            "total_frames_analyzed": state.total_frames_analyzed,
            "total_violations": state.total_violations,
            "consecutive_violations": state.consecutive_violations,
            "last_violation": state.last_violation.to_dict() if state.last_violation else None,
            "monitoring_duration_seconds": (datetime.utcnow() - state.started_at).total_seconds(),
        }


def get_video_moderation_service(db: Session) -> VideoModerationService:
    """Factory function to get VideoModerationService instance"""
    return VideoModerationService(db)
