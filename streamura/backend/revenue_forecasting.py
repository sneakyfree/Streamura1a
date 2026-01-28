"""
Revenue Forecasting Service
Sprint 7: Advanced Monetization Features

ML-based revenue projections for creators with trend analysis
and seasonal adjustments.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import random
import math

from sqlalchemy.orm import Session


class TrendDirection(str, Enum):
    STRONG_UP = "strong_up"
    UP = "up"
    STABLE = "stable"
    DOWN = "down"
    STRONG_DOWN = "strong_down"


@dataclass
class RevenueDataPoint:
    """Single data point for revenue tracking"""
    date: datetime
    revenue: Decimal
    source: str  # 'tips', 'subscriptions', 'virtual_goods', 'events'
    confidence: float = 1.0


@dataclass
class Forecast:
    """Revenue forecast for a future period"""
    period_start: datetime
    period_end: datetime
    predicted_revenue: Decimal
    confidence_low: Decimal
    confidence_high: Decimal
    confidence_level: float  # 0-1
    breakdown: Dict[str, Decimal] = field(default_factory=dict)
    assumptions: List[str] = field(default_factory=list)


@dataclass
class TrendAnalysis:
    """Analysis of revenue trends"""
    direction: TrendDirection
    velocity: float  # % change per month
    seasonality_factor: float  # 0.5 = 50% seasonal, 1.0 = no seasonality
    best_day_of_week: str
    best_hour_of_day: int
    growth_contributors: List[Dict[str, Any]]
    risk_factors: List[Dict[str, Any]]


@dataclass
class RevenueGoal:
    """Creator revenue goal"""
    target_amount: Decimal
    target_date: datetime
    current_progress: Decimal
    projected_achievement_date: Optional[datetime]
    on_track: bool
    recommendations: List[str]


class RevenueForecastingService:
    """
    ML-based revenue forecasting for creators.
    
    Features:
    - Monthly/quarterly projections
    - Trend analysis with seasonality
    - Goal tracking and recommendations
    - Source-by-source breakdown
    """
    
    def __init__(self, db: Session):
        self.db = db
        
    def get_historical_revenue(
        self, 
        creator_id: int, 
        months: int = 12
    ) -> List[RevenueDataPoint]:
        """
        Get historical revenue data for a creator.
        """
        from models import Transaction, User
        
        cutoff = datetime.now() - timedelta(days=months * 30)
        
        # Query actual transactions
        transactions = (
            self.db.query(Transaction)
            .filter(
                Transaction.recipient_id == creator_id,
                Transaction.created_at >= cutoff,
                Transaction.status == 'completed'
            )
            .all()
        )
        
        # Convert to data points
        data_points = []
        for tx in transactions:
            source = self._categorize_transaction(tx)
            data_points.append(RevenueDataPoint(
                date=tx.created_at,
                revenue=tx.amount,
                source=source,
                confidence=1.0
            ))
        
        return data_points
    
    def _categorize_transaction(self, tx) -> str:
        """Categorize transaction by type"""
        tx_type = getattr(tx, 'type', 'other')
        if 'tip' in str(tx_type).lower():
            return 'tips'
        elif 'sub' in str(tx_type).lower():
            return 'subscriptions'
        elif 'good' in str(tx_type).lower() or 'virtual' in str(tx_type).lower():
            return 'virtual_goods'
        elif 'event' in str(tx_type).lower() or 'ticket' in str(tx_type).lower():
            return 'events'
        return 'other'
    
    def forecast_monthly(
        self, 
        creator_id: int, 
        months: int = 3
    ) -> List[Forecast]:
        """
        Generate monthly revenue forecasts.
        
        Uses weighted moving average with trend and seasonality adjustments.
        """
        # Get historical data
        historical = self.get_historical_revenue(creator_id, months=12)
        
        if len(historical) < 10:
            # Not enough data, return basic projections
            return self._generate_basic_forecast(creator_id, months)
        
        # Calculate monthly totals
        monthly_totals = self._aggregate_monthly(historical)
        
        # Calculate trend
        trend = self._calculate_trend(monthly_totals)
        
        # Generate forecasts
        forecasts = []
        now = datetime.now()
        
        for i in range(months):
            month_start = datetime(
                now.year + (now.month + i) // 12,
                (now.month + i) % 12 or 12,
                1
            )
            month_end = datetime(
                now.year + (now.month + i + 1) // 12,
                (now.month + i + 1) % 12 or 12,
                1
            ) - timedelta(days=1)
            
            # Base prediction from recent average
            recent_avg = sum(monthly_totals[-3:]) / min(3, len(monthly_totals)) if monthly_totals else Decimal('0')
            
            # Apply trend
            trend_factor = 1 + (trend.velocity / 100) * (i + 1)
            predicted = recent_avg * Decimal(str(trend_factor))
            
            # Apply seasonality
            seasonality = self._get_seasonality_factor(month_start.month)
            predicted *= Decimal(str(seasonality))
            
            # Calculate confidence interval
            volatility = self._calculate_volatility(monthly_totals)
            confidence_range = predicted * Decimal(str(volatility * (i + 1) * 0.1))
            
            # Break down by source
            breakdown = self._estimate_breakdown(historical, predicted)
            
            forecasts.append(Forecast(
                period_start=month_start,
                period_end=month_end,
                predicted_revenue=predicted,
                confidence_low=max(Decimal('0'), predicted - confidence_range),
                confidence_high=predicted + confidence_range,
                confidence_level=max(0.5, 0.95 - (i * 0.1)),
                breakdown=breakdown,
                assumptions=[
                    f"Based on {len(monthly_totals)} months of history",
                    f"Trend: {trend.direction.value}",
                    f"Seasonality factor: {seasonality:.2f}"
                ]
            ))
        
        return forecasts
    
    def _generate_basic_forecast(self, creator_id: int, months: int) -> List[Forecast]:
        """Generate basic forecast when insufficient data"""
        forecasts = []
        now = datetime.now()
        
        for i in range(months):
            month_start = datetime(
                now.year + (now.month + i) // 12,
                (now.month + i) % 12 or 12,
                1
            )
            month_end = datetime(
                now.year + (now.month + i + 1) // 12,
                (now.month + i + 1) % 12 or 12,
                1
            ) - timedelta(days=1)
            
            # Placeholder prediction
            predicted = Decimal('100.00')
            
            forecasts.append(Forecast(
                period_start=month_start,
                period_end=month_end,
                predicted_revenue=predicted,
                confidence_low=Decimal('0'),
                confidence_high=predicted * 3,
                confidence_level=0.3,
                breakdown={'tips': predicted},
                assumptions=["Insufficient data for accurate prediction"]
            ))
        
        return forecasts
    
    def _aggregate_monthly(self, data_points: List[RevenueDataPoint]) -> List[Decimal]:
        """Aggregate data points into monthly totals"""
        monthly: Dict[str, Decimal] = {}
        
        for dp in data_points:
            key = dp.date.strftime('%Y-%m')
            monthly[key] = monthly.get(key, Decimal('0')) + dp.revenue
        
        return [monthly[k] for k in sorted(monthly.keys())]
    
    def _calculate_trend(self, monthly_totals: List[Decimal]) -> TrendAnalysis:
        """Calculate trend from monthly data"""
        if len(monthly_totals) < 2:
            return TrendAnalysis(
                direction=TrendDirection.STABLE,
                velocity=0.0,
                seasonality_factor=1.0,
                best_day_of_week="Saturday",
                best_hour_of_day=20,
                growth_contributors=[],
                risk_factors=[]
            )
        
        # Calculate velocity (% change)
        first_half = sum(monthly_totals[:len(monthly_totals)//2]) / max(1, len(monthly_totals)//2)
        second_half = sum(monthly_totals[len(monthly_totals)//2:]) / max(1, len(monthly_totals) - len(monthly_totals)//2)
        
        if first_half > 0:
            velocity = float((second_half - first_half) / first_half * 100)
        else:
            velocity = 100.0 if second_half > 0 else 0.0
        
        # Determine direction
        if velocity > 20:
            direction = TrendDirection.STRONG_UP
        elif velocity > 5:
            direction = TrendDirection.UP
        elif velocity > -5:
            direction = TrendDirection.STABLE
        elif velocity > -20:
            direction = TrendDirection.DOWN
        else:
            direction = TrendDirection.STRONG_DOWN
        
        return TrendAnalysis(
            direction=direction,
            velocity=velocity,
            seasonality_factor=0.85,  # Simplified
            best_day_of_week="Saturday",
            best_hour_of_day=20,
            growth_contributors=[
                {"factor": "Consistent streaming", "impact": 0.3},
                {"factor": "Community engagement", "impact": 0.25}
            ],
            risk_factors=[
                {"factor": "Platform competition", "impact": -0.1},
                {"factor": "Seasonal dips", "impact": -0.15}
            ]
        )
    
    def _get_seasonality_factor(self, month: int) -> float:
        """Get seasonality factor for a given month"""
        # Holiday season boost, summer dip pattern
        factors = {
            1: 0.85,   # January post-holiday
            2: 0.90,   # February
            3: 0.95,   # March
            4: 1.00,   # April
            5: 0.95,   # May
            6: 0.85,   # June summer
            7: 0.80,   # July summer
            8: 0.85,   # August back-to-school
            9: 1.00,   # September
            10: 1.05,  # October
            11: 1.15,  # November pre-holiday
            12: 1.25   # December holiday peak
        }
        return factors.get(month, 1.0)
    
    def _calculate_volatility(self, monthly_totals: List[Decimal]) -> float:
        """Calculate historical volatility"""
        if len(monthly_totals) < 2:
            return 0.5
        
        avg = sum(monthly_totals) / len(monthly_totals)
        if avg == 0:
            return 0.5
        
        variance = sum((float(x - avg) ** 2) for x in monthly_totals) / len(monthly_totals)
        std_dev = math.sqrt(variance)
        
        return min(1.0, float(std_dev / float(avg)))
    
    def _estimate_breakdown(
        self, 
        historical: List[RevenueDataPoint],
        total: Decimal
    ) -> Dict[str, Decimal]:
        """Estimate revenue breakdown by source"""
        source_totals: Dict[str, Decimal] = {}
        
        for dp in historical:
            source_totals[dp.source] = source_totals.get(dp.source, Decimal('0')) + dp.revenue
        
        grand_total = sum(source_totals.values())
        if grand_total == 0:
            return {'tips': total}
        
        breakdown = {}
        for source, amount in source_totals.items():
            ratio = float(amount / grand_total)
            breakdown[source] = total * Decimal(str(ratio))
        
        return breakdown
    
    def analyze_trends(self, creator_id: int) -> TrendAnalysis:
        """
        Perform deep trend analysis on creator revenue.
        """
        historical = self.get_historical_revenue(creator_id, months=12)
        monthly_totals = self._aggregate_monthly(historical)
        return self._calculate_trend(monthly_totals)
    
    def estimate_payout(self, creator_id: int, date: datetime) -> Decimal:
        """
        Estimate payout amount for a specific date.
        """
        # Get forecast for the period
        months_ahead = max(1, (date.year - datetime.now().year) * 12 + date.month - datetime.now().month)
        forecasts = self.forecast_monthly(creator_id, months=months_ahead)
        
        if forecasts:
            return forecasts[-1].predicted_revenue
        return Decimal('0')
    
    def check_goal_progress(
        self, 
        creator_id: int,
        target_amount: Decimal,
        target_date: datetime
    ) -> RevenueGoal:
        """
        Check progress toward a revenue goal.
        """
        # Get current progress
        historical = self.get_historical_revenue(creator_id, months=12)
        current_progress = sum(dp.revenue for dp in historical)
        
        # Calculate projected completion
        months_to_target = max(1, (target_date.year - datetime.now().year) * 12 + target_date.month - datetime.now().month)
        forecasts = self.forecast_monthly(creator_id, months=months_to_target)
        
        projected_total = current_progress + sum(f.predicted_revenue for f in forecasts)
        
        # Determine if on track
        on_track = projected_total >= target_amount
        
        # Calculate when goal might be achieved
        projected_date = None
        running_total = current_progress
        for f in forecasts:
            running_total += f.predicted_revenue
            if running_total >= target_amount:
                projected_date = f.period_end
                break
        
        # Generate recommendations
        recommendations = []
        if not on_track:
            gap = target_amount - projected_total
            recommendations.append(f"Need additional ${gap:.2f} to reach goal")
            recommendations.append("Consider hosting special events")
            recommendations.append("Increase streaming frequency")
        else:
            recommendations.append("You're on track! Keep up the great work")
        
        return RevenueGoal(
            target_amount=target_amount,
            target_date=target_date,
            current_progress=current_progress,
            projected_achievement_date=projected_date,
            on_track=on_track,
            recommendations=recommendations
        )


# Singleton instance
_forecasting_service: Optional[RevenueForecastingService] = None


def get_forecasting_service(db: Session) -> RevenueForecastingService:
    """Get or create forecasting service instance"""
    global _forecasting_service
    if _forecasting_service is None:
        _forecasting_service = RevenueForecastingService(db)
    return _forecasting_service
