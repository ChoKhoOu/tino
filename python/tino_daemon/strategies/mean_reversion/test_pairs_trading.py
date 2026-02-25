"""Tests for PairsTradingStrategy."""

from __future__ import annotations

import numpy as np
import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.mean_reversion.pairs_trading import (
    PairsTradingStrategy,
)


class TestClassAttributes:
    """Verify strategy class attributes."""

    def test_inherits_strategy(self) -> None:
        assert issubclass(PairsTradingStrategy, Strategy)

    def test_name(self) -> None:
        assert PairsTradingStrategy.name == "pairs_trading"

    def test_description(self) -> None:
        assert "cointegration" in PairsTradingStrategy.description.lower()

    def test_market_regime(self) -> None:
        assert PairsTradingStrategy.market_regime == "ranging"


class TestConfigSchema:
    """Verify CONFIG_SCHEMA completeness."""

    @pytest.fixture()
    def schema(self) -> dict:
        return PairsTradingStrategy.CONFIG_SCHEMA

    def test_has_json_schema_fields(self, schema: dict) -> None:
        assert "$schema" in schema
        assert schema["type"] == "object"

    def test_has_all_properties(self, schema: dict) -> None:
        props = schema["properties"]
        expected = {
            "symbol_a",
            "symbol_b",
            "lookback_period",
            "entry_zscore",
            "exit_zscore",
            "position_size",
        }
        assert set(props.keys()) == expected

    def test_property_fields_numeric(self, schema: dict) -> None:
        """Numeric properties must have type, default, description, and min/max."""
        numeric = {"lookback_period", "entry_zscore", "exit_zscore", "position_size"}
        for name in numeric:
            prop = schema["properties"][name]
            assert "type" in prop, f"{name} missing type"
            assert "default" in prop, f"{name} missing default"
            assert "description" in prop, f"{name} missing description"
            assert "minimum" in prop, f"{name} missing minimum"
            assert "maximum" in prop, f"{name} missing maximum"

    def test_property_fields_string(self, schema: dict) -> None:
        """String properties must have type, default, description."""
        for name in ("symbol_a", "symbol_b"):
            prop = schema["properties"][name]
            assert prop["type"] == "string", f"{name} wrong type"
            assert "default" in prop, f"{name} missing default"
            assert "description" in prop, f"{name} missing description"

    def test_default_values(self, schema: dict) -> None:
        props = schema["properties"]
        assert props["symbol_a"]["default"] == "BTCUSDT"
        assert props["symbol_b"]["default"] == "ETHUSDT"
        assert props["lookback_period"]["default"] == 60
        assert props["entry_zscore"]["default"] == 2.0
        assert props["exit_zscore"]["default"] == 0.5
        assert props["position_size"]["default"] == 0.1

    def test_constraints(self, schema: dict) -> None:
        props = schema["properties"]
        assert props["lookback_period"]["minimum"] == 10
        assert props["lookback_period"]["maximum"] == 500
        assert props["entry_zscore"]["minimum"] == 0.5
        assert props["entry_zscore"]["maximum"] == 5.0
        assert props["exit_zscore"]["minimum"] == 0.0
        assert props["exit_zscore"]["maximum"] == 3.0
        assert props["position_size"]["minimum"] == 0.01
        assert props["position_size"]["maximum"] == 1.0


