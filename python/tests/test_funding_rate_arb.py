"""Tests for FundingRateArbStrategy, _EMA, and FundingRateArbConfig.

Mocks nautilus_trader at the module level since it may not be importable
in the test environment (the strategy uses `# type: ignore[import-not-found]`).
"""

from __future__ import annotations

import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Mock nautilus_trader modules before importing the strategy
# ---------------------------------------------------------------------------

# OrderSide enum mock -- needs SELL=1, BUY=2 as distinct sentinels
_OrderSide = SimpleNamespace(SELL="SELL", BUY="BUY")

# InstrumentId mock with from_str class method
_InstrumentId = type(
    "InstrumentId",
    (),
    {"from_str": staticmethod(lambda s: SimpleNamespace(venue=SimpleNamespace(value=s.split(".")[-1]), value=s))},
)

# Quantity mock with from_str class method
_Quantity = type(
    "Quantity",
    (),
    {"from_str": staticmethod(lambda s: float(s))},
)

# StrategyConfig mock -- must support `frozen=True` as a class keyword
class _StrategyConfig:
    """Mock StrategyConfig that accepts frozen keyword."""

    def __init_subclass__(cls, frozen: bool = False, **kwargs):
        super().__init_subclass__(**kwargs)

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            object.__setattr__(self, k, v)


# Strategy mock -- provides the interface the strategy expects
class _Strategy:
    """Mock Strategy base class."""

    def __init__(self, config):
        self.config = config
        self.log = MagicMock()
        self.portfolio = MagicMock()
        self.order_factory = MagicMock()
        self._submit_order = MagicMock()
        self._close_all = MagicMock()

    def submit_order(self, order):
        self._submit_order(order)

    def close_all_positions(self, instrument_id):
        self._close_all(instrument_id)


_nautilus_mocks = {
    "nautilus_trader": MagicMock(),
    "nautilus_trader.config": SimpleNamespace(StrategyConfig=_StrategyConfig),
    "nautilus_trader.model": MagicMock(),
    "nautilus_trader.model.data": SimpleNamespace(Bar=MagicMock),
    "nautilus_trader.model.enums": SimpleNamespace(OrderSide=_OrderSide),
    "nautilus_trader.model.identifiers": SimpleNamespace(InstrumentId=_InstrumentId),
    "nautilus_trader.model.objects": SimpleNamespace(Quantity=_Quantity),
    "nautilus_trader.trading": MagicMock(),
    "nautilus_trader.trading.strategy": SimpleNamespace(Strategy=_Strategy),
}

with patch.dict(sys.modules, _nautilus_mocks):
    from tino_daemon.strategies.funding_rate_arb import (
        FundingRateArbConfig,
        FundingRateArbStrategy,
        _EMA,
    )

# Re-bind OrderSide so tests can reference it directly
OrderSide = _OrderSide


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_bar(close: float) -> SimpleNamespace:
    """Create a mock bar with a given close price.

    Uses Decimal for close so that _enter_position can compute
    ``Decimal(...) / bar.close`` without a TypeError (NautilusTrader's
    Price type supports Decimal arithmetic).
    """
    from decimal import Decimal as D

    return SimpleNamespace(close=D(str(close)))


def _make_strategy(
    fast_period: int = 8,
    slow_period: int = 72,
    threshold: float = 0.15,
    exit_threshold: float = 0.05,
    stop_loss_pct: float = 0.02,
    take_profit_pct: float = 0.05,
    rebalance_interval_bars: int = 1,
    funding_periods_per_day: int = 3,
) -> FundingRateArbStrategy:
    """Create a strategy instance with mocked NautilusTrader dependencies."""
    config = FundingRateArbConfig(
        perp_instrument_id="BTC-PERP.BINANCE",
        funding_rate_threshold=threshold,
        exit_threshold=exit_threshold,
        position_size_pct=0.10,
        stop_loss_pct=stop_loss_pct,
        take_profit_pct=take_profit_pct,
        fast_ema_period=fast_period,
        slow_ema_period=slow_period,
        funding_periods_per_day=funding_periods_per_day,
        rebalance_interval_bars=rebalance_interval_bars,
    )
    strategy = FundingRateArbStrategy(config)
    # Mock portfolio.account for _get_equity
    from decimal import Decimal

    balance_mock = SimpleNamespace(total=Decimal("10000"))
    account_mock = SimpleNamespace(balances=lambda: {"USD": balance_mock})
    strategy.portfolio.account.return_value = account_mock
    # Mock order_factory.market
    strategy.order_factory.market.return_value = SimpleNamespace(order_id="test-order")
    return strategy


