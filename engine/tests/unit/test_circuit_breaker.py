"""Unit tests for risk circuit breaker."""

import pytest
from src.risk.circuit_breaker import RiskCircuitBreaker, HARD_LIMITS


class TestRiskCircuitBreaker:
    def test_order_within_limit(self):
        cb = RiskCircuitBreaker(single_order_size_cap=0.1)
        allowed, reason = cb.check_order(0.05)
        assert allowed is True
        assert reason is None

    def test_order_exceeds_cap(self):
        cb = RiskCircuitBreaker(single_order_size_cap=0.1)
        allowed, reason = cb.check_order(0.2)
        assert allowed is False
        assert "exceeds cap" in reason

    def test_drawdown_trips_breaker(self):
        cb = RiskCircuitBreaker(max_drawdown_pct=0.08, initial_equity=10000)
        safe, reason = cb.update_equity(9100)  # 9% drawdown
        assert safe is False
        assert cb.is_tripped is True

    def test_drawdown_safe(self):
        cb = RiskCircuitBreaker(max_drawdown_pct=0.08, initial_equity=10000)
        safe, reason = cb.update_equity(9500)  # 5% drawdown
        assert safe is True
        assert cb.is_tripped is False

    def test_daily_loss_trips_breaker(self):
        cb = RiskCircuitBreaker(daily_loss_limit=500)
        cb.record_trade_pnl(-200)
        safe, _ = cb.record_trade_pnl(-400)
        assert safe is False
        assert cb.is_tripped is True

    def test_tripped_blocks_all_orders(self):
        cb = RiskCircuitBreaker(max_drawdown_pct=0.01, initial_equity=10000)
        cb.update_equity(9800)  # Trip
        allowed, reason = cb.check_order(0.001)
        assert allowed is False
        assert "tripped" in reason.lower()

    def test_hard_limits_enforced(self):
        cb = RiskCircuitBreaker(max_drawdown_pct=0.99, single_order_size_cap=999)
        assert cb.max_drawdown_pct <= HARD_LIMITS.max_drawdown_pct
        assert cb.single_order_size_cap <= HARD_LIMITS.single_order_size_cap

    def test_hard_limits_non_bypassable(self):
        """Hard limits cannot be exceeded by configuration."""
        cb = RiskCircuitBreaker(
            max_drawdown_pct=1.0,
            single_order_size_cap=100.0,
            daily_loss_limit=999999.0,
        )
        assert cb.max_drawdown_pct == HARD_LIMITS.max_drawdown_pct
        assert cb.single_order_size_cap == HARD_LIMITS.single_order_size_cap
        assert cb.daily_loss_limit == HARD_LIMITS.daily_loss_limit

    def test_get_status(self):
        cb = RiskCircuitBreaker(initial_equity=10000)
        status = cb.get_status()
        assert "is_tripped" in status
        assert "current_drawdown_pct" in status
        assert status["is_tripped"] is False
