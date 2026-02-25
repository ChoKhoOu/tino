"""Tests for the Basic Market Making Strategy."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.market_making.basic_mm import BasicMarketMakingStrategy


# ---------------------------------------------------------------------------
# Class attributes
# ---------------------------------------------------------------------------


class TestClassAttributes:
    def test_inherits_strategy(self):
        assert issubclass(BasicMarketMakingStrategy, Strategy)

    def test_name(self):
        assert BasicMarketMakingStrategy.name == "basic_market_making"

    def test_market_regime(self):
        assert BasicMarketMakingStrategy.market_regime == "ranging"

    def test_description_non_empty(self):
        assert len(BasicMarketMakingStrategy.description) > 0


# ---------------------------------------------------------------------------
# CONFIG_SCHEMA completeness
# ---------------------------------------------------------------------------


class TestConfigSchema:
    schema = BasicMarketMakingStrategy.CONFIG_SCHEMA

    def test_has_json_schema_key(self):
        assert "$schema" in self.schema

    def test_required_properties(self):
        props = self.schema["properties"]
        for name in [
            "bid_spread",
            "ask_spread",
            "order_amount",
            "order_levels",
            "order_refresh_time",
            "inventory_skew",
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
        assert props["bid_spread"]["default"] == 0.001
        assert props["ask_spread"]["default"] == 0.001
        assert props["order_levels"]["default"] == 3
        assert props["order_refresh_time"]["default"] == 15.0
        assert props["inventory_skew"]["default"] == 0.0

    def test_constraints_present(self):
        props = self.schema["properties"]
        assert props["bid_spread"]["minimum"] == 0.0001
        assert props["bid_spread"]["maximum"] == 0.1
        assert props["ask_spread"]["minimum"] == 0.0001
        assert props["ask_spread"]["maximum"] == 0.1
        assert props["order_levels"]["minimum"] == 1
        assert props["order_levels"]["maximum"] == 20
        assert props["order_refresh_time"]["minimum"] == 1.0
        assert props["order_refresh_time"]["maximum"] == 3600.0
        assert props["inventory_skew"]["minimum"] == 0.0
        assert props["inventory_skew"]["maximum"] == 1.0
        assert "exclusiveMinimum" in props["order_amount"]

    def test_required_fields(self):
        assert "order_amount" in self.schema["required"]

    def test_no_additional_properties(self):
        assert self.schema["additionalProperties"] is False


# ---------------------------------------------------------------------------
# Helper to create strategy with refresh bypassed
# ---------------------------------------------------------------------------


def _make_strategy(**kwargs) -> BasicMarketMakingStrategy:
    """Create a strategy with sensible defaults and refresh timer reset."""
    defaults = {
        "symbol": "BTC/USDT",
        "order_amount": 1.0,
        "bid_spread": 0.001,
        "ask_spread": 0.001,
        "order_levels": 3,
        "order_refresh_time": 1.0,
        "inventory_skew": 0.0,
    }
    defaults.update(kwargs)
    s = BasicMarketMakingStrategy(**defaults)
    # Reset refresh timer so orders generate immediately
    s._last_refresh_time = 0.0
    return s


# ---------------------------------------------------------------------------
# Order generation
# ---------------------------------------------------------------------------


class TestOrderGeneration:
    def test_generates_bid_and_ask_signals(self):
        s = _make_strategy()
        signals = s._generate_orders(50000.0)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        assert len(bids) > 0
        assert len(asks) > 0

    def test_correct_number_of_levels(self):
        s = _make_strategy(order_levels=5)
        signals = s._generate_orders(50000.0)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        assert len(bids) == 5
        assert len(asks) == 5

    def test_bid_prices_decrease_with_level(self):
        s = _make_strategy(order_levels=3)
        signals = s._generate_orders(50000.0)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        bid_prices = [sig.price for sig in bids]
        for i in range(len(bid_prices) - 1):
            assert bid_prices[i] > bid_prices[i + 1]

    def test_ask_prices_increase_with_level(self):
        s = _make_strategy(order_levels=3)
        signals = s._generate_orders(50000.0)
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        ask_prices = [sig.price for sig in asks]
        for i in range(len(ask_prices) - 1):
            assert ask_prices[i] < ask_prices[i + 1]

    def test_bid_price_formula(self):
        s = _make_strategy(bid_spread=0.01, order_levels=3)
        mid = 1000.0
        signals = s._generate_orders(mid)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        for i, sig in enumerate(bids):
            expected = mid * (1.0 - 0.01 * (i + 1))
            assert sig.price == pytest.approx(expected)

    def test_ask_price_formula(self):
        s = _make_strategy(ask_spread=0.01, order_levels=3)
        mid = 1000.0
        signals = s._generate_orders(mid)
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        for i, sig in enumerate(asks):
            expected = mid * (1.0 + 0.01 * (i + 1))
            assert sig.price == pytest.approx(expected)

    def test_all_signals_have_correct_symbol(self):
        s = _make_strategy(symbol="ETH/USDT")
        signals = s._generate_orders(3000.0)
        for sig in signals:
            assert sig.symbol == "ETH/USDT"

    def test_no_signals_for_zero_mid_price(self):
        s = _make_strategy()
        signals = s._generate_orders(0.0)
        assert signals == []

    def test_no_signals_for_negative_mid_price(self):
        s = _make_strategy()
        signals = s._generate_orders(-100.0)
        assert signals == []


# ---------------------------------------------------------------------------
# Signal metadata
# ---------------------------------------------------------------------------


class TestSignalMetadata:
    def test_metadata_contains_required_fields(self):
        s = _make_strategy()
        signals = s._generate_orders(50000.0)
        for sig in signals:
            assert sig.metadata is not None
            assert "level" in sig.metadata
            assert "side" in sig.metadata
            assert "mid_price" in sig.metadata
            assert "inventory" in sig.metadata

    def test_bid_metadata_side(self):
        s = _make_strategy()
        signals = s._generate_orders(50000.0)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        for sig in bids:
            assert sig.metadata["side"] == "bid"

    def test_ask_metadata_side(self):
        s = _make_strategy()
        signals = s._generate_orders(50000.0)
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        for sig in asks:
            assert sig.metadata["side"] == "ask"

    def test_metadata_mid_price(self):
        s = _make_strategy()
        signals = s._generate_orders(42000.0)
        for sig in signals:
            assert sig.metadata["mid_price"] == 42000.0


# ---------------------------------------------------------------------------
# Inventory skew
# ---------------------------------------------------------------------------


class TestInventorySkew:
    def test_no_skew_symmetric_sizes(self):
        s = _make_strategy(inventory_skew=0.0, order_amount=1.0)
        s._inventory = 5.0
        bid_size, ask_size = s._compute_skewed_sizes()
        assert bid_size == pytest.approx(1.0)
        assert ask_size == pytest.approx(1.0)

    def test_long_inventory_reduces_bid_increases_ask(self):
        s = _make_strategy(inventory_skew=0.5, order_amount=1.0)
        s._inventory = 1.0  # normalized = 1.0, skew_factor = 0.5
        bid_size, ask_size = s._compute_skewed_sizes()
        assert bid_size < 1.0
        assert ask_size > 1.0

    def test_short_inventory_increases_bid_reduces_ask(self):
        s = _make_strategy(inventory_skew=0.5, order_amount=1.0)
        s._inventory = -1.0  # normalized = -1.0, skew_factor = -0.5
        bid_size, ask_size = s._compute_skewed_sizes()
        assert bid_size > 1.0
        assert ask_size < 1.0

    def test_full_skew_long_inventory(self):
        s = _make_strategy(inventory_skew=1.0, order_amount=1.0)
        s._inventory = 1.0  # normalized = 1.0, skew_factor = 1.0
        bid_size, ask_size = s._compute_skewed_sizes()
        assert bid_size == pytest.approx(0.0)
        assert ask_size == pytest.approx(2.0)

    def test_skew_factor_clamped(self):
        s = _make_strategy(inventory_skew=1.0, order_amount=1.0)
        s._inventory = 10.0  # normalized = 10.0, but clamped to 1.0
        bid_size, ask_size = s._compute_skewed_sizes()
        assert bid_size >= 0.0
        assert ask_size >= 0.0

    def test_skew_affects_generated_orders(self):
        s = _make_strategy(inventory_skew=0.5, order_amount=2.0, order_levels=1)
        s._inventory = 2.0  # normalized = 1.0, skew_factor = 0.5
        signals = s._generate_orders(50000.0)
        bids = [sig for sig in signals if sig.direction == Direction.LONG]
        asks = [sig for sig in signals if sig.direction == Direction.SHORT]
        assert len(bids) == 1
        assert len(asks) == 1
        assert bids[0].size < asks[0].size


# ---------------------------------------------------------------------------
# Order refresh
# ---------------------------------------------------------------------------


class TestOrderRefresh:
    def test_no_signals_within_refresh_interval(self):
        s = _make_strategy(order_refresh_time=60.0)
        # First call generates
        signals1 = s._generate_orders(50000.0)
        assert len(signals1) > 0
        # Immediate second call should not generate (within refresh interval)
        signals2 = s._generate_orders(50000.0)
        assert signals2 == []

    def test_signals_after_refresh_interval(self):
        s = _make_strategy(order_refresh_time=1.0)
        signals1 = s._generate_orders(50000.0)
        assert len(signals1) > 0
        # Simulate time passing
        s._last_refresh_time = 0.0
        signals2 = s._generate_orders(50000.0)
        assert len(signals2) > 0


# ---------------------------------------------------------------------------
# on_orderbook
# ---------------------------------------------------------------------------


class TestOrderbook:
    def test_generates_signals_from_orderbook(self):
        s = _make_strategy()
        ob = SimpleNamespace(best_bid=49990.0, best_ask=50010.0)
        signals = s.on_orderbook(ob)
        assert len(signals) > 0

    def test_mid_price_from_orderbook(self):
        s = _make_strategy()
        ob = SimpleNamespace(best_bid=100.0, best_ask=200.0)
        signals = s.on_orderbook(ob)
        expected_mid = 150.0
        for sig in signals:
            assert sig.metadata["mid_price"] == pytest.approx(expected_mid)

    def test_orderbook_with_bids_asks_lists(self):
        s = _make_strategy()
        ob = SimpleNamespace(
            bids=[[49990.0, 1.0], [49980.0, 2.0]],
            asks=[[50010.0, 1.0], [50020.0, 2.0]],
        )
        signals = s.on_orderbook(ob)
        assert len(signals) > 0

    def test_empty_orderbook_no_signals(self):
        s = _make_strategy()
        ob = SimpleNamespace()  # no best_bid/best_ask or bids/asks
        signals = s.on_orderbook(ob)
        assert signals == []

    def test_zero_bid_ask_no_signals(self):
        s = _make_strategy()
        ob = SimpleNamespace(best_bid=0.0, best_ask=50010.0)
        signals = s.on_orderbook(ob)
        assert signals == []


# ---------------------------------------------------------------------------
# on_bar
# ---------------------------------------------------------------------------


class TestOnBar:
    def test_generates_signals_from_bar(self):
        s = _make_strategy()
        bar = SimpleNamespace(close=50000.0)
        signals = s.on_bar(bar)
        assert len(signals) > 0

    def test_uses_close_as_mid_price(self):
        s = _make_strategy()
        bar = SimpleNamespace(close=42000.0)
        signals = s.on_bar(bar)
        for sig in signals:
            assert sig.metadata["mid_price"] == pytest.approx(42000.0)

    def test_zero_close_no_signals(self):
        s = _make_strategy()
        bar = SimpleNamespace(close=0.0)
        signals = s.on_bar(bar)
        assert signals == []


# ---------------------------------------------------------------------------
# on_trade
# ---------------------------------------------------------------------------


class TestOnTrade:
    def test_updates_last_trade_price(self):
        s = _make_strategy()
        trade = SimpleNamespace(price=50000.0)
        s.on_trade(trade)
        assert s._last_trade_price == 50000.0

    def test_returns_no_signals(self):
        s = _make_strategy()
        trade = SimpleNamespace(price=50000.0)
        signals = s.on_trade(trade)
        assert signals == []

    def test_ignores_zero_price(self):
        s = _make_strategy()
        trade = SimpleNamespace(price=0.0)
        s.on_trade(trade)
        assert s._last_trade_price is None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidation:
    def test_order_amount_must_be_positive(self):
        with pytest.raises(ValueError, match="order_amount"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=0)

    def test_negative_order_amount(self):
        with pytest.raises(ValueError, match="order_amount"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=-1.0)

    def test_bid_spread_too_small(self):
        with pytest.raises(ValueError, match="bid_spread"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, bid_spread=0.00001)

    def test_bid_spread_too_large(self):
        with pytest.raises(ValueError, match="bid_spread"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, bid_spread=0.2)

    def test_ask_spread_too_small(self):
        with pytest.raises(ValueError, match="ask_spread"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, ask_spread=0.00001)

    def test_ask_spread_too_large(self):
        with pytest.raises(ValueError, match="ask_spread"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, ask_spread=0.2)

    def test_order_levels_too_small(self):
        with pytest.raises(ValueError, match="order_levels"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, order_levels=0)

    def test_order_levels_too_large(self):
        with pytest.raises(ValueError, match="order_levels"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, order_levels=21)

    def test_refresh_time_too_small(self):
        with pytest.raises(ValueError, match="order_refresh_time"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, order_refresh_time=0.5)

    def test_refresh_time_too_large(self):
        with pytest.raises(ValueError, match="order_refresh_time"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, order_refresh_time=4000.0)

    def test_inventory_skew_negative(self):
        with pytest.raises(ValueError, match="inventory_skew"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, inventory_skew=-0.1)

    def test_inventory_skew_too_large(self):
        with pytest.raises(ValueError, match="inventory_skew"):
            BasicMarketMakingStrategy("BTC/USDT", order_amount=1.0, inventory_skew=1.1)