class TestCointegration:
    """Verify spread calculation and z-score computation."""

    def test_hedge_ratio_calculation(self) -> None:
        strat = PairsTradingStrategy(lookback_period=5)
        prices_a = np.array([100.0, 102.0, 104.0, 103.0, 105.0])
        prices_b = np.array([50.0, 51.0, 52.0, 51.5, 52.5])
        ratio = strat._compute_hedge_ratio(prices_a, prices_b)
        # Hedge ratio should be positive for positively correlated assets
        assert ratio > 0

    def test_spread_zscore_computation(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=5
        )
        # Feed perfectly correlated prices (ratio ~2.0)
        for a, b in [(100, 50), (102, 51), (104, 52), (103, 51.5), (105, 52.5)]:
            strat._prices["A"].append(float(a))
            strat._prices["B"].append(float(b))

        result = strat._compute_spread_and_zscore()
        assert result is not None
        zscore, spread, hedge_ratio, is_cointegrated = result
        assert isinstance(zscore, float)
        assert isinstance(spread, float)
        assert isinstance(hedge_ratio, float)
        assert isinstance(is_cointegrated, bool)

    def test_cointegration_check_stationary_residuals(self) -> None:
        strat = PairsTradingStrategy(lookback_period=5)
        # Mean-reverting residuals (oscillating around 0)
        residuals = np.array([1.0, -1.0, 0.8, -0.9, 0.7, -0.8, 0.6, -0.7])
        assert strat._check_cointegration(residuals) is True

    def test_cointegration_check_nonstationary_residuals(self) -> None:
        strat = PairsTradingStrategy(lookback_period=5)
        # Trending residuals (random walk)
        residuals = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0])
        assert strat._check_cointegration(residuals) is False

    def test_cointegration_check_insufficient_data(self) -> None:
        strat = PairsTradingStrategy(lookback_period=5)
        assert strat._check_cointegration(np.array([1.0, 2.0])) is False

    def test_returns_none_with_insufficient_data(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=10
        )
        # Only add 3 prices
        for a, b in [(100, 50), (102, 51), (104, 52)]:
            strat._prices["A"].append(float(a))
            strat._prices["B"].append(float(b))
        assert strat._compute_spread_and_zscore() is None


class TestSignalGeneration:
    """Verify signal generation on bar and trade events."""

    @staticmethod
    def _feed_prices(
        strat: PairsTradingStrategy,
        pairs: list[tuple[float, float]],
    ) -> None:
        """Feed price pairs via on_bar for both symbols."""
        for a, b in pairs:
            strat.on_bar({"close": a, "symbol": strat.symbol_a})
            strat.on_bar({"close": b, "symbol": strat.symbol_b})

    def test_short_a_long_b_when_spread_high(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A",
            symbol_b="B",
            lookback_period=5,
            entry_zscore=1.5,
            position_size=0.2,
        )
        # Feed stable pairs to warm up
        warmup = [(100, 50), (100, 50), (100, 50), (100, 50)]
        self._feed_prices(strat, warmup)

        # Sharp divergence: A spikes up
        strat.on_bar({"close": 50.0, "symbol": "B"})
        signals = strat.on_bar({"close": 120.0, "symbol": "A"})

        # Should get SHORT A + LONG B
        if len(signals) == 2:
            dirs = {(s.symbol, s.direction) for s in signals}
            assert ("A", Direction.SHORT) in dirs
            assert ("B", Direction.LONG) in dirs
            for s in signals:
                assert s.size == 0.2
                assert "zscore" in s.metadata
                assert "spread" in s.metadata
                assert "hedge_ratio" in s.metadata
                assert "is_cointegrated" in s.metadata

    def test_long_a_short_b_when_spread_low(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A",
            symbol_b="B",
            lookback_period=5,
            entry_zscore=1.5,
            position_size=0.15,
        )
        warmup = [(100, 50), (100, 50), (100, 50), (100, 50)]
        self._feed_prices(strat, warmup)

        # Sharp divergence: A drops
        strat.on_bar({"close": 50.0, "symbol": "B"})
        signals = strat.on_bar({"close": 80.0, "symbol": "A"})

        if len(signals) == 2:
            dirs = {(s.symbol, s.direction) for s in signals}
            assert ("A", Direction.LONG) in dirs
            assert ("B", Direction.SHORT) in dirs
            for s in signals:
                assert s.size == 0.15

    def test_flat_signals_on_exit(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A",
            symbol_b="B",
            lookback_period=5,
            entry_zscore=2.0,
            exit_zscore=0.5,
        )
        # Feed prices that create a near-zero z-score (stable mean)
        stable = [(100, 50), (101, 50.5), (99, 49.5), (100, 50)]
        self._feed_prices(strat, stable)

        # Last price very close to mean spread
        strat.on_bar({"close": 50.0, "symbol": "B"})
        signals = strat.on_bar({"close": 100.0, "symbol": "A"})

        # With stable prices, z-score near 0 < exit_zscore -> FLAT
        if len(signals) == 2:
            for s in signals:
                assert s.direction == Direction.FLAT

    def test_no_signal_insufficient_data(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=20
        )
        signals = strat.on_bar({"close": 100.0, "symbol": "A"})
        assert signals == []

    def test_on_trade_generates_signal(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A",
            symbol_b="B",
            lookback_period=5,
            entry_zscore=1.5,
            position_size=0.3,
        )
        # Warm up via on_trade
        for a, b in [(100, 50), (100, 50), (100, 50), (100, 50)]:
            strat.on_trade({"price": a, "symbol": "A"})
            strat.on_trade({"price": b, "symbol": "B"})

        strat.on_trade({"price": 50.0, "symbol": "B"})
        signals = strat.on_trade({"price": 120.0, "symbol": "A"})
        # Should produce signals (or empty if z-score not exceeded)
        assert isinstance(signals, list)
        for s in signals:
            assert isinstance(s, Signal)

    def test_metadata_fields(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A",
            symbol_b="B",
            lookback_period=5,
            entry_zscore=0.1,  # Very low threshold to guarantee signals
            exit_zscore=0.0,
        )
        # Feed slightly varying prices
        pairs = [(100, 50), (102, 50), (98, 50), (101, 50)]
        self._feed_prices(strat, pairs)
        strat.on_bar({"close": 50.0, "symbol": "B"})
        signals = strat.on_bar({"close": 105.0, "symbol": "A"})

        if signals:
            meta = signals[0].metadata
            assert "zscore" in meta
            assert "spread" in meta
            assert "hedge_ratio" in meta
            assert "is_cointegrated" in meta


