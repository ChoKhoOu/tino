"""Risk circuit breaker with non-bypassable global limits.

SAFETY CRITICAL: These limits cannot be disabled or bypassed by any command,
API call, or configuration. They are the last line of defense against
catastrophic losses.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CircuitBreakerLimits:
    """Hard-coded risk limits. Frozen to prevent runtime modification."""
    max_drawdown_pct: float
    single_order_size_cap: float
    daily_loss_limit: float


# These are the ABSOLUTE maximum limits. User-configured limits can be stricter
# but NEVER more permissive than these.
HARD_LIMITS = CircuitBreakerLimits(
    max_drawdown_pct=0.15,       # 15% absolute max drawdown
    single_order_size_cap=1.0,   # 1 BTC absolute max order size
    daily_loss_limit=5000.0,     # $5000 absolute max daily loss
)


@dataclass
class CircuitBreakerState:
    """Runtime state of the circuit breaker."""
    is_tripped: bool = False
    tripped_at: datetime | None = None
    tripped_reason: str | None = None
    daily_pnl: float = 0.0
    peak_equity: float = 0.0
    current_equity: float = 0.0
    daily_reset_date: str = ""
    trip_history: list[dict] = field(default_factory=list)


class RiskCircuitBreaker:
    """Non-bypassable risk circuit breaker.

    Monitors trading activity and automatically triggers a kill-switch
    when any hard limit is breached. Cannot be disabled.
    """

    def __init__(
        self,
        max_drawdown_pct: float = 0.08,
        single_order_size_cap: float = 0.1,
        daily_loss_limit: float = 500.0,
        initial_equity: float = 0.0,
    ):
        # Enforce hard limits - user config cannot exceed them
        self.max_drawdown_pct = min(max_drawdown_pct, HARD_LIMITS.max_drawdown_pct)
        self.single_order_size_cap = min(single_order_size_cap, HARD_LIMITS.single_order_size_cap)
        self.daily_loss_limit = min(daily_loss_limit, HARD_LIMITS.daily_loss_limit)
        self.state = CircuitBreakerState(
            peak_equity=initial_equity,
            current_equity=initial_equity,
            daily_reset_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        )

    def check_order(self, order_size: float) -> tuple[bool, str | None]:
        """Check if an order is within risk limits.

        Returns (allowed, reason). If not allowed, reason explains why.
        """
        if self.state.is_tripped:
            return False, f"Circuit breaker tripped: {self.state.tripped_reason}"

        if order_size > self.single_order_size_cap:
            return False, (
                f"Order size {order_size} exceeds cap {self.single_order_size_cap}"
            )

        return True, None

    def update_equity(self, current_equity: float) -> tuple[bool, str | None]:
        """Update equity and check drawdown/loss limits.

        Returns (safe, breach_reason). If not safe, kill-switch should trigger.
        """
        self._maybe_reset_daily()
        self.state.current_equity = current_equity

        if current_equity > self.state.peak_equity:
            self.state.peak_equity = current_equity

        # Check drawdown
        if self.state.peak_equity > 0:
            drawdown = (self.state.peak_equity - current_equity) / self.state.peak_equity
            if drawdown >= self.max_drawdown_pct:
                return self._trip(
                    f"Max drawdown breached: {drawdown:.2%} >= {self.max_drawdown_pct:.2%}"
                )

        # Check daily loss
        daily_loss = -self.state.daily_pnl if self.state.daily_pnl < 0 else 0
        if daily_loss >= self.daily_loss_limit:
            return self._trip(
                f"Daily loss limit breached: ${daily_loss:.2f} >= ${self.daily_loss_limit:.2f}"
            )

        return True, None

    def record_trade_pnl(self, pnl: float) -> tuple[bool, str | None]:
        """Record a completed trade's PnL and check limits.

        Returns (safe, breach_reason).
        """
        self._maybe_reset_daily()
        self.state.daily_pnl += pnl

        daily_loss = -self.state.daily_pnl if self.state.daily_pnl < 0 else 0
        if daily_loss >= self.daily_loss_limit:
            return self._trip(
                f"Daily loss limit breached: ${daily_loss:.2f} >= ${self.daily_loss_limit:.2f}"
            )

        return True, None

    def _trip(self, reason: str) -> tuple[bool, str]:
        """Trip the circuit breaker. Cannot be untripped programmatically."""
        now = datetime.now(timezone.utc)
        self.state.is_tripped = True
        self.state.tripped_at = now
        self.state.tripped_reason = reason
        self.state.trip_history.append({
            "reason": reason,
            "timestamp": now.isoformat(),
            "equity": self.state.current_equity,
            "daily_pnl": self.state.daily_pnl,
        })
        logger.critical(f"CIRCUIT BREAKER TRIPPED: {reason}")
        return False, reason

    def _maybe_reset_daily(self) -> None:
        """Reset daily PnL counter at UTC midnight."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if today != self.state.daily_reset_date:
            self.state.daily_pnl = 0.0
            self.state.daily_reset_date = today

    @property
    def is_tripped(self) -> bool:
        return self.state.is_tripped

    def get_status(self) -> dict:
        """Get current circuit breaker status."""
        drawdown = 0.0
        if self.state.peak_equity > 0:
            drawdown = (
                (self.state.peak_equity - self.state.current_equity)
                / self.state.peak_equity
            )
        return {
            "is_tripped": self.state.is_tripped,
            "tripped_reason": self.state.tripped_reason,
            "current_drawdown_pct": round(drawdown, 4),
            "max_drawdown_pct": self.max_drawdown_pct,
            "daily_pnl": self.state.daily_pnl,
            "daily_loss_limit": self.daily_loss_limit,
            "single_order_size_cap": self.single_order_size_cap,
        }
