"""
Streamura Model-Agnostic Router

Routes AI tasks to appropriate providers with weighted load balancing,
automatic failover, and health tracking.

Based on DNA Strand Master Plan C.7 Model-Agnostic Design.
"""

import asyncio
import random
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Awaitable
from collections import defaultdict

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """Types of AI tasks that can be routed."""
    CONTENT_MODERATION = "content_moderation"
    TRANSCRIPTION = "transcription"
    EVENT_CLASSIFICATION = "event_classification"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    SPAM_DETECTION = "spam_detection"
    IMAGE_ANALYSIS = "image_analysis"
    TEXT_GENERATION = "text_generation"
    EMBEDDING = "embedding"


class ProviderStatus(Enum):
    """Health status of a provider."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"


@dataclass
class ModelProvider:
    """Represents an AI model provider configuration."""
    name: str
    model: str
    weight: float = 1.0
    is_available: bool = True
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    cost_per_call: float = 0.0
    max_retries: int = 2
    timeout_seconds: float = 30.0
    
    # Runtime metrics
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_latency_ms: float = 0.0
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None
    
    @property
    def status(self) -> ProviderStatus:
        """Calculate current provider status based on metrics."""
        if not self.is_available:
            return ProviderStatus.DISABLED
        if self.error_rate > 0.5:
            return ProviderStatus.UNHEALTHY
        if self.error_rate > 0.2 or self.avg_latency_ms > 5000:
            return ProviderStatus.DEGRADED
        return ProviderStatus.HEALTHY
    
    def record_success(self, latency_ms: float):
        """Record a successful call."""
        self.total_calls += 1
        self.successful_calls += 1
        self.total_latency_ms += latency_ms
        self.avg_latency_ms = self.total_latency_ms / self.total_calls
        self.error_rate = self.failed_calls / max(1, self.total_calls)
        self.last_success_time = datetime.utcnow()
    
    def record_failure(self, error: str):
        """Record a failed call."""
        self.total_calls += 1
        self.failed_calls += 1
        self.error_rate = self.failed_calls / max(1, self.total_calls)
        self.last_error = error
        self.last_error_time = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        """Serialize provider to dictionary."""
        return {
            "name": self.name,
            "model": self.model,
            "weight": self.weight,
            "is_available": self.is_available,
            "status": self.status.value,
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "error_rate": round(self.error_rate, 4),
            "cost_per_call": self.cost_per_call,
            "total_calls": self.total_calls,
            "successful_calls": self.successful_calls,
            "failed_calls": self.failed_calls,
            "last_error": self.last_error,
            "last_error_time": self.last_error_time.isoformat() if self.last_error_time else None,
            "last_success_time": self.last_success_time.isoformat() if self.last_success_time else None,
        }


class ModelRouterError(Exception):
    """Custom exception for model router errors."""
    def __init__(self, message: str, provider: Optional[str] = None, task_type: Optional[str] = None):
        self.message = message
        self.provider = provider
        self.task_type = task_type
        super().__init__(self.message)


# Type alias for provider executor functions
ProviderExecutor = Callable[[ModelProvider, TaskType, Any], Awaitable[Dict]]


class ModelRouter:
    """
    Routes AI tasks to appropriate providers with weighted load balancing.
    
    Features:
    - Weighted random selection across providers
    - Automatic failover on provider failure
    - Health tracking and circuit breaker
    - A/B testing support
    - Cost optimization hints
    """
    
    # Default provider configurations
    DEFAULT_PROVIDERS = {
        TaskType.CONTENT_MODERATION: [
            ModelProvider("openai", "gpt-4o", weight=0.5, cost_per_call=0.01),
            ModelProvider("anthropic", "claude-3-5-sonnet", weight=0.3, cost_per_call=0.015),
            ModelProvider("hive", "moderation-v3", weight=0.2, cost_per_call=0.002),
        ],
        TaskType.TRANSCRIPTION: [
            ModelProvider("deepgram", "nova-2", weight=0.7, cost_per_call=0.0043),
            ModelProvider("openai", "whisper-1", weight=0.3, cost_per_call=0.006),
        ],
        TaskType.EVENT_CLASSIFICATION: [
            ModelProvider("openai", "gpt-4o-mini", weight=0.6, cost_per_call=0.0005),
            ModelProvider("local", "bert-events", weight=0.4, cost_per_call=0.0001),
        ],
        TaskType.SENTIMENT_ANALYSIS: [
            ModelProvider("openai", "gpt-4o-mini", weight=0.5, cost_per_call=0.0005),
            ModelProvider("local", "sentiment-bert", weight=0.5, cost_per_call=0.0001),
        ],
        TaskType.SPAM_DETECTION: [
            ModelProvider("local", "spam-classifier", weight=0.8, cost_per_call=0.0001),
            ModelProvider("openai", "gpt-4o-mini", weight=0.2, cost_per_call=0.0005),
        ],
        TaskType.IMAGE_ANALYSIS: [
            ModelProvider("openai", "gpt-4o", weight=0.6, cost_per_call=0.02),
            ModelProvider("google", "gemini-1.5-flash", weight=0.4, cost_per_call=0.01),
        ],
        TaskType.TEXT_GENERATION: [
            ModelProvider("openai", "gpt-4o", weight=0.4, cost_per_call=0.01),
            ModelProvider("anthropic", "claude-3-5-sonnet", weight=0.4, cost_per_call=0.015),
            ModelProvider("google", "gemini-1.5-pro", weight=0.2, cost_per_call=0.007),
        ],
        TaskType.EMBEDDING: [
            ModelProvider("openai", "text-embedding-3-small", weight=0.7, cost_per_call=0.00002),
            ModelProvider("local", "all-MiniLM-L6-v2", weight=0.3, cost_per_call=0.00001),
        ],
    }
    
    def __init__(
        self,
        providers: Optional[Dict[TaskType, List[ModelProvider]]] = None,
        executor: Optional[ProviderExecutor] = None
    ):
        """
        Initialize the model router.
        
        Args:
            providers: Custom provider configurations per task type
            executor: Custom executor function for making actual API calls
        """
        self.providers: Dict[TaskType, List[ModelProvider]] = providers or {}
        
        # Initialize with defaults for missing task types
        for task_type, default_providers in self.DEFAULT_PROVIDERS.items():
            if task_type not in self.providers:
                # Deep copy default providers
                self.providers[task_type] = [
                    ModelProvider(
                        name=p.name,
                        model=p.model,
                        weight=p.weight,
                        cost_per_call=p.cost_per_call
                    )
                    for p in default_providers
                ]
        
        self._executor = executor or self._default_executor
        self._ab_tests: Dict[str, Dict] = {}
        self._metrics_history: Dict[str, List[Dict]] = defaultdict(list)
    
    async def _default_executor(
        self,
        provider: ModelProvider,
        task: TaskType,
        input_data: Any
    ) -> Dict:
        """
        Default executor that simulates provider calls.
        In production, this would make actual API calls.
        """
        # Simulate network latency
        latency = random.uniform(50, 500)
        await asyncio.sleep(latency / 1000)
        
        # Simulate occasional failures (5% rate)
        if random.random() < 0.05:
            raise ModelRouterError(
                f"Simulated failure for {provider.name}",
                provider=provider.name,
                task_type=task.value
            )
        
        return {
            "provider": provider.name,
            "model": provider.model,
            "result": f"Mock result from {provider.name}:{provider.model}",
            "latency_ms": latency,
            "task_type": task.value,
        }
    
    def route(self, task: TaskType) -> ModelProvider:
        """
        Select a provider using weighted random selection.
        
        Args:
            task: The task type to route
            
        Returns:
            Selected ModelProvider
            
        Raises:
            ModelRouterError: If no providers are available
        """
        available = [
            p for p in self.providers.get(task, [])
            if p.is_available and p.status != ProviderStatus.UNHEALTHY
        ]
        
        if not available:
            raise ModelRouterError(
                f"No healthy providers available for {task.value}",
                task_type=task.value
            )
        
        # Weighted random selection
        weights = [p.weight for p in available]
        total_weight = sum(weights)
        
        if total_weight == 0:
            # All weights are 0, select uniformly
            return random.choice(available)
        
        normalized_weights = [w / total_weight for w in weights]
        return random.choices(available, weights=normalized_weights)[0]
    
    async def execute(
        self,
        task: TaskType,
        input_data: Any,
        preferred_provider: Optional[str] = None
    ) -> Dict:
        """
        Route and execute a task with automatic failover.
        
        Args:
            task: The task type to execute
            input_data: Input data for the task
            preferred_provider: Optional specific provider to use
            
        Returns:
            Result dictionary from the provider
            
        Raises:
            ModelRouterError: If all providers fail
        """
        attempted_providers: List[str] = []
        last_error: Optional[Exception] = None
        
        # If preferred provider specified, try it first
        if preferred_provider:
            provider = next(
                (p for p in self.providers.get(task, []) 
                 if p.name == preferred_provider and p.is_available),
                None
            )
            if provider:
                try:
                    return await self._execute_with_provider(provider, task, input_data)
                except Exception as e:
                    attempted_providers.append(provider.name)
                    last_error = e
                    logger.warning(f"Preferred provider {provider.name} failed: {e}")
        
        # Try providers with failover
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                provider = self.route(task)
                
                # Skip already attempted providers
                if provider.name in attempted_providers:
                    continue
                
                result = await self._execute_with_provider(provider, task, input_data)
                return result
                
            except ModelRouterError as e:
                attempted_providers.append(e.provider or "unknown")
                last_error = e
                logger.warning(f"Provider failed on attempt {attempt + 1}: {e}")
                continue
        
        raise ModelRouterError(
            f"All providers failed for {task.value}. Attempted: {attempted_providers}",
            task_type=task.value
        )
    
    async def _execute_with_provider(
        self,
        provider: ModelProvider,
        task: TaskType,
        input_data: Any
    ) -> Dict:
        """Execute a task with a specific provider and record metrics."""
        start_time = time.time()
        
        try:
            result = await asyncio.wait_for(
                self._executor(provider, task, input_data),
                timeout=provider.timeout_seconds
            )
            
            latency_ms = (time.time() - start_time) * 1000
            provider.record_success(latency_ms)
            
            # Add metadata to result
            result["_routing"] = {
                "provider": provider.name,
                "model": provider.model,
                "latency_ms": round(latency_ms, 2),
                "timestamp": datetime.utcnow().isoformat(),
            }
            
            return result
            
        except asyncio.TimeoutError:
            provider.record_failure(f"Timeout after {provider.timeout_seconds}s")
            raise ModelRouterError(
                f"Provider {provider.name} timed out",
                provider=provider.name,
                task_type=task.value
            )
        except Exception as e:
            provider.record_failure(str(e))
            raise ModelRouterError(
                str(e),
                provider=provider.name,
                task_type=task.value
            )
    
    def update_weights(self, task: TaskType, new_weights: Dict[str, float]):
        """
        Update routing weights for a task type.
        
        Args:
            task: The task type to update
            new_weights: Dict mapping provider name to new weight
        """
        for provider in self.providers.get(task, []):
            if provider.name in new_weights:
                provider.weight = new_weights[provider.name]
                logger.info(f"Updated weight for {provider.name} on {task.value}: {provider.weight}")
    
    def set_provider_availability(self, provider_name: str, is_available: bool):
        """Enable or disable a provider across all task types."""
        for task_providers in self.providers.values():
            for provider in task_providers:
                if provider.name == provider_name:
                    provider.is_available = is_available
                    logger.info(f"Set {provider_name} availability to {is_available}")
    
    def get_provider_status(self, task: Optional[TaskType] = None) -> Dict:
        """Get status of all providers, optionally filtered by task type."""
        result = {}
        
        task_types = [task] if task else list(self.providers.keys())
        
        for task_type in task_types:
            result[task_type.value] = [
                p.to_dict() for p in self.providers.get(task_type, [])
            ]
        
        return result
    
    def get_metrics(self) -> Dict:
        """Get aggregated metrics across all providers."""
        total_calls = 0
        total_successful = 0
        total_failed = 0
        total_cost = 0.0
        
        provider_stats = {}
        
        for task_type, providers in self.providers.items():
            for provider in providers:
                total_calls += provider.total_calls
                total_successful += provider.successful_calls
                total_failed += provider.failed_calls
                total_cost += provider.successful_calls * provider.cost_per_call
                
                key = f"{provider.name}:{provider.model}"
                if key not in provider_stats:
                    provider_stats[key] = {
                        "name": provider.name,
                        "model": provider.model,
                        "total_calls": 0,
                        "successful_calls": 0,
                        "failed_calls": 0,
                        "avg_latency_ms": 0,
                        "total_cost": 0,
                    }
                
                stats = provider_stats[key]
                stats["total_calls"] += provider.total_calls
                stats["successful_calls"] += provider.successful_calls
                stats["failed_calls"] += provider.failed_calls
                stats["total_cost"] += provider.successful_calls * provider.cost_per_call
                if provider.avg_latency_ms > 0:
                    stats["avg_latency_ms"] = provider.avg_latency_ms
        
        return {
            "totals": {
                "total_calls": total_calls,
                "successful_calls": total_successful,
                "failed_calls": total_failed,
                "success_rate": total_successful / max(1, total_calls),
                "total_cost": round(total_cost, 4),
            },
            "providers": list(provider_stats.values()),
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    def create_ab_test(
        self,
        test_id: str,
        task: TaskType,
        control_provider: str,
        variant_provider: str,
        variant_weight: float = 0.1
    ) -> Dict:
        """
        Create an A/B test between two providers.
        
        Args:
            test_id: Unique identifier for the test
            task: Task type to test
            control_provider: Name of the control provider
            variant_provider: Name of the variant provider
            variant_weight: Percentage of traffic for variant (0-1)
        """
        self._ab_tests[test_id] = {
            "task": task,
            "control": control_provider,
            "variant": variant_provider,
            "variant_weight": variant_weight,
            "started_at": datetime.utcnow().isoformat(),
            "control_results": [],
            "variant_results": [],
        }
        
        return {"test_id": test_id, "status": "started"}
    
    def get_ab_test_results(self, test_id: str) -> Optional[Dict]:
        """Get results of an A/B test."""
        return self._ab_tests.get(test_id)


# Singleton instance
_router_instance: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    """Get or create the singleton ModelRouter instance."""
    global _router_instance
    if _router_instance is None:
        _router_instance = ModelRouter()
    return _router_instance


def reset_model_router():
    """Reset the singleton instance (useful for testing)."""
    global _router_instance
    _router_instance = None
