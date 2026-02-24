"""Tests for ExchangeService gRPC servicer."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import grpc
import pytest

from tino_daemon.exchanges.base_connector import (
    FundingRate,
    Kline,
    Orderbook,
    OrderbookLevel,
    OrderResult,
    Ticker,
)
from tino_daemon.proto.tino.exchange.v1 import exchange_pb2
from tino_daemon.services.exchange import ExchangeServiceServicer


class FakeContext:
    """Minimal gRPC context mock."""

    def __init__(self) -> None:
        self._code = grpc.StatusCode.OK
        self._details = ""

    def set_code(self, code: grpc.StatusCode) -> None:
        self._code = code

    def set_details(self, details: str) -> None:
        self._details = details


def _make_ticker() -> Ticker:
    return Ticker(
        symbol="BTCUSDT",
        last_price=50000.0,
        bid_price=49999.0,
        ask_price=50001.0,
        volume_24h=12345.0,
        high_24h=51000.0,
        low_24h=49000.0,
        timestamp="1700000000000",
    )


def _make_klines() -> list[Kline]:
    return [
        Kline(
            open_time=1700000000000,
            open=50000.0,
            high=51000.0,
            low=49000.0,
            close=50500.0,
            volume=100.0,
            close_time=1700003600000,
        ),
    ]


def _make_funding_rate() -> FundingRate:
    return FundingRate(
        symbol="BTCUSDT",
        funding_rate=0.0001,
        next_funding_time="1700010000000",
        timestamp="1700000000000",
    )


def _make_orderbook() -> Orderbook:
    return Orderbook(
        bids=[OrderbookLevel(price=50000.0, quantity=1.5)],
        asks=[OrderbookLevel(price=50001.0, quantity=1.0)],
        timestamp="1700000000000",
    )


class TestExchangeServiceGetTicker:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_ticker = AsyncMock(return_value=_make_ticker())

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetTickerRequest(exchange="binance", symbol="BTCUSDT")
            resp = await servicer.GetTicker(request, ctx)

        assert resp.symbol == "BTCUSDT"
        assert resp.last_price == 50000.0
        assert resp.bid_price == 49999.0

    @pytest.mark.asyncio
    async def test_unsupported_exchange(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        request = exchange_pb2.GetTickerRequest(exchange="unknown", symbol="BTCUSDT")
        resp = await servicer.GetTicker(request, ctx)

        assert ctx._code == grpc.StatusCode.INTERNAL


class TestExchangeServiceGetKlines:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_klines = AsyncMock(return_value=_make_klines())

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetKlinesRequest(
                exchange="binance", symbol="BTCUSDT", interval="1h", limit=1
            )
            resp = await servicer.GetKlines(request, ctx)

        assert len(resp.klines) == 1
        assert resp.klines[0].open == 50000.0


class TestExchangeServiceGetFundingRate:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_funding_rate = AsyncMock(return_value=_make_funding_rate())

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetFundingRateRequest(exchange="binance", symbol="BTCUSDT")
            resp = await servicer.GetFundingRate(request, ctx)

        assert resp.funding_rate == 0.0001


class TestExchangeServiceGetOrderbook:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_orderbook = AsyncMock(return_value=_make_orderbook())

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetOrderbookRequest(
                exchange="binance", symbol="BTCUSDT", limit=1
            )
            resp = await servicer.GetOrderbook(request, ctx)

        assert len(resp.bids) == 1
        assert resp.bids[0].price == 50000.0
        assert len(resp.asks) == 1


class TestExchangeServicePlaceOrder:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.place_order = AsyncMock(
            return_value=OrderResult(order_id="12345", success=True, message="OK")
        )

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.PlaceOrderRequest(
                exchange="binance", symbol="BTCUSDT", side="BUY",
                order_type="MARKET", quantity=0.001,
            )
            resp = await servicer.PlaceOrder(request, ctx)

        assert resp.success is True
        assert resp.order_id == "12345"

    @pytest.mark.asyncio
    async def test_not_implemented(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.place_order = AsyncMock(
            side_effect=NotImplementedError("not yet")
        )

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.PlaceOrderRequest(
                exchange="okx", symbol="BTCUSDT", side="BUY",
                order_type="MARKET", quantity=0.001,
            )
            resp = await servicer.PlaceOrder(request, ctx)

        assert resp.success is False
        assert ctx._code == grpc.StatusCode.UNIMPLEMENTED


class TestExchangeServiceCancelOrder:
    @pytest.mark.asyncio
    async def test_success(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.cancel_order = AsyncMock(
            return_value=OrderResult(order_id="12345", success=True, message="OK")
        )

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.CancelExchangeOrderRequest(
                exchange="binance", symbol="BTCUSDT", order_id="12345",
            )
            resp = await servicer.CancelExchangeOrder(request, ctx)

        assert resp.success is True


class TestExchangeServiceAccountBalance:
    @pytest.mark.asyncio
    async def test_not_implemented(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_account_balance = AsyncMock(
            side_effect=NotImplementedError("not yet")
        )

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetAccountBalanceRequest(exchange="okx")
            resp = await servicer.GetAccountBalance(request, ctx)

        assert ctx._code == grpc.StatusCode.UNIMPLEMENTED


class TestExchangeServicePositions:
    @pytest.mark.asyncio
    async def test_not_implemented(self) -> None:
        servicer = ExchangeServiceServicer()
        ctx = FakeContext()

        mock_connector = AsyncMock()
        mock_connector.get_positions = AsyncMock(
            side_effect=NotImplementedError("not yet")
        )

        with patch("tino_daemon.services.exchange.get_connector", return_value=mock_connector):
            request = exchange_pb2.GetExchangePositionsRequest(exchange="bybit")
            resp = await servicer.GetExchangePositions(request, ctx)

        assert ctx._code == grpc.StatusCode.UNIMPLEMENTED
