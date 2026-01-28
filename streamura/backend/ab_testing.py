"""
Streamura A/B Testing Framework

Comprehensive A/B testing and experimentation framework for:
- Discovery algorithm experiments
- UI/UX feature tests
- Recommendation engine optimization
- Monetization experiments

Supports statistical significance calculation and automatic rollout.
"""

import hashlib
import random
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import math

logger = logging.getLogger(__name__)


class ExperimentStatus(str, Enum):
    """Status of an experiment."""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ROLLED_OUT = "rolled_out"
    ABANDONED = "abandoned"


class VariantType(str, Enum):
    """Type of variant."""
    CONTROL = "control"
    TREATMENT = "treatment"


@dataclass
class Variant:
    """A variant in an experiment."""
    id: str
    name: str
    variant_type: VariantType
    weight: float  # 0.0 to 1.0
    config: Dict[str, Any] = field(default_factory=dict)
    

@dataclass
class MetricDefinition:
    """Definition of a metric to track."""
    name: str
    description: str
    aggregation: str  # "sum", "mean", "count", "rate"
    higher_is_better: bool = True
    minimum_sample_size: int = 100


@dataclass
class ExperimentResult:
    """Results for an experiment variant."""
    variant_id: str
    sample_size: int
    metric_values: Dict[str, float]
    confidence_intervals: Dict[str, tuple]
    

@dataclass
class Experiment:
    """A/B test experiment."""
    id: str
    name: str
    description: str
    hypothesis: str
    owner: str
    status: ExperimentStatus
    variants: List[Variant]
    metrics: List[MetricDefinition]
    target_sample_size: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    traffic_allocation: float = 1.0  # Percentage of traffic in experiment
    targeting: Dict[str, Any] = field(default_factory=dict)
    guardrail_metrics: List[str] = field(default_factory=list)
    results: Dict[str, ExperimentResult] = field(default_factory=dict)


