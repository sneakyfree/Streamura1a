"""
Streamura Agent Resilience Module

Provides retry logic, fallback patterns, and circuit breaker functionality
for the agentic system to ensure robust operation under failure conditions.
"""

import asyncio
import time
import random
import logging
from typing import Any, Callable, Dict, List, Optional, TypeVar, Generic
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 30.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_exceptions: tuple = (Exception,)
    
    def get_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt with exponential backoff."""
        delay = min(
            self.base_delay_seconds * (self.exponential_base ** attempt),
            self.max_delay_seconds
        )
        if self.jitter:
            delay = delay * (0.5 + random.random())
        return delay


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5
    success_threshold: int = 3
    timeout_seconds: float = 60.0
    half_open_max_calls: int = 3


@dataclass
class CircuitBreakerState:
    """State tracking for circuit breaker."""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[float] = None
    half_open_calls: int = 0


class AgentCircuitBreaker:
    """
    Circuit breaker for agent operations.
    
    Prevents cascading failures by stopping requests to failing services.
    """
    
    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._state = CircuitBreakerState()
        self._lock = asyncio.Lock()
    
    @property
    def state(self) -> CircuitState:
        return self._state.state
    
    async def _check_timeout(self) -> bool:
        """Check if timeout has elapsed for open circuit."""
        if self._state.last_failure_time is None:
            return False
        elapsed = time.time() - self._state.last_failure_time
        return elapsed >= self.config.timeout_seconds
    
    async def _transition_to(self, new_state: CircuitState):
        """Transition to new circuit state."""
        old_state = self._state.state
        self._state.state = new_state
        
        if new_state == CircuitState.CLOSED:
            self._state.failure_count = 0
            self._state.success_count = 0
        elif new_state == CircuitState.HALF_OPEN:
            self._state.half_open_calls = 0
            self._state.success_count = 0
        
        logger.info(f"Circuit breaker '{self.name}': {old_state} -> {new_state}")
    
    async def can_execute(self) -> bool:
        """Check if execution is allowed."""
        async with self._lock:
            if self._state.state == CircuitState.CLOSED:
                return True
            
            if self._state.state == CircuitState.OPEN:
                if await self._check_timeout():
                    await self._transition_to(CircuitState.HALF_OPEN)
                    return True
                return False
            
            if self._state.state == CircuitState.HALF_OPEN:
                if self._state.half_open_calls < self.config.half_open_max_calls:
                    self._state.half_open_calls += 1
                    return True
                return False
            
            return False
    
    async def record_success(self):
        """Record successful execution."""
        async with self._lock:
            if self._state.state == CircuitState.HALF_OPEN:
                self._state.success_count += 1
                if self._state.success_count >= self.config.success_threshold:
                    await self._transition_to(CircuitState.CLOSED)
            else:
                self._state.failure_count = max(0, self._state.failure_count - 1)
    
    async def record_failure(self):
        """Record failed execution."""
        async with self._lock:
            self._state.failure_count += 1
            self._state.last_failure_time = time.time()
            
            if self._state.state == CircuitState.HALF_OPEN:
                await self._transition_to(CircuitState.OPEN)
            elif self._state.failure_count >= self.config.failure_threshold:
                await self._transition_to(CircuitState.OPEN)
    
    @asynccontextmanager
    async def __call__(self):
        """Context manager for circuit breaker."""
        if not await self.can_execute():
            raise CircuitOpenError(f"Circuit breaker '{self.name}' is open")
        
        try:
            yield
            await self.record_success()
        except Exception as e:
            await self.record_failure()
            raise


class CircuitOpenError(Exception):
    """Exception raised when circuit breaker is open."""
    pass


@dataclass
class FallbackChain(Generic[T]):
    """
    Ordered chain of fallback functions.
    
    Each fallback is tried in order until one succeeds.
    """
    
    fallbacks: List[Callable[..., T]] = field(default_factory=list)
    
    def add(self, func: Callable[..., T]) -> 'FallbackChain[T]':
        """Add a fallback to the chain."""
        self.fallbacks.append(func)
        return self
    
    async def execute(self, *args, **kwargs) -> T:
        """Execute fallbacks in order until one succeeds."""
        last_error = None
        
        for i, fallback in enumerate(self.fallbacks):
            try:
                if asyncio.iscoroutinefunction(fallback):
                    result = await fallback(*args, **kwargs)
                else:
                    result = fallback(*args, **kwargs)
                
                logger.info(f"Fallback {i + 1}/{len(self.fallbacks)} succeeded")
                return result
                
            except Exception as e:
                last_error = e
                logger.warning(f"Fallback {i + 1}/{len(self.fallbacks)} failed: {e}")
                continue
        
        raise FallbackExhaustedError(
            f"All {len(self.fallbacks)} fallbacks failed",
            last_error
        )


class FallbackExhaustedError(Exception):
    """Exception raised when all fallbacks have failed."""
    
    def __init__(self, message: str, last_error: Optional[Exception] = None):
        super().__init__(message)
        self.last_error = last_error


class AgentResilience:
    """
    Resilience patterns for agent operations.
    
    Combines retry, circuit breaker, and fallback functionality.
    """
    
    _circuit_breakers: Dict[str, AgentCircuitBreaker] = {}
    
    @classmethod
    def get_circuit_breaker(
        cls,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ) -> AgentCircuitBreaker:
        """Get or create a circuit breaker by name."""
        if name not in cls._circuit_breakers:
            cls._circuit_breakers[name] = AgentCircuitBreaker(name, config)
        return cls._circuit_breakers[name]
    
    @classmethod
    def reset_all(cls):
        """Reset all circuit breakers."""
        cls._circuit_breakers.clear()


def with_retry(
    config: Optional[RetryConfig] = None,
    on_retry: Optional[Callable[[int, Exception], None]] = None
):
    """
    Decorator for retry logic with exponential backoff.
    
    Args:
        config: Retry configuration
        on_retry: Callback for each retry attempt
    """
    _config = config or RetryConfig()
    
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(_config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except _config.retryable_exceptions as e:
                    last_error = e
                    
                    if attempt < _config.max_retries:
                        delay = _config.get_delay(attempt)
                        logger.warning(
                            f"Retry {attempt + 1}/{_config.max_retries} for {func.__name__}: "
                            f"{e}. Waiting {delay:.2f}s"
                        )
                        
                        if on_retry:
                            on_retry(attempt, e)
                        
                        await asyncio.sleep(delay)
                    else:
                        logger.error(f"All retries exhausted for {func.__name__}: {e}")
            
            raise last_error
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(_config.max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except _config.retryable_exceptions as e:
                    last_error = e
                    
                    if attempt < _config.max_retries:
                        delay = _config.get_delay(attempt)
                        logger.warning(
                            f"Retry {attempt + 1}/{_config.max_retries} for {func.__name__}: "
                            f"{e}. Waiting {delay:.2f}s"
                        )
                        
                        if on_retry:
                            on_retry(attempt, e)
                        
                        time.sleep(delay)
                    else:
                        logger.error(f"All retries exhausted for {func.__name__}: {e}")
            
            raise last_error
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def with_circuit_breaker(
    name: str,
    config: Optional[CircuitBreakerConfig] = None
):
    """
    Decorator for circuit breaker pattern.
    
    Args:
        name: Circuit breaker identifier
        config: Circuit breaker configuration
    """
    def decorator(func: Callable):
        circuit = AgentResilience.get_circuit_breaker(name, config)
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            async with circuit():
                return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # For sync functions, use asyncio.run
            async def _run():
                async with circuit():
                    return func(*args, **kwargs)
            return asyncio.run(_run())
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def with_fallback(*fallback_funcs: Callable):
    """
    Decorator to add fallback functions.
    
    Args:
        fallback_funcs: Functions to try if primary fails
    """
    def decorator(func: Callable):
        chain = FallbackChain()
        chain.add(func)
        for fb in fallback_funcs:
            chain.add(fb)
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await chain.execute(*args, **kwargs)
        
        return async_wrapper
    
    return decorator


def with_timeout(seconds: float):
    """
    Decorator to add timeout to async functions.
    
    Args:
        seconds: Timeout in seconds
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=seconds
                )
            except asyncio.TimeoutError:
                raise AgentTimeoutError(
                    f"{func.__name__} timed out after {seconds}s"
                )
        
        return wrapper
    
    return decorator


