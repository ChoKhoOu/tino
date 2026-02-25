"""Tests for PaperTradingEngine — integration tests with mocked exchange."""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tino_daemon.exchanges.base_connector import FundingRate, Ticker
from tino_daemon.paper.engine import PaperTradingEngine
from tino_daemon.paper.orderbook_sim import OrderStatus


def _make_ticker(symbol: str, price: float) -> Ticker:
    return Ticker(
        symbol=symbol,
        last_price=price,
        bid_price=price - 1,
        ask_price=price + 1,
        volume_24h=1000000.0,
        high_24h=price + 500,
        low_24h=price - 500,
        timestamp="1700000000000",
    )


def _make_funding_rate(symbol: str, rate: float) -> FundingRate:
    return FundingRate(
        symbol=symbol,
        funding_rate=rate,
        next_funding_time="1700028800000",
        timestamp="1700000000000",
    )


class TestEngineLifecycle:
    @pytest.mark.asyncio
    async def test_start_and_stop(self) -> None:
        events: list[dict[str, Any]] = []
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            exchange="binance",
            on_event=lambda e: events.append(e),
        )

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()
            mock.get_ticker = AsyncMock(return_value=_make_ticker("BTCUSDT", 50000.0))
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            assert engine.is_running is True
            assert any(e["type"] == "started" for e in events)

            await asyncio.sleep(0.1)
            await engine.stop()
            assert engine.is_running is False
            assert any(e["type"] == "stopped" for e in events)

    @pytest.mark.asyncio
    async def test_cannot_start_twice(self) -> None:
        engine = PaperTradingEngine(instruments=["BTCUSDT"])

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()
            mock.get_ticker = AsyncMock(return_value=_make_ticker("BTCUSDT", 50000.0))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            with pytest.raises(RuntimeError, match="already running"):
                await engine.start()
            await engine.stop()


class TestEngineOrders:
    @pytest.mark.asyncio
    async def test_submit_market_order(self) -> None:
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            poll_interval=0.05,
        )

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()
            mock.get_ticker = AsyncMock(return_value=_make_ticker("BTCUSDT", 50000.0))
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.1)  # Let a tick run to populate last_prices

            order = engine.submit_order(
                instrument="BTCUSDT",
                side="BUY",
                order_type="MARKET",
                quantity=0.5,
            )
            assert order.status == OrderStatus.FILLED
            assert order.filled_quantity == 0.5

            # Position should be opened
            positions = engine.position_manager.open_positions
            assert len(positions) == 1
            assert positions[0].instrument == "BTCUSDT"
            assert positions[0].side == "LONG"

            await engine.stop()

    @pytest.mark.asyncio
    async def test_submit_and_cancel_limit_order(self) -> None:
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            poll_interval=0.05,
        )

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()
            mock.get_ticker = AsyncMock(return_value=_make_ticker("BTCUSDT", 50000.0))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.1)

            order = engine.submit_order(
                instrument="BTCUSDT",
                side="BUY",
                order_type="LIMIT",
                quantity=1.0,
                price=45000.0,  # Below market
            )
            assert order.status == OrderStatus.PENDING

            assert engine.cancel_order(order.id) is True
            assert len(engine.orderbook_sim.open_orders) == 0

            await engine.stop()

    @pytest.mark.asyncio
    async def test_limit_order_fills_on_price_update(self) -> None:
        events: list[dict[str, Any]] = []
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            poll_interval=0.05,
            on_event=lambda e: events.append(e),
        )

        # First tick at 50000, then stays at 50000, then drops to 44000
        prices = iter([50000.0, 50000.0, 44000.0, 44000.0, 44000.0])

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()

            async def get_ticker_side_effect(symbol: str) -> Ticker:
                price = next(prices, 44000.0)
                return _make_ticker(symbol, price)

            mock.get_ticker = AsyncMock(side_effect=get_ticker_side_effect)
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.1)  # First tick at 50000

            # Submit limit buy well below current price — won't fill at 50000
            order = engine.submit_order(
                instrument="BTCUSDT",
                side="BUY",
                order_type="LIMIT",
                quantity=1.0,
                price=45000.0,
            )
            assert order.status == OrderStatus.PENDING

            # Wait for price to drop to 44000 and order to fill
            await asyncio.sleep(0.3)

            assert order.status == OrderStatus.FILLED
            filled_events = [e for e in events if e["type"] == "order_filled"]
            assert len(filled_events) >= 1

            await engine.stop()


class TestEngineStatus:
    @pytest.mark.asyncio
    async def test_get_status(self) -> None:
        engine = PaperTradingEngine(
            instruments=["BTCUSDT", "ETHUSDT"],
            exchange="binance",
            initial_balance=50_000.0,
        )

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()
            mock.get_ticker = AsyncMock(return_value=_make_ticker("BTCUSDT", 50000.0))
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.1)

            status = engine.get_status()
            assert status["running"] is True
            assert status["instruments"] == ["BTCUSDT", "ETHUSDT"]
            assert status["exchange"] == "binance"
            assert status["balance"]["total"] == 50_000.0
            assert "memory_current_mb" in status
            assert "next_funding" in status

            await engine.stop()


class TestEnginePnLUpdates:
    @pytest.mark.asyncio
    async def test_pnl_updates_on_tick(self) -> None:
        events: list[dict[str, Any]] = []
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            poll_interval=0.05,
            on_event=lambda e: events.append(e),
        )

        prices = iter([50000.0, 52000.0, 52000.0])

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()

            async def get_ticker_side_effect(symbol: str) -> Ticker:
                price = next(prices, 52000.0)
                return _make_ticker(symbol, price)

            mock.get_ticker = AsyncMock(side_effect=get_ticker_side_effect)
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.1)

            # Open a position
            engine.submit_order(
                instrument="BTCUSDT",
                side="BUY",
                order_type="MARKET",
                quantity=1.0,
            )

            # Let PnL updates come through
            await asyncio.sleep(0.2)

            pnl_events = [e for e in events if e["type"] == "pnl_update"]
            assert len(pnl_events) >= 1

            await engine.stop()


class TestEngineErrorResilience:
    @pytest.mark.asyncio
    async def test_continues_on_ticker_error(self) -> None:
        events: list[dict[str, Any]] = []
        engine = PaperTradingEngine(
            instruments=["BTCUSDT"],
            poll_interval=0.05,
            on_event=lambda e: events.append(e),
        )

        call_count = 0

        with patch("tino_daemon.paper.engine.PaperTradingEngine._get_connector") as mock_conn:
            mock = AsyncMock()

            async def flaky_ticker(symbol: str) -> Ticker:
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    raise ConnectionError("Network error")
                return _make_ticker(symbol, 50000.0)

            mock.get_ticker = AsyncMock(side_effect=flaky_ticker)
            mock.get_funding_rate = AsyncMock(return_value=_make_funding_rate("BTCUSDT", 0.0001))
            mock.close = AsyncMock()
            mock_conn.return_value = mock

            await engine.start()
            await asyncio.sleep(0.3)  # Let multiple ticks run

            # Engine should still be running despite the error
            assert engine.is_running is True
            assert engine._tick_count >= 3

            await engine.stop()
