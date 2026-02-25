"""Tests for the Grid Trading Strategy."""

from __future__ import annotations

import math
from types import SimpleNamespace

import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.market_making.grid_trading import GridTradingStrategy


# ---------------------------------------------------------------------------
# Class attributes
# ---------------------------------------------------------------------------


class TestClassAttributes:
    def test_inherits_strategy(self):
        assert issubclass(GridTradingStrategy, Strategy)

    def test_name(self):
        assert GridTradingStrategy.name == "grid_trading"

    def test_market_regime(self):
        assert GridTradingStrategy.market_regime == "ranging"

    def test_description_non_empty(self):
        assert len(GridTradingStrategy.description) > 0


# ---------------------------------------------------------------------------
# CONFIG_SCHEMA completeness
# ---------------------------------------------------------------------------


class TestConfigSchema:
    schema = GridTradingStrategy.CONFIG_SCHEMA

    def test_has_json_schema_key(self):
        assert "$schema" in self.schema

    def test_required_properties(self):
        props = self.schema["properties"]
        for name in [
            "upper_price",
            "lower_price",
            "grid_count",
            "total_investment",
            "grid_type",
        ]:
            assert name in props, f"Missing property: {name}"

    def test_properties_have_type(self):
        for name, prop in self.schema["properties"].items():
            assert "type" in prop, f"{name} missing 'type'"

    def test_properties_have_description(self):
        for name, prop in self.schema["properties"].items():
            assert "description" in prop, f"{name} missing 'description'"

    def test_defaults_present(self):
        props = self.schema["properties"]
        assert props["grid_count"]["default"] == 10
        assert props["grid_type"]["default"] == "arithmetic"

    def test_grid_type_enum(self):
        assert self.schema["properties"]["grid_type"]["enum"] == [
            "arithmetic",
            "geometric",
        ]

    def test_constraints_present(self):
        props = self.schema["properties"]
        assert "minimum" in props["grid_count"]
        assert "maximum" in props["grid_count"]
        assert "minimum" in props["upper_price"]
        assert "minimum" in props["lower_price"]
        assert "minimum" in props["total_investment"]


# ---------------------------------------------------------------------------
# Arithmetic grid level calculation
# ---------------------------------------------------------------------------


class TestArithmeticGrid:
    def test_level_count(self):
        s = GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_count=5)
        assert len(s.grid_levels) == 6  # grid_count + 1

    def test_levels_evenly_spaced(self):
        s = GridTradingStrategy("BTC/USDT", 200, 100, 1000, grid_count=4)
        levels = s.grid_levels
        step = (200 - 100) / 4
        for i, level in enumerate(levels):
            assert level == pytest.approx(100 + i * step)

    def test_boundaries_included(self):
        s = GridTradingStrategy("BTC/USDT", 50000, 40000, 10000, grid_count=10)
        levels = s.grid_levels
        assert levels[0] == pytest.approx(40000)
        assert levels[-1] == pytest.approx(50000)


# ---------------------------------------------------------------------------
# Geometric grid level calculation
# ---------------------------------------------------------------------------


class TestGeometricGrid:
    def test_level_count(self):
        s = GridTradingStrategy(
            "BTC/USDT", 200, 100, 1000, grid_count=5, grid_type="geometric"
        )
        assert len(s.grid_levels) == 6

    def test_levels_ratio_based(self):
        s = GridTradingStrategy(
            "BTC/USDT", 400, 100, 1000, grid_count=4, grid_type="geometric"
        )
        levels = s.grid_levels
        ratio = 400 / 100
        for i, level in enumerate(levels):
            expected = 100 * math.pow(ratio, i / 4)
            assert level == pytest.approx(expected)

    def test_boundaries_included(self):
        s = GridTradingStrategy(
            "BTC/USDT", 50000, 40000, 10000, grid_count=10, grid_type="geometric"
        )
        levels = s.grid_levels
        assert levels[0] == pytest.approx(40000)
        assert levels[-1] == pytest.approx(50000)

    def test_spacing_widens_at_higher_prices(self):
        s = GridTradingStrategy(
            "BTC/USDT", 400, 100, 1000, grid_count=4, grid_type="geometric"
        )
        levels = s.grid_levels
        gaps = [levels[i + 1] - levels[i] for i in range(len(levels) - 1)]
        # Each gap should be larger than the previous
        for i in range(len(gaps) - 1):
            assert gaps[i + 1] > gaps[i]


