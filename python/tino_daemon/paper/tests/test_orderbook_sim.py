"""Tests for OrderbookSimulator — simulated order matching."""

from __future__ import annotations

import pytest

from tino_daemon.paper.orderbook_sim import (
    OrderSide,
    OrderStatus,
    OrderType,
    OrderbookSimulator,
    PaperOrder,
)


class TestOrderSubmission:
    def test_submit_market_order_fills_immediately(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        assert order.status == OrderStatus.FILLED
        assert order.filled_quantity == 1.0
        assert order.filled_price > 0
        assert order.fee > 0

    def test_submit_market_order_without_price_queues(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
        )
        assert order.status == OrderStatus.PENDING
        assert len(sim.open_orders) == 1

    def test_submit_limit_buy_queues_when_price_above(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=0.5,
            price=49000.0,
            current_price=50000.0,
        )
        assert order.status == OrderStatus.PENDING
        assert len(sim.open_orders) == 1

    def test_submit_limit_buy_fills_when_price_at_or_below(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=0.5,
            price=50000.0,
            current_price=49500.0,
        )
        assert order.status == OrderStatus.FILLED
        assert order.filled_price == 50000.0

    def test_submit_limit_sell_queues_when_price_below(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="SELL",
            order_type="LIMIT",
            quantity=0.5,
            price=51000.0,
            current_price=50000.0,
        )
        assert order.status == OrderStatus.PENDING

    def test_submit_limit_sell_fills_when_price_at_or_above(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="SELL",
            order_type="LIMIT",
            quantity=0.5,
            price=50000.0,
            current_price=50500.0,
        )
        assert order.status == OrderStatus.FILLED


class TestPriceUpdates:
    def test_limit_buy_fills_on_price_drop(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=1.0,
            price=49000.0,
            current_price=50000.0,
        )
        assert order.status == OrderStatus.PENDING

        filled = sim.on_price_update("BTCUSDT", 48500.0)
        assert len(filled) == 1
        assert filled[0].id == order.id
        assert order.status == OrderStatus.FILLED

    def test_limit_sell_fills_on_price_rise(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="SELL",
            order_type="LIMIT",
            quantity=1.0,
            price=51000.0,
            current_price=50000.0,
        )
        filled = sim.on_price_update("BTCUSDT", 51500.0)
        assert len(filled) == 1
        assert order.status == OrderStatus.FILLED

    def test_no_fill_on_wrong_instrument(self) -> None:
        sim = OrderbookSimulator()
        sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=1.0,
            price=49000.0,
            current_price=50000.0,
        )
        filled = sim.on_price_update("ETHUSDT", 48000.0)
        assert len(filled) == 0

    def test_queued_market_order_fills_on_next_tick(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
        )
        assert order.status == OrderStatus.PENDING

        filled = sim.on_price_update("BTCUSDT", 50000.0)
        assert len(filled) == 1
        assert order.status == OrderStatus.FILLED


class TestCancellation:
    def test_cancel_pending_order(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=1.0,
            price=49000.0,
            current_price=50000.0,
        )
        assert sim.cancel_order(order.id) is True
        assert order.status == OrderStatus.CANCELLED
        assert len(sim.open_orders) == 0

    def test_cancel_nonexistent_order(self) -> None:
        sim = OrderbookSimulator()
        assert sim.cancel_order("nonexistent") is False

    def test_cancel_all_orders(self) -> None:
        sim = OrderbookSimulator()
        sim.submit_order(instrument="BTCUSDT", side="BUY", order_type="LIMIT", quantity=1.0, price=49000.0, current_price=50000.0)
        sim.submit_order(instrument="ETHUSDT", side="SELL", order_type="LIMIT", quantity=10.0, price=4000.0, current_price=3500.0)
        count = sim.cancel_all()
        assert count == 2
        assert len(sim.open_orders) == 0

    def test_cancel_all_by_instrument(self) -> None:
        sim = OrderbookSimulator()
        sim.submit_order(instrument="BTCUSDT", side="BUY", order_type="LIMIT", quantity=1.0, price=49000.0, current_price=50000.0)
        sim.submit_order(instrument="ETHUSDT", side="SELL", order_type="LIMIT", quantity=10.0, price=4000.0, current_price=3500.0)
        count = sim.cancel_all(instrument="BTCUSDT")
        assert count == 1
        assert len(sim.open_orders) == 1


class TestFees:
    def test_taker_fee_on_market_order(self) -> None:
        sim = OrderbookSimulator(taker_fee=0.0004, maker_fee=0.0002)
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        # Fee = notional * taker_rate = ~50000 * 0.0004 = ~20
        assert order.fee > 19.0
        assert order.fee < 21.0  # Allow slippage

    def test_maker_fee_on_limit_order(self) -> None:
        sim = OrderbookSimulator(taker_fee=0.0004, maker_fee=0.0002)
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=1.0,
            price=50000.0,
            current_price=49500.0,
        )
        # Fee = 50000 * 0.0002 = 10
        assert abs(order.fee - 10.0) < 0.01


class TestSlippage:
    def test_buy_slippage_increases_price(self) -> None:
        sim = OrderbookSimulator(slippage_bps=10.0)  # 10 bps = 0.1%
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        assert order.filled_price > 50000.0

    def test_sell_slippage_decreases_price(self) -> None:
        sim = OrderbookSimulator(slippage_bps=10.0)
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="SELL",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        assert order.filled_price < 50000.0


class TestCallbackAndHistory:
    def test_on_fill_callback(self) -> None:
        fills: list[PaperOrder] = []
        sim = OrderbookSimulator(on_fill=lambda o: fills.append(o))
        sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        assert len(fills) == 1
        assert fills[0].status == OrderStatus.FILLED

    def test_trim_history(self) -> None:
        sim = OrderbookSimulator()
        for i in range(100):
            sim.submit_order(
                instrument="BTCUSDT",
                side="BUY",
                order_type="MARKET",
                quantity=0.001,
                current_price=50000.0 + i,
            )
        assert len(sim.filled_orders) == 100
        sim.trim_history(max_filled=50)
        assert len(sim.filled_orders) == 50

    def test_get_order_lookup(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="LIMIT",
            quantity=1.0,
            price=49000.0,
            current_price=50000.0,
        )
        found = sim.get_order(order.id)
        assert found is not None
        assert found.id == order.id

    def test_order_to_dict(self) -> None:
        sim = OrderbookSimulator()
        order = sim.submit_order(
            instrument="BTCUSDT",
            side="BUY",
            order_type="MARKET",
            quantity=1.0,
            current_price=50000.0,
        )
        d = order.to_dict()
        assert d["instrument"] == "BTCUSDT"
        assert d["side"] == "BUY"
        assert d["type"] == "MARKET"
        assert d["status"] == "FILLED"
