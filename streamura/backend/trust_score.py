"""
Streamura Trust Score Engine

Comprehensive trust scoring system that evaluates creators based on:
- Identity verification status
- Account age and activity
- Streaming history and consistency
- Engagement quality
- Content moderation history
- Community standing

The Trust Score (0-100) is a key DNA Strand differentiator that:
- Enables content verification for viewers
- Powers discovery and recommendation ranking
- Determines monetization tier eligibility
- Creates moat as score is not transferable
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
import logging

from .models import (
    User, Stream, Transaction, Tip, UserFollow, 
    StreamLike, ChatMessage, Report, ModerationAction,
    Subscription
)

logger = logging.getLogger(__name__)


# Trust Score Weight Configuration
TRUST_WEIGHTS = {
    "identity_verification": 0.20,   # KYC verified
    "account_age": 0.10,             # Older accounts more trusted
    "streaming_history": 0.20,       # Consistent streaming
    "engagement_quality": 0.15,      # Authentic engagement
    "content_quality": 0.15,         # Low moderation issues
    "community_standing": 0.10,      # Followers, subscribers
    "financial_history": 0.10,       # Payment history
}


class TrustScoreEngine:
    """
    Comprehensive Trust Score calculation engine.
    
    Produces a 0-100 score with detailed breakdown and explanation.
    All scoring is evidence-based with audit trail.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    async def calculate_trust_score(
        self, 
        user_id: int,
        include_breakdown: bool = True
    ) -> Dict:
        """
        Calculate comprehensive trust score for a user.
        
        Returns:
            {
                "score": float (0-100),
                "tier": str (unverified, bronze, silver, gold, platinum),
                "breakdown": {...} optional detailed breakdown,
                "recommendations": [...] how to improve score,
                "calculated_at": datetime
            }
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {
                "score": 0.0,
                "tier": "unknown",
                "error": "User not found",
                "calculated_at": datetime.utcnow().isoformat()
            }
        
        breakdown = {}
        total_score = 0.0
        recommendations = []
        
        # 1. Identity Verification (0-20 points)
        identity_score, identity_rec = self._calculate_identity_score(user)
        breakdown["identity_verification"] = {
            "score": identity_score,
            "max": 20,
            "factors": {
                "email_verified": user.is_verified,
                "kyc_complete": user.stripe_onboarding_complete,
                "payout_enabled": user.payout_enabled
            }
        }
        total_score += identity_score
        recommendations.extend(identity_rec)
        
        # 2. Account Age (0-10 points)
        age_score, age_rec = self._calculate_age_score(user)
        breakdown["account_age"] = {
            "score": age_score,
            "max": 10,
            "factors": {
                "days_old": (datetime.utcnow() - user.created_at).days if user.created_at else 0,
                "last_active": user.last_login.isoformat() if user.last_login else None
            }
        }
        total_score += age_score
        recommendations.extend(age_rec)
        
        # 3. Streaming History (0-20 points)
        stream_score, stream_rec = await self._calculate_streaming_score(user_id)
        breakdown["streaming_history"] = {
            "score": stream_score,
            "max": 20,
            "factors": stream_rec.get("factors", {})
        }
        total_score += stream_score
        recommendations.extend(stream_rec.get("recommendations", []))
        
        # 4. Engagement Quality (0-15 points)
        engagement_score, engagement_rec = await self._calculate_engagement_score(user_id)
        breakdown["engagement_quality"] = {
            "score": engagement_score,
            "max": 15,
            "factors": engagement_rec.get("factors", {})
        }
        total_score += engagement_score
        recommendations.extend(engagement_rec.get("recommendations", []))
        
        # 5. Content Quality (0-15 points)
        content_score, content_rec = await self._calculate_content_score(user)
        breakdown["content_quality"] = {
            "score": content_score,
            "max": 15,
            "factors": {
                "warning_count": user.warning_count,
                "mute_count": user.mute_count or 0,
                "moderation_score": user.moderation_score
            }
        }
        total_score += content_score
        recommendations.extend(content_rec)
        
        # 6. Community Standing (0-10 points)
        community_score, community_rec = self._calculate_community_score(user)
        breakdown["community_standing"] = {
            "score": community_score,
            "max": 10,
            "factors": {
                "follower_count": user.follower_count,
                "subscriber_count": user.subscriber_count
            }
        }
        total_score += community_score
        recommendations.extend(community_rec)
        
        # 7. Financial History (0-10 points)
        financial_score, financial_rec = await self._calculate_financial_score(user)
        breakdown["financial_history"] = {
            "score": financial_score,
            "max": 10,
            "factors": {
                "lifetime_earnings": float(user.lifetime_earnings or 0),
                "payout_history": "available" if user.payout_enabled else "none"
            }
        }
        total_score += financial_score
        recommendations.extend(financial_rec)
        
        # Determine tier
        tier = self._determine_tier(total_score)
        
        result = {
            "score": round(total_score, 1),
            "tier": tier,
            "recommendations": recommendations[:5],  # Top 5 recommendations
            "calculated_at": datetime.utcnow().isoformat()
        }
        
        if include_breakdown:
            result["breakdown"] = breakdown
        
        # Update user's trust score
        user.trust_score = total_score / 100  # Store as 0-1 for compatibility
        self.db.commit()
        
        return result
    
    def _calculate_identity_score(self, user: User) -> Tuple[float, List[str]]:
        """Score identity verification (0-20 points)."""
        score = 0.0
        recommendations = []
        
        # Email verified (5 points)
        if user.is_verified:
            score += 5.0
        else:
            recommendations.append("Verify your email address to increase trust score")
        
        # Stripe onboarding complete (10 points)
        if user.stripe_onboarding_complete:
            score += 10.0
        else:
            recommendations.append("Complete payment setup to enable monetization")
        
        # Payout enabled (5 points)
        if user.payout_enabled:
            score += 5.0
        
        return score, recommendations
    
    def _calculate_age_score(self, user: User) -> Tuple[float, List[str]]:
        """Score account age (0-10 points)."""
        recommendations = []
        
        if not user.created_at:
            return 0.0, recommendations
        
        days_old = (datetime.utcnow() - user.created_at).days
        
        # Scale: 0 days = 0 points, 365+ days = 10 points
        score = min(10.0, days_old / 36.5)
        
        if days_old < 30:
            recommendations.append("Account age affects trust - stay active to build history")
        
        return score, recommendations
    
    async def _calculate_streaming_score(self, user_id: int) -> Tuple[float, Dict]:
        """Score streaming history (0-20 points)."""
        factors = {}
        recommendations = []
        
        # Get streaming stats
        streams = self.db.query(Stream).filter(
            Stream.user_id == user_id,
            Stream.status == "ended"
        ).all()
        
        total_streams = len(streams)
        factors["total_streams"] = total_streams
        
        # Base score for stream count (0-10 points)
        count_score = min(10.0, total_streams / 5)  # 50+ streams = max
        
        # Consistency score (0-5 points)
        consistency_score = 0.0
        if total_streams >= 5:
            # Check if streams are spread over time
            stream_dates = [s.created_at for s in streams if s.created_at]
            if len(stream_dates) >= 2:
                date_range = (max(stream_dates) - min(stream_dates)).days
                if date_range > 0:
                    streams_per_week = total_streams / (date_range / 7)
                    consistency_score = min(5.0, streams_per_week)
                    factors["streams_per_week"] = round(streams_per_week, 1)
        
        # Quality score (0-5 points) - based on average viewer retention
        quality_score = 0.0
        if streams:
            avg_viewers = sum(s.peak_viewers or 0 for s in streams) / len(streams)
            quality_score = min(5.0, avg_viewers / 20)  # 100+ avg = max
            factors["avg_peak_viewers"] = round(avg_viewers, 1)
        
        total_score = count_score + consistency_score + quality_score
        
        if total_streams < 5:
            recommendations.append("Stream more often to build your reputation")
        
        return total_score, {"factors": factors, "recommendations": recommendations}
    
    async def _calculate_engagement_score(self, user_id: int) -> Tuple[float, Dict]:
        """Score engagement quality (0-15 points)."""
        factors = {}
        recommendations = []
        
        # Get tips received
        tips_received = self.db.query(Tip).filter(
            Tip.to_user_id == user_id,
            Tip.status == "completed"
        ).count()
        factors["tips_received"] = tips_received
        
        # Get unique tippers
        unique_tippers = self.db.query(func.count(func.distinct(Tip.from_user_id))).filter(
            Tip.to_user_id == user_id,
            Tip.status == "completed"
        ).scalar() or 0
        factors["unique_supporters"] = unique_tippers
        
        # Tip diversity score (0-8 points)
        tip_score = min(8.0, unique_tippers / 5)  # 40+ unique = max
        
        # Stream likes (0-4 points)
        likes = self.db.query(StreamLike).join(Stream).filter(
            Stream.user_id == user_id
        ).count()
        like_score = min(4.0, likes / 50)  # 200+ = max
        factors["stream_likes"] = likes
        
        # Chat engagement (0-3 points)
        chat_msgs = self.db.query(ChatMessage).join(Stream).filter(
            Stream.user_id == user_id
        ).count()
        chat_score = min(3.0, chat_msgs / 100)  # 300+ = max
        factors["chat_messages"] = chat_msgs
        
        total_score = tip_score + like_score + chat_score
        
        if unique_tippers < 5:
            recommendations.append("Engage with viewers to grow your supporter base")
        
        return total_score, {"factors": factors, "recommendations": recommendations}
    
    async def _calculate_content_score(self, user: User) -> Tuple[float, List[str]]:
        """Score content quality based on moderation history (0-15 points)."""
        recommendations = []
        
        # Start with full score, deduct for issues
        score = 15.0
        
        # Deduct for warnings (3 points each)
        score -= (user.warning_count or 0) * 3
        
        # Deduct for mutes (2 points each)
        score -= (user.mute_count or 0) * 2
        
        # Factor in moderation score (0-1 scale)
        if user.moderation_score and user.moderation_score < 1.0:
            score -= (1.0 - user.moderation_score) * 5
        
        # Check for active bans
        if user.is_banned:
            score = 0.0
            recommendations.append("Account is currently banned")
        
        score = max(0.0, score)
        
        if score < 10:
            recommendations.append("Avoid content policy violations to improve trust")
        
        return score, recommendations
    
    def _calculate_community_score(self, user: User) -> Tuple[float, List[str]]:
        """Score community standing (0-10 points)."""
        recommendations = []
        
        followers = user.follower_count or 0
        subscribers = user.subscriber_count or 0
        
        # Follower score (0-6 points)
        follower_score = min(6.0, followers / 200)  # 1000+ = max
        
        # Subscriber score (0-4 points)
        subscriber_score = min(4.0, subscribers / 25)  # 100+ = max
        
        total_score = follower_score + subscriber_score
        
        if followers < 50:
            recommendations.append("Grow your following by streaming consistently")
        
        return total_score, recommendations
    
    async def _calculate_financial_score(self, user: User) -> Tuple[float, List[str]]:
        """Score financial history (0-10 points)."""
        recommendations = []
        
        earnings = float(user.lifetime_earnings or 0)
        
        # Earnings score (0-7 points)
        earnings_score = min(7.0, earnings / 1500)  # $10,000+ = max
        
        # Payout history (0-3 points)
        payout_score = 0.0
        if user.payout_enabled:
            payout_score = 3.0
        
        total_score = earnings_score + payout_score
        
        if earnings == 0:
            recommendations.append("Start earning to build your creator track record")
        
        return total_score, recommendations
    
    def _determine_tier(self, score: float) -> str:
        """Determine trust tier based on score."""
        if score >= 90:
            return "platinum"
        elif score >= 75:
            return "gold"
        elif score >= 50:
            return "silver"
        elif score >= 25:
            return "bronze"
        else:
            return "unverified"
    
    async def get_trust_badge(self, user_id: int) -> Dict:
        """Get simplified trust badge for display."""
        result = await self.calculate_trust_score(user_id, include_breakdown=False)
        
        tier_badges = {
            "platinum": {"icon": "⭐⭐⭐", "color": "#E5E4E2", "label": "Platinum Creator"},
            "gold": {"icon": "⭐⭐", "color": "#FFD700", "label": "Gold Creator"},
            "silver": {"icon": "⭐", "color": "#C0C0C0", "label": "Silver Creator"},
            "bronze": {"icon": "🥉", "color": "#CD7F32", "label": "Bronze Creator"},
            "unverified": {"icon": "❓", "color": "#808080", "label": "New Creator"}
        }
        
        badge = tier_badges.get(result["tier"], tier_badges["unverified"])
        badge["score"] = result["score"]
        badge["tier"] = result["tier"]
        
        return badge


def get_trust_score_engine(db: Session) -> TrustScoreEngine:
    """Factory function to get TrustScoreEngine instance."""
    return TrustScoreEngine(db)
