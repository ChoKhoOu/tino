"""Tests for DCAStrategy."""

from __future__ import annotations

from datetime import datetime

import pytest

from tino_daemon.strategies.base import Direction, Signal, Strategy
from tino_daemon.strategies.market_making.dca import DCAStrategy


class TestClassAttributes:
    """Verify strategy class attributes."""

    def test_inherits_strategy(self) -> None:
        assert issubclass(DCAStrategy, Strategy)

    def test_name(self) -> None:
        assert DCAStrategy.name == "dca"

    def test_description(self) -> None:
        assert "dollar cost averaging" in DCAStrategy.description.lower()

    def test_market_regime(self) -> None:
        assert DCAStrategy.market_regime == "neutral"


class TestConfigSchema:
    """Verify CONFIG_SCHEMA completeness."""

    @pytest.fixture()
    def schema(self) -> dict:
        return DCAStrategy.CONFIG_SCHEMA

    def test_has_json_schema_fields(self, schema: dict) -> None:
        assert "$schema" in schema
        assert schema["type"] == "object"

    def test_has_all_properties(self, schema: dict) -> None:
        props = schema["properties"]
        expected = {"interval", "amount", "dip_buy_enabled", "dip_threshold_pct", "dip_multiplier"}
        assert set(props.keys()) == expected

    def test_defaults(self, schema: dict) -> None:
        props = schema["properties"]
        assert props["interval"]["default"] == "daily"
        assert props["dip_buy_enabled"]["default"] is False
        assert props["dip_threshold_pct"]["default"] == 0.05
        assert props["dip_multiplier"]["default"] == 2.0

    def test_interval_enum(self, schema: dict) -> None:
        assert schema["properties"]["interval"]["enum"] == ["daily", "weekly", "monthly"]

    def test_amount_constraints(self, schema: dict) -> None:
        amount = schema["properties"]["amount"]
        assert amount["type"] == "number"
        assert amount["minimum"] == pytest.approx(0.01)

    def test_dip_threshold_constraints(self, schema: dict) -> None:
        prop = schema["properties"]["dip_threshold_pct"]
        assert prop["minimum"] == 0.01
        assert prop["maximum"] == 0.5

    def test_dip_multiplier_constraints(self, schema: dict) -> None:
        prop = schema["properties"]["dip_multiplier"]
        assert prop["minimum"] == 1.0
        assert prop["maximum"] == 10.0

    def test_required_fields(self, schema: dict) -> None:
        assert "amount" in schema["required"]


class TestDCABuys:
    """Verify DCA buys at correct intervals."""

    @staticmethod
    def _bar(price: float, ts: str) -> dict:
        return {"close": price, "timestamp": datetime.fromisoformat(ts)}

    def test_daily_buy(self) -> None:
        strat = DCAStrategy(symbol="BTC-USDT", interval="daily", amount=100.0)
        signals = strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        assert len(signals) == 1
        assert signals[0].direction == Direction.LONG
        assert signals[0].symbol == "BTC-USDT"
        assert signals[0].size == pytest.approx(100.0 / 50000.0)
        assert signals[0].metadata["is_dip_buy"] is False
        assert signals[0].metadata["interval"] == "daily"
        assert signals[0].metadata["period_date"] == "2025-01-01"

    def test_daily_buy_next_day(self) -> None:
        strat = DCAStrategy(interval="daily", amount=100.0)
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        signals = strat.on_bar(self._bar(51000.0, "2025-01-02T10:00:00"))
        assert len(signals) == 1
        assert signals[0].size == pytest.approx(100.0 / 51000.0)

    def test_weekly_buy_on_monday(self) -> None:
        strat = DCAStrategy(interval="weekly", amount=200.0)
        # 2025-01-06 is a Monday
        signals = strat.on_bar(self._bar(40000.0, "2025-01-06T10:00:00"))
        assert len(signals) == 1
        assert signals[0].size == pytest.approx(200.0 / 40000.0)

    def test_weekly_no_buy_on_tuesday(self) -> None:
        strat = DCAStrategy(interval="weekly", amount=200.0)
        # 2025-01-07 is Tuesday
        signals = strat.on_bar(self._bar(40000.0, "2025-01-07T10:00:00"))
        assert signals == []

    def test_monthly_buy_on_first(self) -> None:
        strat = DCAStrategy(interval="monthly", amount=500.0)
        signals = strat.on_bar(self._bar(45000.0, "2025-02-01T10:00:00"))
        assert len(signals) == 1
        assert signals[0].size == pytest.approx(500.0 / 45000.0)

    def test_monthly_no_buy_on_second(self) -> None:
        strat = DCAStrategy(interval="monthly", amount=500.0)
        signals = strat.on_bar(self._bar(45000.0, "2025-02-02T10:00:00"))
        assert signals == []


