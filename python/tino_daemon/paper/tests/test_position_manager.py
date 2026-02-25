"""Tests for PositionManager — virtual position and balance tracking."""

from __future__ import annotations

import pytest

from tino_daemon.paper.orderbook_sim import OrderSide, OrderStatus, OrderType, PaperOrder
from tino_daemon.paper.position_manager import PaperBalance, PaperPosition, PositionManager


def _make_fill(
    *,
    instrument: str = "BTCUSDT",
    side: str = "BUY",
    quantity: float = 1.0,
    price: float = 50000.0,
    fee: float = 20.0,
) -> PaperOrder:
    """Create a filled PaperOrder for testing."""
    return PaperOrder(
        id="test-001",
        instrument=instrument,
        side=OrderSide(side),
        order_type=OrderType.MARKET,
        quantity=quantity,
        price=price,
        status=OrderStatus.FILLED,
        filled_quantity=quantity,
        filled_price=price,
        fee=fee,
    )


class TestOpenPosition:
    def test_open_long_position(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        fill = _make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0)
        pm.apply_fill(fill)

        pos = pm.positions.get("BTCUSDT")
        assert pos is not None
        assert pos.side == "LONG"
        assert pos.quantity == 1.0
        assert pos.avg_price == 50000.0
        assert pm.balance.total == 100_000.0 - 20.0  # fee deducted
        assert pm.balance.total_fees == 20.0

    def test_open_short_position(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        fill = _make_fill(side="SELL", quantity=2.0, price=50000.0, fee=40.0)
        pm.apply_fill(fill)

        pos = pm.positions.get("BTCUSDT")
        assert pos is not None
        assert pos.side == "SHORT"
        assert pos.quantity == 2.0

    def test_increase_long_position_averages_price(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=52000.0, fee=20.8))

        pos = pm.positions["BTCUSDT"]
        assert pos.quantity == 2.0
        assert pos.avg_price == pytest.approx(51000.0)


class TestClosePosition:
    def test_close_long_with_profit(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=55000.0, fee=22.0))

        assert "BTCUSDT" not in pm.positions
        assert pm.balance.realized_pnl == pytest.approx(5000.0)  # (55k - 50k) * 1
        assert pm.balance.total == pytest.approx(100_000.0 - 20.0 - 22.0 + 5000.0)

    def test_close_long_with_loss(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=48000.0, fee=19.2))

        assert "BTCUSDT" not in pm.positions
        assert pm.balance.realized_pnl == pytest.approx(-2000.0)

    def test_close_short_with_profit(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=50000.0, fee=20.0))
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=48000.0, fee=19.2))

        assert "BTCUSDT" not in pm.positions
        assert pm.balance.realized_pnl == pytest.approx(2000.0)  # (50k - 48k) * 1

    def test_partial_close(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=2.0, price=50000.0, fee=40.0))
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=55000.0, fee=22.0))

        pos = pm.positions["BTCUSDT"]
        assert pos.quantity == 1.0
        assert pos.side == "LONG"
        assert pm.balance.realized_pnl == pytest.approx(5000.0)  # (55k - 50k) * 1

    def test_flip_position(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        # Sell 2 units: close 1 long, open 1 short
        pm.apply_fill(_make_fill(side="SELL", quantity=2.0, price=55000.0, fee=44.0))

        pos = pm.positions["BTCUSDT"]
        assert pos.side == "SHORT"
        assert pos.quantity == 1.0
        assert pos.avg_price == 55000.0
        assert pm.balance.realized_pnl == pytest.approx(5000.0)


class TestUnrealizedPnL:
    def test_long_unrealized_pnl(self) -> None:
        pm = PositionManager()
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))

        upnl = pm.update_unrealized_pnl("BTCUSDT", 52000.0)
        assert upnl == pytest.approx(2000.0)

        upnl = pm.update_unrealized_pnl("BTCUSDT", 48000.0)
        assert upnl == pytest.approx(-2000.0)

    def test_short_unrealized_pnl(self) -> None:
        pm = PositionManager()
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=50000.0, fee=20.0))

        upnl = pm.update_unrealized_pnl("BTCUSDT", 48000.0)
        assert upnl == pytest.approx(2000.0)

        upnl = pm.update_unrealized_pnl("BTCUSDT", 52000.0)
        assert upnl == pytest.approx(-2000.0)

    def test_no_position_returns_zero(self) -> None:
        pm = PositionManager()
        assert pm.update_unrealized_pnl("BTCUSDT", 50000.0) == 0.0


class TestFunding:
    def test_long_pays_positive_funding(self) -> None:
        pm = PositionManager()
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))

        payment = pm.apply_funding("BTCUSDT", 0.0001)  # 0.01% rate
        # Long pays: -0.0001 * 50000 * 1 = -5.0
        assert payment == pytest.approx(-5.0)
        assert pm.balance.realized_pnl == pytest.approx(-5.0)

    def test_short_receives_positive_funding(self) -> None:
        pm = PositionManager()
        pm.apply_fill(_make_fill(side="SELL", quantity=1.0, price=50000.0, fee=20.0))

        payment = pm.apply_funding("BTCUSDT", 0.0001)
        # Short receives: +0.0001 * 50000 * 1 = +5.0
        assert payment == pytest.approx(5.0)

    def test_no_position_no_funding(self) -> None:
        pm = PositionManager()
        assert pm.apply_funding("BTCUSDT", 0.0001) == 0.0


class TestAccountSummary:
    def test_summary_with_positions(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pm.update_unrealized_pnl("BTCUSDT", 52000.0)

        summary = pm.get_account_summary()
        assert summary["open_position_count"] == 1
        assert summary["total_position_value"] == pytest.approx(50000.0)
        assert summary["available_balance"] == pytest.approx(100_000.0 - 20.0)

    def test_total_equity(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pm.update_unrealized_pnl("BTCUSDT", 52000.0)

        equity = pm.get_total_equity()
        # balance.total (100000 - 20) + unrealized (2000) = 101980
        assert equity == pytest.approx(101_980.0)

    def test_trim_closed_positions(self) -> None:
        pm = PositionManager()
        for i in range(50):
            pm.apply_fill(_make_fill(side="BUY", quantity=0.01, price=50000.0 + i, fee=0.2))
            pm.apply_fill(_make_fill(side="SELL", quantity=0.01, price=50100.0 + i, fee=0.2))

        assert len(pm._closed_positions) == 50
        pm.trim_history(max_closed=10)
        assert len(pm._closed_positions) == 10

    def test_position_to_dict(self) -> None:
        pm = PositionManager()
        pm.apply_fill(_make_fill(side="BUY", quantity=1.0, price=50000.0, fee=20.0))
        pos = pm.positions["BTCUSDT"]
        d = pos.to_dict()
        assert d["instrument"] == "BTCUSDT"
        assert d["side"] == "LONG"
        assert d["quantity"] == 1.0
        assert d["avg_price"] == 50000.0

    def test_balance_to_dict(self) -> None:
        pm = PositionManager(initial_balance=100_000.0)
        d = pm.balance.to_dict()
        assert d["total"] == 100_000.0
        assert d["available"] == 100_000.0
        assert d["locked"] == 0.0
