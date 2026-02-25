"""Tests for BollingerReversionStrategy."""

from __future__ import annotations

import numpy as np
import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.mean_reversion.bollinger_reversion import (
    BollingerReversionStrategy,
)


class TestClassAttributes:
    """Verify strategy class attributes."""

    def test_inherits_strategy(self) -> None:
        assert issubclass(BollingerReversionStrategy, Strategy)

    def test_name(self) -> None:
        assert BollingerReversionStrategy.name == "bollinger_reversion"

    def test_description(self) -> None:
        assert "Bollinger Band" in BollingerReversionStrategy.description

    def test_market_regime(self) -> None:
        assert BollingerReversionStrategy.market_regime == "ranging"


class TestConfigSchema:
    """Verify CONFIG_SCHEMA completeness."""

    @pytest.fixture()
    def schema(self) -> dict:
        return BollingerReversionStrategy.CONFIG_SCHEMA

    def test_has_json_schema_fields(self, schema: dict) -> None:
        assert "$schema" in schema
        assert schema["type"] == "object"

    def test_has_all_properties(self, schema: dict) -> None:
        props = schema["properties"]
        expected = {"period", "std_dev", "position_size", "stop_loss_pct", "take_profit_pct"}
        assert set(props.keys()) == expected

    def test_property_fields(self, schema: dict) -> None:
        """Each property must have type, default, description, and min/max constraints."""
        for name, prop in schema["properties"].items():
            assert "type" in prop, f"{name} missing type"
            assert "default" in prop, f"{name} missing default"
            assert "description" in prop, f"{name} missing description"
            assert "minimum" in prop, f"{name} missing minimum"
            assert "maximum" in prop, f"{name} missing maximum"

    def test_default_values(self, schema: dict) -> None:
        props = schema["properties"]
        assert props["period"]["default"] == 20
        assert props["std_dev"]["default"] == 2.0
        assert props["position_size"]["default"] == 0.1
        assert props["stop_loss_pct"]["default"] == 0.03
        assert props["take_profit_pct"]["default"] == 0.02


class TestBollingerBandCalculation:
    """Verify Bollinger Band math."""

    def test_compute_bands_correct(self) -> None:
        strat = BollingerReversionStrategy(period=5, std_dev=2.0)
        prices = [100.0, 102.0, 98.0, 101.0, 99.0]
        for p in prices:
            strat._prices.append(p)

        bands = strat._compute_bands()
        assert bands is not None
        lower, middle, upper = bands

        arr = np.array(prices)
        expected_middle = float(np.mean(arr))
        expected_std = float(np.std(arr, ddof=0))

        assert middle == pytest.approx(expected_middle)
        assert upper == pytest.approx(expected_middle + 2.0 * expected_std)
        assert lower == pytest.approx(expected_middle - 2.0 * expected_std)

    def test_compute_bands_insufficient_data(self) -> None:
        strat = BollingerReversionStrategy(period=20)
        for p in [100.0, 101.0, 102.0]:
            strat._prices.append(p)
        assert strat._compute_bands() is None


class TestSignalGeneration:
    """Verify signal generation on bar and trade events."""

    @staticmethod
    def _make_bars(prices: list[float], symbol: str = "BTC-USD") -> list[dict]:
        return [{"close": p, "symbol": symbol} for p in prices]

    def test_long_signal_at_lower_band(self) -> None:
        strat = BollingerReversionStrategy(period=5, std_dev=2.0, position_size=0.1)
        # Feed 4 bars at stable price, then a sharp drop
        warmup = [100.0, 100.0, 100.0, 100.0]
        for bar in self._make_bars(warmup):
            strat.on_bar(bar)

        # Price drops well below lower band
        signals = strat.on_bar({"close": 90.0, "symbol": "BTC-USD"})
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG
        assert signals[0].symbol == "BTC-USD"
        assert signals[0].size == 0.1
        assert signals[0].price == 90.0
        assert "lower" in signals[0].metadata
        assert "middle" in signals[0].metadata
        assert "upper" in signals[0].metadata

    def test_short_signal_at_upper_band(self) -> None:
        strat = BollingerReversionStrategy(period=5, std_dev=2.0, position_size=0.1)
        warmup = [100.0, 100.0, 100.0, 100.0]
        for bar in self._make_bars(warmup):
            strat.on_bar(bar)

        # Price spikes above upper band
        signals = strat.on_bar({"close": 110.0, "symbol": "BTC-USD"})
        assert len(signals) == 1
        assert signals[0].direction == Direction.SHORT
        assert signals[0].symbol == "BTC-USD"
        assert signals[0].size == 0.1
        assert signals[0].price == 110.0

    def test_no_signal_between_bands(self) -> None:
        strat = BollingerReversionStrategy(period=5, std_dev=2.0)
        warmup = [100.0, 101.0, 99.0, 100.0]
        for bar in self._make_bars(warmup):
            strat.on_bar(bar)

        # Price stays near the mean
        signals = strat.on_bar({"close": 100.0, "symbol": "BTC-USD"})
        assert signals == []

    def test_no_signal_insufficient_data(self) -> None:
        strat = BollingerReversionStrategy(period=20)
        signals = strat.on_bar({"close": 100.0, "symbol": "BTC-USD"})
        assert signals == []

    def test_on_trade_generates_signal(self) -> None:
        strat = BollingerReversionStrategy(period=5, std_dev=2.0, position_size=0.2)
        warmup = [100.0, 100.0, 100.0, 100.0]
        for t in warmup:
            strat.on_trade({"price": t, "symbol": "ETH-USD"})

        signals = strat.on_trade({"price": 90.0, "symbol": "ETH-USD"})
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG
        assert signals[0].symbol == "ETH-USD"
        assert signals[0].size == 0.2
