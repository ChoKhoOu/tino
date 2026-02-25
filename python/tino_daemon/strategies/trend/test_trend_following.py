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


class TestOnTrade:
    """on_trade returns empty signals (tick-level not used for MA crossover)."""

    def test_on_trade_returns_empty(self) -> None:
        strategy = MACrossoverStrategy()
        assert strategy.on_trade({"price": 100.0}) == []