# ---------------------------------------------------------------------------
# Buy / sell signal generation
# ---------------------------------------------------------------------------


class TestSignals:
    def _make_strategy(self, **kwargs):
        defaults = {
            "symbol": "BTC/USDT",
            "upper_price": 110,
            "lower_price": 100,
            "total_investment": 1000,
            "grid_count": 10,
        }
        defaults.update(kwargs)
        return GridTradingStrategy(**defaults)

    def test_buy_signal_on_price_drop(self):
        s = self._make_strategy()
        # First bar sets the last_price
        bar1 = SimpleNamespace(close=105.5)
        s.on_bar(bar1)
        # Drop below a grid level (105 is level index 5)
        bar2 = SimpleNamespace(close=104.5)
        signals = s.on_bar(bar2)
        buy_signals = [sig for sig in signals if sig.direction == Direction.LONG]
        assert len(buy_signals) >= 1
        assert buy_signals[0].symbol == "BTC/USDT"

    def test_sell_signal_on_price_rise(self):
        s = self._make_strategy()
        # Set initial price, drop to fill a level, then rise above it
        s.on_bar(SimpleNamespace(close=105.5))
        s.on_bar(SimpleNamespace(close=104.5))  # fills level at 105
        signals = s.on_bar(SimpleNamespace(close=105.5))
        sell_signals = [sig for sig in signals if sig.direction == Direction.SHORT]
        assert len(sell_signals) >= 1

    def test_no_duplicate_buy_at_filled_level(self):
        s = self._make_strategy()
        s.on_bar(SimpleNamespace(close=105.5))
        s.on_bar(SimpleNamespace(close=104.5))  # fills level 105
        # Bounce back above then drop again -- level should still be filled
        s.on_bar(SimpleNamespace(close=104.8))
        signals = s.on_bar(SimpleNamespace(close=104.5))
        buy_at_105 = [
            sig
            for sig in signals
            if sig.direction == Direction.LONG
            and sig.metadata
            and sig.metadata.get("grid_level") == pytest.approx(105)
        ]
        assert len(buy_at_105) == 0

    def test_on_trade_generates_signals(self):
        s = self._make_strategy()
        trade1 = SimpleNamespace(price=105.5)
        s.on_trade(trade1)
        trade2 = SimpleNamespace(price=104.5)
        signals = s.on_trade(trade2)
        assert len(signals) >= 1

    def test_signal_metadata_contains_grid_info(self):
        s = self._make_strategy()
        s.on_bar(SimpleNamespace(close=105.5))
        signals = s.on_bar(SimpleNamespace(close=104.5))
        assert len(signals) >= 1
        sig = signals[0]
        assert sig.metadata is not None
        assert "grid_index" in sig.metadata
        assert "grid_level" in sig.metadata


# ---------------------------------------------------------------------------
# No signals outside grid range
# ---------------------------------------------------------------------------


class TestOutOfRange:
    def test_no_signals_above_range(self):
        s = GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_count=10)
        s.on_bar(SimpleNamespace(close=115))
        signals = s.on_bar(SimpleNamespace(close=120))
        assert signals == []

    def test_no_signals_below_range(self):
        s = GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_count=10)
        s.on_bar(SimpleNamespace(close=95))
        signals = s.on_bar(SimpleNamespace(close=90))
        assert signals == []

    def test_first_bar_no_signals(self):
        s = GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_count=10)
        signals = s.on_bar(SimpleNamespace(close=105))
        assert signals == []


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    def test_upper_must_exceed_lower(self):
        with pytest.raises(ValueError, match="upper_price"):
            GridTradingStrategy("BTC/USDT", 100, 100, 1000)

    def test_grid_count_minimum(self):
        with pytest.raises(ValueError, match="grid_count"):
            GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_count=1)

    def test_invalid_grid_type(self):
        with pytest.raises(ValueError, match="grid_type"):
            GridTradingStrategy("BTC/USDT", 110, 100, 1000, grid_type="linear")

    def test_investment_positive(self):
        with pytest.raises(ValueError, match="total_investment"):
            GridTradingStrategy("BTC/USDT", 110, 100, 0)
