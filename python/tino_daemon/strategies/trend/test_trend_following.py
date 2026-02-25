"""Tests for MACrossoverStrategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.trend.trend_following import MACrossoverStrategy


@dataclass
class FakeBar:
    """Minimal bar stub with a close price."""

    close: float


class TestClassAttributes:
    """Verify strategy class-level attributes."""

    def test_name(self) -> None:
        assert MACrossoverStrategy.name == "ma_crossover"

    def test_description(self) -> None:
        assert "crossover" in MACrossoverStrategy.description.lower()

    def test_market_regime(self) -> None:
        assert MACrossoverStrategy.market_regime == "trending"

    def test_inherits_strategy(self) -> None:
        assert issubclass(MACrossoverStrategy, Strategy)


class TestConfigSchema:
    """Verify CONFIG_SCHEMA completeness and structure."""

    schema = MACrossoverStrategy.CONFIG_SCHEMA

    def test_has_json_schema_marker(self) -> None:
        assert "$schema" in self.schema

    def test_type_is_object(self) -> None:
        assert self.schema["type"] == "object"

    def test_all_expected_properties(self) -> None:
        props = set(self.schema["properties"].keys())
        expected = {"fast_period", "slow_period", "ma_type", "position_size", "stop_loss_pct"}
        assert expected == props

    def test_fast_period_schema(self) -> None:
        prop = self.schema["properties"]["fast_period"]
        assert prop["type"] == "integer"
        assert prop["default"] == 10
        assert "description" in prop
        assert "minimum" in prop
        assert "maximum" in prop

    def test_slow_period_schema(self) -> None:
        prop = self.schema["properties"]["slow_period"]
        assert prop["type"] == "integer"
        assert prop["default"] == 30
        assert "description" in prop
        assert "minimum" in prop
        assert "maximum" in prop

    def test_ma_type_schema(self) -> None:
        prop = self.schema["properties"]["ma_type"]
        assert prop["type"] == "string"
        assert prop["default"] == "SMA"
        assert set(prop["enum"]) == {"SMA", "EMA"}
        assert "description" in prop

    def test_position_size_schema(self) -> None:
        prop = self.schema["properties"]["position_size"]
        assert prop["type"] == "number"
        assert prop["default"] == 0.1
        assert "description" in prop
        assert "minimum" in prop
        assert "maximum" in prop

    def test_stop_loss_pct_schema(self) -> None:
        prop = self.schema["properties"]["stop_loss_pct"]
        assert prop["type"] == "number"
        assert "description" in prop
        assert "minimum" in prop
        assert "maximum" in prop

    def test_stop_loss_pct_no_default(self) -> None:
        """stop_loss_pct must not have a default key (None is invalid JSON Schema)."""
        prop = self.schema["properties"]["stop_loss_pct"]
        assert "default" not in prop


class TestNoSignalWhenNotInitialized:
    """Strategy must not emit signals before it has enough data."""

    def test_no_signal_before_slow_period(self) -> None:
        strategy = MACrossoverStrategy(slow_period=5, fast_period=2)
        # Feed fewer bars than slow_period
        for price in [10.0, 11.0, 12.0, 13.0]:
            signals = strategy.on_bar(FakeBar(close=price))
            assert signals == [], f"Unexpected signal at price {price}"

    def test_no_signal_on_first_complete_bar(self) -> None:
        """Even at slow_period bars, no crossover can be detected yet (no previous MA)."""
        strategy = MACrossoverStrategy(slow_period=3, fast_period=2)
        signals: list[Signal] = []
        for price in [10.0, 11.0, 12.0]:
            signals = strategy.on_bar(FakeBar(close=price))
        # First time MAs are computed -- no previous values to compare
        assert signals == []


class TestGoldenCross:
    """Golden cross (fast crosses above slow) should emit LONG."""

    def test_golden_cross_sma(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA", position_size=0.2
        )
        # Build a price series where fast MA starts below slow then crosses above.
        # Phase 1: declining prices so fast < slow once we have enough data
        declining = [100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 88.0]
        for price in declining:
            strategy.on_bar(FakeBar(close=price))

        # Phase 2: sharp rally to push fast MA above slow MA
        rally = [95.0, 100.0, 105.0, 110.0]
        last_signals: list[Signal] = []
        for price in rally:
            result = strategy.on_bar(FakeBar(close=price))
            if result:
                last_signals = result

        assert len(last_signals) == 1
        signal = last_signals[0]
        assert signal.direction == Direction.LONG
        assert signal.size == 0.2
        assert signal.metadata is not None
        assert signal.metadata["event"] == "golden_cross"
        assert signal.metadata["ma_type"] == "SMA"


class TestDeathCross:
    """Death cross (fast crosses below slow) should emit SHORT."""

    def test_death_cross_sma(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA", position_size=0.15
        )
        # Phase 1: rising prices so fast > slow
        rising = [90.0, 92.0, 94.0, 96.0, 98.0, 100.0, 102.0]
        for price in rising:
            strategy.on_bar(FakeBar(close=price))

        # Phase 2: sharp decline to push fast MA below slow MA
        decline = [95.0, 90.0, 85.0, 80.0]
        last_signals: list[Signal] = []
        for price in decline:
            result = strategy.on_bar(FakeBar(close=price))
            if result:
                last_signals = result

        assert len(last_signals) == 1
        signal = last_signals[0]
        assert signal.direction == Direction.SHORT
        assert signal.size == 0.15
        assert signal.metadata is not None
        assert signal.metadata["event"] == "death_cross"


class TestEMAMode:
    """EMA mode should also produce crossover signals."""

    def test_golden_cross_ema(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="EMA", position_size=0.1
        )
        # Declining then rallying prices
        prices = [100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 88.0, 95.0, 100.0, 105.0, 110.0]
        all_signals: list[Signal] = []
        for price in prices:
            result = strategy.on_bar(FakeBar(close=price))
            all_signals.extend(result)

        # Should have at least one LONG from golden cross
        long_signals = [s for s in all_signals if s.direction == Direction.LONG]
        assert len(long_signals) >= 1
        assert long_signals[0].metadata is not None
        assert long_signals[0].metadata["ma_type"] == "EMA"

    def test_death_cross_ema(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="EMA", position_size=0.1
        )
        # Rising then declining prices
        prices = [90.0, 92.0, 94.0, 96.0, 98.0, 100.0, 102.0, 95.0, 90.0, 85.0, 80.0]
        all_signals: list[Signal] = []
        for price in prices:
            result = strategy.on_bar(FakeBar(close=price))
            all_signals.extend(result)

        # Should have at least one SHORT from death cross
        short_signals = [s for s in all_signals if s.direction == Direction.SHORT]
        assert len(short_signals) >= 1
        assert short_signals[0].metadata is not None
        assert short_signals[0].metadata["ma_type"] == "EMA"


class TestParameterValidation:
    """Validate __init__ parameter constraints."""

    def test_fast_period_must_be_less_than_slow_period(self) -> None:
        with pytest.raises(ValueError, match="fast_period.*must be less than.*slow_period"):
            MACrossoverStrategy(fast_period=10, slow_period=10)

    def test_fast_period_greater_than_slow_period_raises(self) -> None:
        with pytest.raises(ValueError, match="fast_period.*must be less than.*slow_period"):
            MACrossoverStrategy(fast_period=20, slow_period=10)

    def test_valid_periods_accepted(self) -> None:
        strategy = MACrossoverStrategy(fast_period=5, slow_period=10)
        assert strategy.fast_period == 5
        assert strategy.slow_period == 10


class TestStopLoss:
    """Stop-loss exits position when loss exceeds threshold."""

    def test_long_stop_loss_triggers(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA",
            position_size=0.2, stop_loss_pct=0.05,
        )
        # Build declining -> rally to get a golden cross LONG entry
        declining = [100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 88.0]
        for price in declining:
            strategy.on_bar(FakeBar(close=price))

        rally = [95.0, 100.0, 105.0, 110.0]
        entry_price: float | None = None
        for price in rally:
            result = strategy.on_bar(FakeBar(close=price))
            if result and result[0].direction == Direction.LONG:
                entry_price = price

        assert entry_price is not None, "Expected a LONG entry signal"

        # Now drop price by more than 5% from entry to trigger stop-loss
        drop_price = entry_price * 0.94  # ~6% loss
        signals = strategy.on_bar(FakeBar(close=drop_price))
        assert len(signals) == 1
        assert signals[0].direction == Direction.FLAT
        assert signals[0].metadata is not None
        assert signals[0].metadata["event"] == "stop_loss"

    def test_short_stop_loss_triggers(self) -> None:
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA",
            position_size=0.15, stop_loss_pct=0.05,
        )
        # Build rising -> decline to get a death cross SHORT entry
        rising = [90.0, 92.0, 94.0, 96.0, 98.0, 100.0, 102.0]
        for price in rising:
            strategy.on_bar(FakeBar(close=price))

        decline = [95.0, 90.0, 85.0, 80.0]
        entry_price: float | None = None
        for price in decline:
            result = strategy.on_bar(FakeBar(close=price))
            if result and result[0].direction == Direction.SHORT:
                entry_price = price

        assert entry_price is not None, "Expected a SHORT entry signal"

        # Now spike price by more than 5% from entry to trigger stop-loss
        spike_price = entry_price * 1.06  # ~6% loss for short
        signals = strategy.on_bar(FakeBar(close=spike_price))
        assert len(signals) == 1
        assert signals[0].direction == Direction.FLAT
        assert signals[0].metadata is not None
        assert signals[0].metadata["event"] == "stop_loss"

    def test_no_stop_loss_when_disabled(self) -> None:
        """When stop_loss_pct is None, no stop-loss signals should fire."""
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA",
            position_size=0.2, stop_loss_pct=None,
        )
        declining = [100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 88.0]
        for price in declining:
            strategy.on_bar(FakeBar(close=price))

        rally = [95.0, 100.0, 105.0, 110.0]
        for price in rally:
            strategy.on_bar(FakeBar(close=price))

        # Large drop -- should NOT trigger stop-loss since it's disabled
        signals = strategy.on_bar(FakeBar(close=50.0))
        flat_signals = [s for s in signals if s.direction == Direction.FLAT]
        assert flat_signals == []

    def test_stop_loss_resets_after_trigger(self) -> None:
        """After stop-loss triggers, subsequent bars should not re-trigger."""
        strategy = MACrossoverStrategy(
            fast_period=3, slow_period=5, ma_type="SMA",
            position_size=0.2, stop_loss_pct=0.05,
        )
        declining = [100.0, 98.0, 96.0, 94.0, 92.0, 90.0, 88.0]
        for price in declining:
            strategy.on_bar(FakeBar(close=price))

        rally = [95.0, 100.0, 105.0, 110.0]
        for price in rally:
            strategy.on_bar(FakeBar(close=price))

        # Trigger stop-loss
        strategy.on_bar(FakeBar(close=50.0))
        # Next bar should NOT produce another stop-loss
        signals = strategy.on_bar(FakeBar(close=40.0))
        flat_signals = [s for s in signals if s.direction == Direction.FLAT]
        assert flat_signals == []


class TestBoundedPriceHistory:
    """Price history buffer should be bounded by slow_period."""

    def test_prices_bounded_by_slow_period(self) -> None:
        strategy = MACrossoverStrategy(fast_period=3, slow_period=5)
        for i in range(100):
            strategy.on_bar(FakeBar(close=float(50 + i)))
        assert len(strategy._prices) == 5


class TestIncrementalEMA:
    """EMA should use incremental computation after seeding."""

    def test_ema_state_seeded_after_slow_period(self) -> None:
        strategy = MACrossoverStrategy(fast_period=3, slow_period=5, ma_type="EMA")
        for price in [10.0, 11.0, 12.0, 13.0]:
            strategy.on_bar(FakeBar(close=price))
        assert strategy._fast_ema is None  # Not yet seeded

        strategy.on_bar(FakeBar(close=14.0))  # 5th bar
        assert strategy._fast_ema is not None
        assert strategy._slow_ema is not None

    def test_ema_updates_incrementally(self) -> None:
        strategy = MACrossoverStrategy(fast_period=3, slow_period=5, ma_type="EMA")
        for price in [10.0, 11.0, 12.0, 13.0, 14.0]:
            strategy.on_bar(FakeBar(close=price))

        ema_after_seed = strategy._fast_ema
        strategy.on_bar(FakeBar(close=15.0))
        # EMA should have changed after new price
        assert strategy._fast_ema != ema_after_seed


class TestOnTrade:
    """on_trade returns empty signals (tick-level not used for MA crossover)."""

    def test_on_trade_returns_empty(self) -> None:
        strategy = MACrossoverStrategy()
        assert strategy.on_trade({"price": 100.0}) == []