def _warm_up_emas(strategy: FundingRateArbStrategy, price: float, count: int) -> None:
    """Feed bars at a constant price to warm up both EMAs."""
    for _ in range(count):
        bar = _make_bar(price)
        strategy.on_bar(bar)


# ---------------------------------------------------------------------------
# Tests: _EMA
# ---------------------------------------------------------------------------


class TestEMA:
    def test_initial_value_is_zero(self):
        ema = _EMA(period=10)
        assert ema.value == 0.0

    def test_not_initialized_before_period(self):
        ema = _EMA(period=5)
        for i in range(4):
            ema.update(float(i + 1))
        assert not ema.initialized

    def test_initialized_after_period(self):
        ema = _EMA(period=5)
        for i in range(5):
            ema.update(float(i + 1))
        assert ema.initialized

    def test_warmup_uses_sma(self):
        """During warmup, the EMA should compute a simple moving average."""
        ema = _EMA(period=4)
        values = [10.0, 20.0, 30.0, 40.0]
        for v in values:
            ema.update(v)
        expected_sma = sum(values) / len(values)  # 25.0
        assert ema.value == pytest.approx(expected_sma)

    def test_ema_updates_after_warmup(self):
        """After warmup, the EMA formula should be applied."""
        ema = _EMA(period=4)
        values = [10.0, 20.0, 30.0, 40.0]
        for v in values:
            ema.update(v)
        # Now feed a new value after warmup
        sma = 25.0  # from warmup
        new_price = 50.0
        multiplier = 2.0 / (4 + 1)  # 0.4
        expected = (new_price - sma) * multiplier + sma  # (50 - 25) * 0.4 + 25 = 35.0
        ema.update(new_price)
        assert ema.value == pytest.approx(expected)

    def test_single_period_ema(self):
        """Period=1 should track the latest price exactly."""
        ema = _EMA(period=1)
        ema.update(100.0)
        assert ema.initialized
        assert ema.value == pytest.approx(100.0)
        ema.update(200.0)
        assert ema.value == pytest.approx(200.0)
        ema.update(50.0)
        assert ema.value == pytest.approx(50.0)


# ---------------------------------------------------------------------------
# Tests: _compute_basis
# ---------------------------------------------------------------------------