class AgentTimeoutError(Exception):
    """Exception raised when agent operation times out."""
    pass


# =============================================================================
# AGENT-SPECIFIC RESILIENCE CONFIGURATIONS
# =============================================================================

AGENT_RETRY_CONFIGS = {
    "discovery": RetryConfig(
        max_retries=3,
        base_delay_seconds=0.5,
        max_delay_seconds=10.0,
    ),
    "moderation": RetryConfig(
        max_retries=2,
        base_delay_seconds=0.2,
        max_delay_seconds=5.0,
    ),
    "payout": RetryConfig(
        max_retries=5,
        base_delay_seconds=1.0,
        max_delay_seconds=60.0,
    ),
    "trust": RetryConfig(
        max_retries=3,
        base_delay_seconds=0.5,
        max_delay_seconds=15.0,
    ),
    "licensing": RetryConfig(
        max_retries=4,
        base_delay_seconds=1.0,
        max_delay_seconds=30.0,
    ),
    "emergency": RetryConfig(
        max_retries=1,
        base_delay_seconds=0.1,
        max_delay_seconds=1.0,
    ),
}

AGENT_CIRCUIT_CONFIGS = {
    "discovery": CircuitBreakerConfig(
        failure_threshold=10,
        timeout_seconds=30.0,
    ),
    "moderation": CircuitBreakerConfig(
        failure_threshold=5,
        timeout_seconds=60.0,
    ),
    "payout": CircuitBreakerConfig(
        failure_threshold=3,
        timeout_seconds=120.0,
    ),
    "trust": CircuitBreakerConfig(
        failure_threshold=8,
        timeout_seconds=45.0,
    ),
    "licensing": CircuitBreakerConfig(
        failure_threshold=5,
        timeout_seconds=90.0,
    ),
    "emergency": CircuitBreakerConfig(
        failure_threshold=2,
        timeout_seconds=10.0,
    ),
}


def get_agent_retry_config(agent_type: str) -> RetryConfig:
    """Get retry config for specific agent type."""
    return AGENT_RETRY_CONFIGS.get(agent_type, RetryConfig())


def get_agent_circuit_config(agent_type: str) -> CircuitBreakerConfig:
    """Get circuit breaker config for specific agent type."""
    return AGENT_CIRCUIT_CONFIGS.get(agent_type, CircuitBreakerConfig())