class TestDipBuy:
    """Verify dip buy triggers correctly."""

    @staticmethod
    def _bar(price: float, ts: str) -> dict:
        return {"close": price, "timestamp": datetime.fromisoformat(ts)}

    def test_dip_buy_triggers_on_drop(self) -> None:
        strat = DCAStrategy(
            amount=100.0,
            dip_buy_enabled=True,
            dip_threshold_pct=0.05,
            dip_multiplier=2.0,
        )
        # Buy on day 1, setting high = 50000
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))

        # Price rises to 52000 (new high tracked)
        strat.on_bar(self._bar(52000.0, "2025-01-02T10:00:00"))

        # Price drops > 5% from 52000 -> 49000 (drop ~5.77%)
        signals = strat.on_bar(self._bar(49000.0, "2025-01-03T10:00:00"))

        # Should have regular buy + dip buy
        dip_signals = [s for s in signals if s.metadata.get("is_dip_buy")]
        assert len(dip_signals) == 1
        dip = dip_signals[0]
        assert dip.direction == Direction.LONG
        assert dip.size == pytest.approx((100.0 * 2.0) / 49000.0)
        assert dip.metadata["is_dip_buy"] is True
        assert dip.metadata["drop_pct"] == pytest.approx((52000.0 - 49000.0) / 52000.0)
        assert dip.metadata["high_price"] == pytest.approx(52000.0)

    def test_no_dip_buy_when_disabled(self) -> None:
        strat = DCAStrategy(amount=100.0, dip_buy_enabled=False)
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        strat.on_bar(self._bar(52000.0, "2025-01-02T10:00:00"))

        # Drop > 5% but dip buy disabled
        signals = strat.on_bar(self._bar(49000.0, "2025-01-03T10:00:00"))
        dip_signals = [s for s in signals if s.metadata and s.metadata.get("is_dip_buy")]
        assert len(dip_signals) == 0

    def test_no_dip_buy_below_threshold(self) -> None:
        strat = DCAStrategy(
            amount=100.0,
            dip_buy_enabled=True,
            dip_threshold_pct=0.10,  # 10% threshold
        )
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        strat.on_bar(self._bar(52000.0, "2025-01-02T10:00:00"))

        # Drop ~5.77% < 10% threshold
        signals = strat.on_bar(self._bar(49000.0, "2025-01-03T10:00:00"))
        dip_signals = [s for s in signals if s.metadata and s.metadata.get("is_dip_buy")]
        assert len(dip_signals) == 0

    def test_dip_buy_custom_multiplier(self) -> None:
        strat = DCAStrategy(
            amount=100.0,
            dip_buy_enabled=True,
            dip_threshold_pct=0.05,
            dip_multiplier=3.0,
        )
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        strat.on_bar(self._bar(52000.0, "2025-01-02T10:00:00"))

        signals = strat.on_bar(self._bar(49000.0, "2025-01-03T10:00:00"))
        dip_signals = [s for s in signals if s.metadata.get("is_dip_buy")]
        assert len(dip_signals) == 1
        assert dip_signals[0].size == pytest.approx((100.0 * 3.0) / 49000.0)


class TestNoDuplicateBuys:
    """Verify no duplicate buys in same period."""

    @staticmethod
    def _bar(price: float, ts: str) -> dict:
        return {"close": price, "timestamp": datetime.fromisoformat(ts)}

    def test_no_duplicate_same_day(self) -> None:
        strat = DCAStrategy(interval="daily", amount=100.0)
        signals1 = strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        signals2 = strat.on_bar(self._bar(50500.0, "2025-01-01T14:00:00"))
        assert len(signals1) == 1
        assert len(signals2) == 0

    def test_no_duplicate_same_week(self) -> None:
        strat = DCAStrategy(interval="weekly", amount=200.0)
        # Monday
        signals1 = strat.on_bar(self._bar(50000.0, "2025-01-06T10:00:00"))
        # Still Monday, later
        signals2 = strat.on_bar(self._bar(50500.0, "2025-01-06T18:00:00"))
        assert len(signals1) == 1
        assert len(signals2) == 0

    def test_no_duplicate_dip_buy_per_cycle(self) -> None:
        strat = DCAStrategy(
            amount=100.0,
            dip_buy_enabled=True,
            dip_threshold_pct=0.05,
            dip_multiplier=2.0,
        )
        strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        strat.on_bar(self._bar(52000.0, "2025-01-02T10:00:00"))

        # First dip buy
        signals1 = strat.on_bar(self._bar(49000.0, "2025-01-03T10:00:00"))
        dip1 = [s for s in signals1 if s.metadata.get("is_dip_buy")]
        assert len(dip1) == 1

        # Further drop — no second dip buy in same cycle
        signals2 = strat.on_bar(self._bar(48000.0, "2025-01-04T10:00:00"))
        dip2 = [s for s in signals2 if s.metadata and s.metadata.get("is_dip_buy")]
        assert len(dip2) == 0


class TestInsufficientData:
    """Verify first bar handling."""

    @staticmethod
    def _bar(price: float, ts: str) -> dict:
        return {"close": price, "timestamp": datetime.fromisoformat(ts)}

    def test_first_bar_daily_generates_signal(self) -> None:
        strat = DCAStrategy(interval="daily", amount=100.0)
        signals = strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        assert len(signals) == 1

    def test_first_bar_weekly_non_monday_no_signal(self) -> None:
        strat = DCAStrategy(interval="weekly", amount=100.0)
        # 2025-01-01 is Wednesday
        signals = strat.on_bar(self._bar(50000.0, "2025-01-01T10:00:00"))
        assert signals == []

    def test_on_trade_returns_empty(self) -> None:
        strat = DCAStrategy(amount=100.0)
        signals = strat.on_trade({"price": 50000.0})
        assert signals == []

    def test_on_trade_updates_high_tracking(self) -> None:
        strat = DCAStrategy(amount=100.0, dip_buy_enabled=True)
        strat.on_trade({"price": 50000.0})
        assert strat._high_since_last_buy == 50000.0
        strat.on_trade({"price": 52000.0})
        assert strat._high_since_last_buy == 52000.0