class ABTestingService:
    """
    A/B Testing Service.
    
    Manages experiments, variant assignment, and result analysis.
    """
    
    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
        self.assignments: Dict[str, Dict[str, str]] = {}  # user_id -> experiment_id -> variant_id
        self._salt = "streamura_ab_2026"
    
    def create_experiment(
        self,
        id: str,
        name: str,
        description: str,
        hypothesis: str,
        owner: str,
        variants: List[Dict[str, Any]],
        metrics: List[Dict[str, Any]],
        target_sample_size: int = 1000,
        traffic_allocation: float = 1.0,
        targeting: Optional[Dict[str, Any]] = None,
        guardrail_metrics: Optional[List[str]] = None,
    ) -> Experiment:
        """Create a new experiment."""
        
        # Create variants
        variant_objects = []
        for v in variants:
            variant_objects.append(Variant(
                id=v["id"],
                name=v["name"],
                variant_type=VariantType(v.get("type", "treatment")),
                weight=v.get("weight", 0.5),
                config=v.get("config", {}),
            ))
        
        # Normalize weights
        total_weight = sum(v.weight for v in variant_objects)
        for v in variant_objects:
            v.weight = v.weight / total_weight
        
        # Create metrics
        metric_objects = []
        for m in metrics:
            metric_objects.append(MetricDefinition(
                name=m["name"],
                description=m.get("description", ""),
                aggregation=m.get("aggregation", "mean"),
                higher_is_better=m.get("higher_is_better", True),
                minimum_sample_size=m.get("minimum_sample_size", 100),
            ))
        
        experiment = Experiment(
            id=id,
            name=name,
            description=description,
            hypothesis=hypothesis,
            owner=owner,
            status=ExperimentStatus.DRAFT,
            variants=variant_objects,
            metrics=metric_objects,
            target_sample_size=target_sample_size,
            traffic_allocation=traffic_allocation,
            targeting=targeting or {},
            guardrail_metrics=guardrail_metrics or [],
        )
        
        self.experiments[id] = experiment
        logger.info(f"Created experiment: {id} - {name}")
        
        return experiment
    
    def start_experiment(self, experiment_id: str) -> Experiment:
        """Start an experiment."""
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        if experiment.status != ExperimentStatus.DRAFT:
            raise ValueError(f"Experiment must be in DRAFT status to start")
        
        experiment.status = ExperimentStatus.RUNNING
        experiment.start_date = datetime.utcnow()
        
        logger.info(f"Started experiment: {experiment_id}")
        return experiment
    
    def stop_experiment(self, experiment_id: str) -> Experiment:
        """Stop an experiment."""
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        experiment.status = ExperimentStatus.COMPLETED
        experiment.end_date = datetime.utcnow()
        
        logger.info(f"Stopped experiment: {experiment_id}")
        return experiment
    
    def get_variant(
        self,
        experiment_id: str,
        user_id: str,
        user_attributes: Optional[Dict[str, Any]] = None
    ) -> Optional[Variant]:
        """
        Get the variant assignment for a user.
        
        Uses consistent hashing for deterministic assignment.
        """
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            return None
        
        if experiment.status != ExperimentStatus.RUNNING:
            return None
        
        # Check targeting criteria
        if not self._matches_targeting(experiment, user_attributes or {}):
            return None
        
        # Check traffic allocation
        if not self._in_traffic_allocation(experiment_id, user_id, experiment.traffic_allocation):
            return None
        
        # Check cached assignment
        if user_id in self.assignments and experiment_id in self.assignments[user_id]:
            variant_id = self.assignments[user_id][experiment_id]
            return next((v for v in experiment.variants if v.id == variant_id), None)
        
        # Assign variant using consistent hashing
        variant = self._assign_variant(experiment, user_id)
        
        # Cache assignment
        if user_id not in self.assignments:
            self.assignments[user_id] = {}
        self.assignments[user_id][experiment_id] = variant.id
        
        logger.debug(f"Assigned user {user_id} to variant {variant.id} in experiment {experiment_id}")
        return variant
    
    def track_event(
        self,
        experiment_id: str,
        user_id: str,
        metric_name: str,
        value: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Track a metric event for an experiment."""
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            return
        
        # Get user's variant
        variant_id = self.assignments.get(user_id, {}).get(experiment_id)
        if not variant_id:
            return
        
        # In production, this would write to a metrics store
        logger.debug(
            f"Tracked event: experiment={experiment_id}, variant={variant_id}, "
            f"metric={metric_name}, value={value}"
        )
    
    def get_results(self, experiment_id: str) -> Dict[str, Any]:
        """Get experiment results with statistical analysis."""
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        results = {
            "experiment_id": experiment_id,
            "name": experiment.name,
            "status": experiment.status.value,
            "start_date": experiment.start_date.isoformat() if experiment.start_date else None,
            "end_date": experiment.end_date.isoformat() if experiment.end_date else None,
            "variants": [],
            "winner": None,
            "can_conclude": False,
        }
        
        # Calculate results for each variant
        for variant in experiment.variants:
            variant_result = self._calculate_variant_results(experiment, variant)
            results["variants"].append(variant_result)
        
        # Determine winner if statistically significant
        results["winner"], results["can_conclude"] = self._determine_winner(
            experiment, results["variants"]
        )
        
        return results
    
    def rollout_winner(self, experiment_id: str, variant_id: str) -> Dict[str, Any]:
        """Rollout the winning variant to all users."""
        experiment = self.experiments.get(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment not found: {experiment_id}")
        
        # Set winning variant to 100%
        for variant in experiment.variants:
            if variant.id == variant_id:
                variant.weight = 1.0
            else:
                variant.weight = 0.0
        
        experiment.status = ExperimentStatus.ROLLED_OUT
        experiment.end_date = datetime.utcnow()
        
        logger.info(f"Rolled out variant {variant_id} for experiment {experiment_id}")
        
        return {
            "experiment_id": experiment_id,
            "rolled_out_variant": variant_id,
            "status": experiment.status.value,
        }
    
    def _matches_targeting(
        self,
        experiment: Experiment,
        user_attributes: Dict[str, Any]
    ) -> bool:
        """Check if user matches targeting criteria."""
        targeting = experiment.targeting
        
        if not targeting:
            return True
        
        # Check each targeting criterion
        for key, value in targeting.items():
            user_value = user_attributes.get(key)
            
            if isinstance(value, list):
                if user_value not in value:
                    return False
            elif isinstance(value, dict):
                # Range check
                if "min" in value and user_value < value["min"]:
                    return False
                if "max" in value and user_value > value["max"]:
                    return False
            else:
                if user_value != value:
                    return False
        
        return True
    
    def _in_traffic_allocation(
        self,
        experiment_id: str,
        user_id: str,
        allocation: float
    ) -> bool:
        """Check if user is in traffic allocation."""
        hash_input = f"{self._salt}:{experiment_id}:traffic:{user_id}"
        hash_value = int(hashlib.sha256(hash_input.encode()).hexdigest(), 16)
        bucket = (hash_value % 10000) / 10000.0
        return bucket < allocation
    
    def _assign_variant(self, experiment: Experiment, user_id: str) -> Variant:
        """Assign a variant using consistent hashing."""
        hash_input = f"{self._salt}:{experiment.id}:{user_id}"
        hash_value = int(hashlib.sha256(hash_input.encode()).hexdigest(), 16)
        bucket = (hash_value % 10000) / 10000.0
        
        cumulative_weight = 0.0
        for variant in experiment.variants:
            cumulative_weight += variant.weight
            if bucket < cumulative_weight:
                return variant
        
        # Fallback to last variant
        return experiment.variants[-1]
    
    def _calculate_variant_results(
        self,
        experiment: Experiment,
        variant: Variant
    ) -> Dict[str, Any]:
        """Calculate results for a variant."""
        # In production, query metrics from data store
        # Here we return mock data
        sample_size = random.randint(500, 1500)
        
        metrics = {}
        for metric in experiment.metrics:
            if metric.aggregation == "rate":
                value = random.uniform(0.02, 0.15)
            elif metric.aggregation == "mean":
                value = random.uniform(10, 100)
            else:
                value = random.randint(100, 10000)
            
            # Calculate confidence interval (simplified)
            std_error = value * 0.1 / math.sqrt(sample_size)
            ci_lower = value - 1.96 * std_error
            ci_upper = value + 1.96 * std_error
            
            metrics[metric.name] = {
                "value": round(value, 4),
                "ci_lower": round(ci_lower, 4),
                "ci_upper": round(ci_upper, 4),
            }
        
        return {
            "variant_id": variant.id,
            "variant_name": variant.name,
            "variant_type": variant.variant_type.value,
            "sample_size": sample_size,
            "metrics": metrics,
        }
    
    def _determine_winner(
        self,
        experiment: Experiment,
        variant_results: List[Dict[str, Any]]
    ) -> tuple:
        """Determine if there's a statistically significant winner."""
        if len(variant_results) < 2:
            return None, False
        
        # Find control and treatment
        control = next((v for v in variant_results if v["variant_type"] == "control"), None)
        treatments = [v for v in variant_results if v["variant_type"] == "treatment"]
        
        if not control or not treatments:
            return None, False
        
        # Check primary metric (first metric)
        primary_metric = experiment.metrics[0].name
        higher_is_better = experiment.metrics[0].higher_is_better
        
        best_treatment = None
        best_improvement = 0
        
        for treatment in treatments:
            control_value = control["metrics"][primary_metric]["value"]
            treatment_value = treatment["metrics"][primary_metric]["value"]
            
            if control_value == 0:
                continue
            
            improvement = (treatment_value - control_value) / control_value
            
            if higher_is_better and improvement > best_improvement:
                best_improvement = improvement
                best_treatment = treatment
            elif not higher_is_better and improvement < best_improvement:
                best_improvement = improvement
                best_treatment = treatment
        
        # Check statistical significance (simplified)
        if best_treatment:
            control_ci = control["metrics"][primary_metric]["ci_upper"]
            treatment_ci = best_treatment["metrics"][primary_metric]["ci_lower"]
            
            if higher_is_better and treatment_ci > control_ci:
                return best_treatment["variant_id"], True
            elif not higher_is_better and treatment_ci < control_ci:
                return best_treatment["variant_id"], True
        
        # Check if we have enough data to conclude
        total_samples = sum(v["sample_size"] for v in variant_results)
        can_conclude = total_samples >= experiment.target_sample_size
        
        return None, can_conclude


# =============================================================================
# PREDEFINED DISCOVERY EXPERIMENTS
# =============================================================================

def create_discovery_experiment(service: ABTestingService) -> Experiment:
    """Create a discovery algorithm A/B test."""
    return service.create_experiment(
        id="discovery_ranking_v2",
        name="Discovery Ranking Algorithm V2",
        description="Testing new ranking factors for stream discovery",
        hypothesis="Including social signals will increase engagement",
        owner="discovery-team",
        variants=[
            {
                "id": "control",
                "name": "Current Algorithm",
                "type": "control",
                "weight": 0.5,
                "config": {"algorithm": "v1", "social_weight": 0.0},
            },
            {
                "id": "treatment",
                "name": "Social Signals",
                "type": "treatment",
                "weight": 0.5,
                "config": {"algorithm": "v2", "social_weight": 0.3},
            },
        ],
        metrics=[
            {
                "name": "stream_click_rate",
                "description": "Rate at which users click on streams",
                "aggregation": "rate",
                "higher_is_better": True,
            },
            {
                "name": "avg_watch_time",
                "description": "Average watch time per session",
                "aggregation": "mean",
                "higher_is_better": True,
            },
            {
                "name": "follow_rate",
                "description": "Rate at which users follow creators",
                "aggregation": "rate",
                "higher_is_better": True,
            },
        ],
        target_sample_size=10000,
        traffic_allocation=0.2,  # 20% of traffic
        guardrail_metrics=["page_load_time", "error_rate"],
    )


def create_recommendation_experiment(service: ABTestingService) -> Experiment:
    """Create a recommendation engine A/B test."""
    return service.create_experiment(
        id="rec_engine_cold_start",
        name="Cold Start Recommendations",
        description="Testing ML-based cold start recommendations",
        hypothesis="ML embeddings improve new user retention",
        owner="recommendations-team",
        variants=[
            {
                "id": "control",
                "name": "Popular Content",
                "type": "control",
                "weight": 0.5,
                "config": {"strategy": "popularity"},
            },
            {
                "id": "ml_embeddings",
                "name": "ML Embeddings",
                "type": "treatment",
                "weight": 0.5,
                "config": {"strategy": "ml_embeddings", "model_version": "v3"},
            },
        ],
        metrics=[
            {
                "name": "day7_retention",
                "description": "7-day retention rate",
                "aggregation": "rate",
                "higher_is_better": True,
            },
            {
                "name": "streams_watched_first_week",
                "description": "Streams watched in first week",
                "aggregation": "mean",
                "higher_is_better": True,
            },
        ],
        target_sample_size=5000,
        targeting={"is_new_user": True, "account_age_days": {"max": 7}},
    )


# Global A/B testing service instance
ab_testing_service = ABTestingService()
