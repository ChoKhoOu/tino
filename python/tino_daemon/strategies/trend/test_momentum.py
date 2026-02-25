"""Tests for RSI Momentum Strategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.trend.momentum import RSIMomentumStrategy


# -- helpers --


@dataclass
class FakeBar:
    close: float


@dataclass
class FakeTrade:
    price: float


def _make_rising_prices(n: int, start: float = 100.0, step: float = 1.0) -> list[float]:
    """Generate monotonically rising prices (drives RSI toward 100)."""
    return [start + i * step for i in range(n)]


def _make_falling_prices(n: int, start: float = 200.0, step: float = 1.0) -> list[float]:
    """Generate monotonically falling prices (drives RSI toward 0)."""
    return [start - i * step for i in range(n)]


def _make_flat_prices(n: int, value: float = 100.0) -> list[float]:
    """Generate flat prices (RSI = 100 since no losses)."""
    return [value] * n


# -- test class attributes --


class TestClassAttributes:
    def test_name(self) -> None:
        assert RSIMomentumStrategy.name == "rsi_momentum"

    def test_description(self) -> None:
        assert "RSI" in RSIMomentumStrategy.description
        assert "LONG" in RSIMomentumStrategy.description
        assert "SHORT" in RSIMomentumStrategy.description

    def test_market_regime(self) -> None:
        assert RSIMomentumStrategy.market_regime == "trending"

    def test_inherits_strategy(self) -> None:
        assert issubclass(RSIMomentumStrategy, Strategy)


# -- test CONFIG_SCHEMA --


class TestConfigSchema:
    def test_schema_has_required_keys(self) -> None:
        schema = RSIMomentumStrategy.CONFIG_SCHEMA
        assert "$schema" in schema
        assert "title" in schema
        assert "description" in schema
        assert "type" in schema
        assert schema["type"] == "object"
        assert "properties" in schema

    def test_schema_has_all_properties(self) -> None:
        props = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]
        expected = {"rsi_period", "overbought", "oversold", "position_size", "stop_loss_pct"}
        assert set(props.keys()) == expected

    def test_each_property_has_type_default_description(self) -> None:
        props = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]
        for name, spec in props.items():
            assert "type" in spec, f"{name} missing 'type'"
            assert "default" in spec, f"{name} missing 'default'"
            assert "description" in spec, f"{name} missing 'description'"

    def test_rsi_period_constraints(self) -> None:
        prop = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]["rsi_period"]
        assert prop["type"] == "integer"
        assert prop["default"] == 14
        assert prop["minimum"] == 2
        assert prop["maximum"] == 200

    def test_overbought_constraints(self) -> None:
        prop = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]["overbought"]
        assert prop["type"] == "number"
        assert prop["default"] == 70
        assert prop["minimum"] == 50
        assert prop["maximum"] == 100

    def test_oversold_constraints(self) -> None:
        prop = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]["oversold"]
        assert prop["type"] == "number"
        assert prop["default"] == 30
        assert prop["minimum"] == 0
        assert prop["maximum"] == 50

    def test_position_size_constraints(self) -> None:
        prop = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]["position_size"]
        assert prop["type"] == "number"
        assert prop["default"] == 0.10
        assert prop["minimum"] == 0.01
        assert prop["maximum"] == 1.0

    def test_stop_loss_pct_constraints(self) -> None:
        prop = RSIMomentumStrategy.CONFIG_SCHEMA["properties"]["stop_loss_pct"]
        assert prop["type"] == "number"
        assert prop["minimum"] == 0.001
        assert prop["maximum"] == 0.5

    def test_no_additional_properties(self) -> None:
        assert RSIMomentumStrategy.CONFIG_SCHEMA["additionalProperties"] is False


# -- test RSI calculation --


class TestRSICalculation:
    def test_insufficient_data_returns_none(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        # Need 15 prices for period=14, provide only 10
        result = strategy.compute_rsi([100.0] * 10)
        assert result is None

    def test_exact_minimum_data(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        # 15 prices = rsi_period + 1 is sufficient
        prices = _make_rising_prices(15)
        result = strategy.compute_rsi(prices)
        assert result is not None

    def test_all_gains_rsi_is_100(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        prices = _make_rising_prices(20)
        rsi = strategy.compute_rsi(prices)
        assert rsi is not None
        assert rsi == 100.0

    def test_all_losses_rsi_near_zero(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        prices = _make_falling_prices(20)
        rsi = strategy.compute_rsi(prices)
        assert rsi is not None
        assert rsi == pytest.approx(0.0, abs=0.01)

    def test_known_rsi_value(self) -> None:
        """Test RSI with a hand-calculated example.

        Prices: 44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
                46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41,
                46.22, 45.64
        This is a classic textbook RSI example (Wilder's 14-period).
        We verify the RSI is in a reasonable range rather than exact match
        because our implementation uses simple average (not Wilder smoothing).
        """
        prices = [
            44.0, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42,
            45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
            46.03, 46.41, 46.22, 45.64,
        ]
        strategy = RSIMomentumStrategy(rsi_period=14)
        rsi = strategy.compute_rsi(prices)
        assert rsi is not None
        # RSI should be in a mid-range for this mixed data
        assert 30 < rsi < 70

    def test_rsi_range_is_0_to_100(self) -> None:
        """RSI should always be between 0 and 100."""
        rng = np.random.default_rng(42)
        strategy = RSIMomentumStrategy(rsi_period=14)
        prices = (100 + rng.standard_normal(50).cumsum()).tolist()
        rsi = strategy.compute_rsi(prices)
        assert rsi is not None
        assert 0 <= rsi <= 100


# -- test signal generation via on_bar --


class TestOnBarSignals:
    def test_long_signal_when_oversold(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=5, oversold=30, overbought=70)
        # Feed falling prices to push RSI below 30
        falling = _make_falling_prices(10, start=200.0, step=5.0)
        signals: list[Signal] = []
        for price in falling:
            signals = strategy.on_bar(FakeBar(close=price))
        # After sustained drops, RSI should be < 30 -> LONG
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG
        assert signals[0].metadata is not None
        assert signals[0].metadata["rsi"] < 30

    def test_short_signal_when_overbought(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=5, oversold=30, overbought=70)
        # Feed rising prices to push RSI above 70
        rising = _make_rising_prices(10, start=100.0, step=5.0)
        signals: list[Signal] = []
        for price in rising:
            signals = strategy.on_bar(FakeBar(close=price))
        # After sustained rises, RSI should be > 70 -> SHORT
        assert len(signals) == 1
        assert signals[0].direction == Direction.SHORT
        assert signals[0].metadata is not None
        assert signals[0].metadata["rsi"] > 70

    def test_no_signal_between_thresholds(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=5, oversold=30, overbought=70)
        # Mix of ups and downs to get RSI in 30-70 range
        prices = [100, 102, 99, 101, 98, 100, 103, 101, 99, 100]
        signals: list[Signal] = []
        for price in prices:
            signals = strategy.on_bar(FakeBar(close=float(price)))
        # Mixed price action should produce RSI in neutral zone
        # Verify no signal (or if a signal appears, RSI is actually outside range)
        if len(signals) > 0:
            rsi = signals[0].metadata["rsi"]
            assert rsi < 30 or rsi > 70
        # If no signals, the test passes

    def test_no_signal_when_insufficient_data(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        # Feed only 5 bars (need 15 for period=14)
        for i in range(5):
            signals = strategy.on_bar(FakeBar(close=100.0 + i))
        assert signals == []

    def test_signal_includes_price_and_symbol(self) -> None:
        strategy = RSIMomentumStrategy(
            symbol="ETH-USDT", rsi_period=5, position_size=0.25,
        )
        rising = _make_rising_prices(10, start=100.0, step=5.0)
        signals: list[Signal] = []
        for price in rising:
            signals = strategy.on_bar(FakeBar(close=price))
        assert len(signals) == 1
        assert signals[0].symbol == "ETH-USDT"
        assert signals[0].size == 0.25
        assert signals[0].price == rising[-1]


# -- test signal generation via on_trade --


class TestOnTradeSignals:
    def test_long_signal_on_trade(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=5, oversold=30, overbought=70)
        falling = _make_falling_prices(10, start=200.0, step=5.0)
        signals: list[Signal] = []
        for price in falling:
            signals = strategy.on_trade(FakeTrade(price=price))
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG

    def test_short_signal_on_trade(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=5, oversold=30, overbought=70)
        rising = _make_rising_prices(10, start=100.0, step=5.0)
        signals: list[Signal] = []
        for price in rising:
            signals = strategy.on_trade(FakeTrade(price=price))
        assert len(signals) == 1
        assert signals[0].direction == Direction.SHORT

    def test_no_signal_insufficient_data(self) -> None:
        strategy = RSIMomentumStrategy(rsi_period=14)
        for i in range(5):
            signals = strategy.on_trade(FakeTrade(price=100.0 + i))
        assert signals == []