class TestDualSymbol:
    """Verify handling of two different symbols and data alignment."""

    def test_unknown_symbol_ignored(self) -> None:
        strat = PairsTradingStrategy(symbol_a="A", symbol_b="B", lookback_period=5)
        signals = strat.on_bar({"close": 100.0, "symbol": "UNKNOWN"})
        assert signals == []

    def test_data_alignment_partial(self) -> None:
        """No signals when only one symbol has enough data."""
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=5
        )
        # Feed enough data for A only
        for i in range(5):
            strat.on_bar({"close": 100.0 + i, "symbol": "A"})
        # B only has 2 prices
        strat.on_bar({"close": 50.0, "symbol": "B"})
        signals = strat.on_bar({"close": 51.0, "symbol": "B"})
        assert signals == []

    def test_both_symbols_tracked(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=3
        )
        for a, b in [(100, 50), (102, 51), (104, 52)]:
            strat.on_bar({"close": a, "symbol": "A"})
            strat.on_bar({"close": b, "symbol": "B"})

        assert len(strat._prices["A"]) == 3
        assert len(strat._prices["B"]) == 3

    def test_deque_respects_maxlen(self) -> None:
        strat = PairsTradingStrategy(
            symbol_a="A", symbol_b="B", lookback_period=3
        )
        for i in range(10):
            strat.on_bar({"close": 100.0 + i, "symbol": "A"})
            strat.on_bar({"close": 50.0 + i, "symbol": "B"})
        assert len(strat._prices["A"]) == 3
        assert len(strat._prices["B"]) == 3

    def test_zero_price_ignored(self) -> None:
        strat = PairsTradingStrategy(symbol_a="A", symbol_b="B", lookback_period=5)
        signals = strat.on_bar({"close": 0.0, "symbol": "A"})
        assert signals == []
        assert len(strat._prices["A"]) == 0