class TestComputeBasis:
    def test_basis_positive_when_fast_above_slow(self):
        """Basis should be positive when fast EMA > slow EMA (premium)."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(105.0)
        strategy._slow_ema.update(100.0)
        basis = strategy._compute_basis()
        assert basis == pytest.approx(0.05)

    def test_basis_negative_when_fast_below_slow(self):
        """Basis should be negative when fast EMA < slow EMA (discount)."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(95.0)
        strategy._slow_ema.update(100.0)
        basis = strategy._compute_basis()
        assert basis == pytest.approx(-0.05)

    def test_basis_zero_when_emas_equal(self):
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(100.0)
        strategy._slow_ema.update(100.0)
        basis = strategy._compute_basis()
        assert basis == pytest.approx(0.0)

    def test_basis_zero_when_slow_is_zero(self):
        """Avoid division by zero when slow EMA is zero."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        # Default _EMA value is 0.0 before any update
        assert strategy._compute_basis() == 0.0


# ---------------------------------------------------------------------------
# Tests: _check_risk_exit
# ---------------------------------------------------------------------------


class TestCheckRiskExit:
    def test_stop_loss_triggers_on_short(self):
        """Short stop-loss: price rises above entry * (1 + stop_loss_pct)."""
        strategy = _make_strategy(stop_loss_pct=0.02)
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0
        # Price at 103 => pnl_pct for short = (100 - 103)/100 = -0.03 < -0.02
        assert strategy._check_risk_exit(103.0) is True

    def test_stop_loss_triggers_on_long(self):
        """Long stop-loss: price falls below entry * (1 - stop_loss_pct)."""
        strategy = _make_strategy(stop_loss_pct=0.02)
        strategy._position_side = OrderSide.BUY
        strategy._entry_price = 100.0
        # Price at 97 => pnl_pct for long = (97 - 100)/100 = -0.03 < -0.02
        assert strategy._check_risk_exit(97.0) is True

    def test_take_profit_triggers_on_short(self):
        """Short take-profit: price falls below entry * (1 - take_profit_pct)."""
        strategy = _make_strategy(take_profit_pct=0.05)
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0
        # Price at 94 => pnl_pct for short = (100 - 94)/100 = 0.06 > 0.05
        assert strategy._check_risk_exit(94.0) is True

    def test_take_profit_triggers_on_long(self):
        """Long take-profit: price rises above entry * (1 + take_profit_pct)."""
        strategy = _make_strategy(take_profit_pct=0.05)
        strategy._position_side = OrderSide.BUY
        strategy._entry_price = 100.0
        # Price at 106 => pnl_pct for long = (106 - 100)/100 = 0.06 > 0.05
        assert strategy._check_risk_exit(106.0) is True

    def test_no_exit_within_bounds(self):
        """No exit when price is within both stop-loss and take-profit bands."""
        strategy = _make_strategy(stop_loss_pct=0.02, take_profit_pct=0.05)
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0
        # Price at 99.5 => pnl_pct for short = (100 - 99.5)/100 = 0.005
        assert strategy._check_risk_exit(99.5) is False

    def test_no_exit_when_no_position(self):
        """No exit when entry_price is zero (no position)."""
        strategy = _make_strategy()
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 0.0
        assert strategy._check_risk_exit(100.0) is False


# ---------------------------------------------------------------------------
# Tests: signal logic (on_bar entry/exit)
# ---------------------------------------------------------------------------


class TestSignalLogic:
    def test_no_signal_before_ema_warmup(self):
        """No trades should occur before slow EMA is initialized."""
        strategy = _make_strategy(fast_period=2, slow_period=5, rebalance_interval_bars=1)
        # Feed only 4 bars (slow needs 5)
        for _ in range(4):
            strategy.on_bar(_make_bar(100.0))
        assert strategy._position_side is None
        # Verify submit_order was never called
        strategy._submit_order.assert_not_called()

    def test_short_entry_on_high_premium(self):
        """Should enter SHORT when annualized basis > threshold (premium)."""
        # Use fast_period=1 (tracks latest price) and slow_period=3 (lags behind).
        # Warm up both EMAs at 100, then spike close to 200.
        # Fast EMA snaps to 200 immediately (period=1).
        # Slow EMA moves much less: SMA phase over 3 bars means it stays near 100.
        # Basis = (fast - slow) / slow >> 0, exceeding threshold.
        strategy = _make_strategy(
            fast_period=1,
            slow_period=3,
            threshold=0.15,
            rebalance_interval_bars=1,
        )
        # First 3 bars at 100 to fully warm up both EMAs
        for _ in range(3):
            strategy.on_bar(_make_bar(100.0))
        assert strategy._position_side is None  # basis is 0 here

        # Spike: fast EMA snaps to 200, slow EMA rises but stays close to 100
        # slow EMA(period=3, multiplier=0.5): (200 - 100)*0.5 + 100 = 150
        # basis = (200 - 150)/150 = 0.333, annualized = 0.333 * 3 * 365 = 365 >> 0.15
        strategy.on_bar(_make_bar(200.0))
        assert strategy._position_side == OrderSide.SELL

    def test_long_entry_on_deep_discount(self):
        """Should enter LONG when annualized basis < -threshold (discount)."""
        # Fast period=1 tracks latest price, slow period=3 lags.
        # Warm up at 200, then drop to 100.
        # Fast snaps to 100, slow stays elevated.
        # Basis = (100 - slow) / slow < 0, large discount.
        strategy = _make_strategy(
            fast_period=1,
            slow_period=3,
            threshold=0.15,
            rebalance_interval_bars=1,
        )
        # Warm up both EMAs at 200
        for _ in range(3):
            strategy.on_bar(_make_bar(200.0))
        assert strategy._position_side is None

        # Crash: fast EMA snaps to 100, slow stays elevated
        # slow EMA(period=3, multiplier=0.5): (100 - 200)*0.5 + 200 = 150
        # basis = (100 - 150)/150 = -0.333, annualized = -0.333 * 1095 = -365 << -0.15
        strategy.on_bar(_make_bar(100.0))
        assert strategy._position_side == OrderSide.BUY

    def test_no_entry_within_threshold_band(self):
        """No entry when annualized basis is within the threshold band."""
        strategy = _make_strategy(
            fast_period=1,
            slow_period=1,
            threshold=0.15,
            rebalance_interval_bars=1,
        )
        # Initialize EMAs
        strategy.on_bar(_make_bar(100.0))

        # Set a very small premium: basis = 0.00001
        # annualized = 0.00001 * 3 * 365 = 0.01095 < 0.15
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(100.001)
        strategy._slow_ema.update(100.0)
        strategy._bar_count = 0

        strategy.on_bar(_make_bar(100.001))
        assert strategy._position_side is None

    def test_exit_short_when_basis_normalizes(self):
        """Should exit SHORT when annualized basis drops below exit_threshold."""
        strategy = _make_strategy(
            fast_period=1,
            slow_period=1,
            threshold=0.15,
            exit_threshold=0.05,
            rebalance_interval_bars=1,
            stop_loss_pct=1.0,  # disable stop-loss
            take_profit_pct=1.0,  # disable take-profit
        )

        # Simulate an existing short position
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0

        # Set EMAs so basis is near zero (normalized)
        # basis = (100.001 - 100.0) / 100.0 = 0.00001
        # annualized = 0.00001 * 3 * 365 = 0.01095 < exit_threshold 0.05
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(100.001)
        strategy._slow_ema.update(100.0)
        # Mark slow EMA as initialized so we pass the warmup check
        strategy._slow_ema._initialized = True
        strategy._bar_count = 0

        strategy.on_bar(_make_bar(100.001))
        # Position should have been closed
        assert strategy._position_side is None

    def test_exit_long_when_basis_normalizes(self):
        """Should exit LONG when annualized basis rises above -exit_threshold."""
        strategy = _make_strategy(
            fast_period=1,
            slow_period=1,
            threshold=0.15,
            exit_threshold=0.05,
            rebalance_interval_bars=1,
            stop_loss_pct=1.0,  # disable stop-loss
            take_profit_pct=1.0,  # disable take-profit
        )

        # Simulate an existing long position
        strategy._position_side = OrderSide.BUY
        strategy._entry_price = 100.0

        # Set EMAs so basis is slightly negative but above -exit_threshold
        # basis = (99.999 - 100.0) / 100.0 = -0.00001
        # annualized = -0.00001 * 3 * 365 = -0.01095 > -0.05
        strategy._fast_ema = _EMA(1)
        strategy._slow_ema = _EMA(1)
        strategy._fast_ema.update(99.999)
        strategy._slow_ema.update(100.0)
        strategy._slow_ema._initialized = True
        strategy._bar_count = 0

        strategy.on_bar(_make_bar(99.999))
        # Position should have been closed
        assert strategy._position_side is None


# ---------------------------------------------------------------------------
# Tests: FundingRateArbConfig
# ---------------------------------------------------------------------------


class TestConfig:
    def test_default_config_values(self):
        config = FundingRateArbConfig()
        assert config.perp_instrument_id == "BTC-PERP.BINANCE"
        assert config.funding_rate_threshold == 0.15
        assert config.exit_threshold == 0.05
        assert config.position_size_pct == 0.10
        assert config.stop_loss_pct == 0.02
        assert config.take_profit_pct == 0.05
        assert config.fast_ema_period == 8
        assert config.slow_ema_period == 72
        assert config.funding_periods_per_day == 3
        assert config.rebalance_interval_bars == 8

    def test_no_hardcoded_return_values(self):
        """Regression test for PRD-006: _compute_basis must return
        different values for different price sequences, not hardcoded zeros."""
        strategy_a = _make_strategy(fast_period=1, slow_period=1)
        strategy_a._fast_ema.update(105.0)
        strategy_a._slow_ema.update(100.0)
        basis_a = strategy_a._compute_basis()

        strategy_b = _make_strategy(fast_period=1, slow_period=1)
        strategy_b._fast_ema.update(110.0)
        strategy_b._slow_ema.update(100.0)
        basis_b = strategy_b._compute_basis()

        # Both must be non-zero and different from each other
        assert basis_a != 0.0, "_compute_basis should not return hardcoded zero"
        assert basis_b != 0.0, "_compute_basis should not return hardcoded zero"
        assert basis_a != basis_b, "_compute_basis must vary with different inputs"
        assert basis_a == pytest.approx(0.05)
        assert basis_b == pytest.approx(0.10)


# ---------------------------------------------------------------------------
# Tests: edge cases and lifecycle
# ---------------------------------------------------------------------------


class TestLifecycle:
    def test_on_stop_closes_position(self):
        """on_stop should close all positions and reset state."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0

        strategy.on_stop()

        assert strategy._position_side is None
        assert strategy._entry_price == 0.0
        strategy._close_all.assert_called_once_with(strategy.perp_id)

    def test_on_stop_noop_when_no_position(self):
        """on_stop should do nothing when not in a position."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._position_side = None

        strategy.on_stop()

        strategy._close_all.assert_not_called()


class TestEdgeCases:
    def test_on_bar_skips_zero_close(self):
        """Bars with close <= 0 should be ignored entirely."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        initial_bar_count = strategy._bar_count

        strategy.on_bar(_make_bar(0.0))
        assert strategy._bar_count == initial_bar_count

        strategy.on_bar(_make_bar(-5.0))
        assert strategy._bar_count == initial_bar_count

    def test_enter_position_guard_when_already_in_position(self):
        """_enter_position should be a no-op when already holding a position."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._position_side = OrderSide.SELL
        strategy._entry_price = 100.0

        strategy._enter_position(_make_bar(200.0), OrderSide.BUY)

        # Position should remain unchanged
        assert strategy._position_side == OrderSide.SELL
        assert strategy._entry_price == 100.0
        strategy._submit_order.assert_not_called()

    def test_enter_position_skips_zero_price_bar(self):
        """_enter_position should not submit orders for zero-price bars."""
        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy._position_side = None

        strategy._enter_position(_make_bar(0.0), OrderSide.BUY)

        assert strategy._position_side is None
        strategy._submit_order.assert_not_called()

    def test_get_equity_fallback_no_account(self):
        """_get_equity returns default 10000 when account is None."""
        from decimal import Decimal

        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy.portfolio.account.return_value = None

        assert strategy._get_equity() == Decimal("10000")

    def test_get_equity_fallback_empty_balances(self):
        """_get_equity returns default 10000 when balances are empty."""
        from decimal import Decimal

        strategy = _make_strategy(fast_period=1, slow_period=1)
        strategy.portfolio.account.return_value = SimpleNamespace(balances=lambda: {})

        assert strategy._get_equity() == Decimal("10000")

    def test_rebalance_interval_skips_bars(self):
        """Signal evaluation should only happen at rebalance intervals."""
        strategy = _make_strategy(
            fast_period=1,
            slow_period=3,
            threshold=0.15,
            rebalance_interval_bars=4,
        )
        # Warm up EMAs (3 bars needed for slow_period=3)
        for _ in range(3):
            strategy.on_bar(_make_bar(100.0))

        # Bar 4: spike price but NOT at rebalance interval (bar_count=4, 4%4==0 -> IS interval)
        # Actually bar_count after warmup is 3. Next bar makes it 4, 4%4==0 -> signal eval
        # Let's feed 2 more bars at 100 first to reach bar 5 (5%4!=0)
        strategy.on_bar(_make_bar(100.0))  # bar 4 -> 4%4==0 but no premium, no entry
        strategy.on_bar(_make_bar(200.0))  # bar 5 -> 5%4!=0, skip signal eval

        # Despite the huge premium, no entry because it's not a rebalance bar
        assert strategy._position_side is None

        # Feed 3 more bars to reach bar 8 (8%4==0)
        strategy.on_bar(_make_bar(200.0))  # bar 6
        strategy.on_bar(_make_bar(200.0))  # bar 7
        strategy.on_bar(_make_bar(200.0))  # bar 8 -> 8%4==0, signal eval

        # NOW entry should trigger since fast >> slow
        assert strategy._position_side == OrderSide.SELL
