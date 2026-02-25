"""Tests for Strategy base class, Signal dataclass, and FundingRateArbStrategy migration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy


# ---------------------------------------------------------------------------
# Signal dataclass
# ---------------------------------------------------------------------------


class TestSignal:
    def test_create_minimal(self) -> None:
        sig = Signal(direction=Direction.LONG, symbol="BTC-PERP.BINANCE", size=0.1)
        assert sig.direction == Direction.LONG
        assert sig.symbol == "BTC-PERP.BINANCE"
        assert sig.size == 0.1
        assert sig.price is None
        assert sig.timestamp is None
        assert sig.metadata is None

    def test_create_full(self) -> None:
        ts = datetime(2025, 1, 1, tzinfo=timezone.utc)
        sig = Signal(
            direction=Direction.SHORT,
            symbol="ETH-PERP.BINANCE",
            size=0.5,
            price=3000.0,
            timestamp=ts,
            metadata={"reason": "basis premium"},
        )
        assert sig.direction == Direction.SHORT
        assert sig.price == 3000.0
        assert sig.timestamp == ts
        assert sig.metadata == {"reason": "basis premium"}

    def test_frozen(self) -> None:
        sig = Signal(direction=Direction.FLAT, symbol="BTC", size=0.0)
        with pytest.raises(AttributeError):
            sig.size = 1.0  # type: ignore[misc]

    def test_direction_values(self) -> None:
        assert Direction.LONG == "LONG"
        assert Direction.SHORT == "SHORT"
        assert Direction.FLAT == "FLAT"


# ---------------------------------------------------------------------------
# Strategy ABC
# ---------------------------------------------------------------------------


class TestStrategyABC:
    def test_cannot_instantiate(self) -> None:
        with pytest.raises(TypeError):
            Strategy()  # type: ignore[abstract]

    def test_must_implement_on_bar(self) -> None:
        class Incomplete(Strategy):
            def on_trade(self, trade: Any) -> list[Signal]:
                return []

        with pytest.raises(TypeError):
            Incomplete()  # type: ignore[abstract]

    def test_must_implement_on_trade(self) -> None:
        class Incomplete(Strategy):
            def on_bar(self, bar: Any) -> list[Signal]:
                return []

        with pytest.raises(TypeError):
            Incomplete()  # type: ignore[abstract]

    def test_concrete_subclass(self) -> None:
        class Dummy(Strategy):
            name = "dummy"
            description = "test strategy"
            market_regime = "trending"
            CONFIG_SCHEMA = {
                "type": "object",
                "properties": {
                    "threshold": {"type": "number", "default": 0.5},
                },
            }

            def on_bar(self, bar: Any) -> list[Signal]:
                return [Signal(direction=Direction.LONG, symbol="BTC", size=0.1)]

            def on_trade(self, trade: Any) -> list[Signal]:
                return []

        s = Dummy()
        assert s.name == "dummy"
        assert s.description == "test strategy"
        assert s.market_regime == "trending"

        signals = s.on_bar(None)
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG

        assert s.on_trade(None) == []

    def test_optional_methods_default_empty(self) -> None:
        class Minimal(Strategy):
            def on_bar(self, bar: Any) -> list[Signal]:
                return []

            def on_trade(self, trade: Any) -> list[Signal]:
                return []

        s = Minimal()
        assert s.on_orderbook(None) == []
        assert s.on_funding_rate(None) == []

    def test_optional_methods_overridable(self) -> None:
        class WithOrderbook(Strategy):
            def on_bar(self, bar: Any) -> list[Signal]:
                return []

            def on_trade(self, trade: Any) -> list[Signal]:
                return []

            def on_orderbook(self, orderbook: Any) -> list[Signal]:
                return [Signal(direction=Direction.SHORT, symbol="BTC", size=0.2)]

        s = WithOrderbook()
        signals = s.on_orderbook(None)
        assert len(signals) == 1
        assert signals[0].direction == Direction.SHORT


# ---------------------------------------------------------------------------
# CONFIG_SCHEMA validation
# ---------------------------------------------------------------------------


class TestConfigSchema:
    def test_base_default_empty(self) -> None:
        assert Strategy.CONFIG_SCHEMA == {}

    def test_schema_is_valid_json_schema_structure(self) -> None:
        class WithSchema(Strategy):
            CONFIG_SCHEMA = {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": {
                    "param_a": {
                        "type": "number",
                        "default": 1.0,
                        "minimum": 0.0,
                        "description": "A numeric parameter.",
                    },
                },
            }

            def on_bar(self, bar: Any) -> list[Signal]:
                return []

            def on_trade(self, trade: Any) -> list[Signal]:
                return []

        schema = WithSchema.CONFIG_SCHEMA
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "param_a" in schema["properties"]
        prop = schema["properties"]["param_a"]
        assert prop["type"] == "number"
        assert prop["default"] == 1.0
        assert "description" in prop


# ---------------------------------------------------------------------------
# FundingRateArbStrategy migration
# ---------------------------------------------------------------------------


class TestFundingRateArbStrategyMigration:
    def test_has_config_schema(self) -> None:
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        schema = FundingRateArbStrategy.CONFIG_SCHEMA
        assert isinstance(schema, dict)
        assert schema["type"] == "object"
        assert "properties" in schema

    def test_config_schema_has_all_params(self) -> None:
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        props = FundingRateArbStrategy.CONFIG_SCHEMA["properties"]
        expected_params = [
            "perp_instrument_id",
            "funding_rate_threshold",
            "exit_threshold",
            "position_size_pct",
            "rebalance_interval_bars",
            "stop_loss_pct",
            "take_profit_pct",
            "fast_ema_period",
            "slow_ema_period",
            "funding_periods_per_day",
        ]
        for param in expected_params:
            assert param in props, f"Missing CONFIG_SCHEMA property: {param}"
            assert "description" in props[param], f"Missing description for: {param}"
            assert "default" in props[param], f"Missing default for: {param}"

    def test_has_tino_attributes(self) -> None:
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        assert FundingRateArbStrategy.name == "funding_rate_arb"
        assert len(FundingRateArbStrategy.description) > 0
        assert FundingRateArbStrategy.market_regime in (
            "trending",
            "ranging",
            "neutral",
        )

    def test_config_schema_no_additional_properties(self) -> None:
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        schema = FundingRateArbStrategy.CONFIG_SCHEMA
        assert schema.get("additionalProperties") is False

    def test_config_schema_params_have_constraints(self) -> None:
        from tino_daemon.strategies.funding_rate_arb import FundingRateArbStrategy

        props = FundingRateArbStrategy.CONFIG_SCHEMA["properties"]
        # Numeric params should have min/max constraints
        numeric_params = [
            "funding_rate_threshold",
            "exit_threshold",
            "position_size_pct",
            "stop_loss_pct",
            "take_profit_pct",
        ]
        for param in numeric_params:
            assert "minimum" in props[param], f"Missing minimum for: {param}"
            assert "maximum" in props[param], f"Missing maximum for: {param}"
