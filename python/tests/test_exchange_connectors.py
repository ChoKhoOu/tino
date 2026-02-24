"""Tests for exchange connectors — BaseExchangeConnector, Binance, OKX, Bybit."""

from __future__ import annotations

import json
import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from tino_daemon.exchanges import get_connector, list_exchanges
from tino_daemon.exchanges.base_connector import (
    Balance,
    BaseExchangeConnector,
    FundingRate,
    Kline,
    Orderbook,
    OrderbookLevel,
    OrderResult,
    Position,
    Ticker,
)
from tino_daemon.exchanges.binance import BinanceConnector
from tino_daemon.exchanges.bybit import BybitConnector
from tino_daemon.exchanges.okx import OKXConnector
from tino_daemon.exchanges.rate_limiter import RateLimiter


# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------


class TestExchangeRegistry:
    def test_list_exchanges(self) -> None:
        exchanges = list_exchanges()
        assert "binance" in exchanges
        assert "okx" in exchanges
        assert "bybit" in exchanges

    def test_get_connector_binance(self) -> None:
        # Clear cached instances to avoid cross-test contamination
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("binance")
        assert isinstance(connector, BinanceConnector)
        assert connector.name == "binance"

    def test_get_connector_okx(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("okx")
        assert isinstance(connector, OKXConnector)

    def test_get_connector_bybit(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("bybit")
        assert isinstance(connector, BybitConnector)

    def test_get_connector_case_insensitive(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("BINANCE")
        assert isinstance(connector, BinanceConnector)

    def test_get_connector_unsupported_raises(self) -> None:
        with pytest.raises(ValueError, match="Unsupported exchange"):
            get_connector("unknown_exchange")

    def test_get_connector_caches_instance(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        c1 = get_connector("binance")
        c2 = get_connector("binance")
        assert c1 is c2


# ---------------------------------------------------------------------------
# Data model tests
# ---------------------------------------------------------------------------


class TestDataModels:
    def test_ticker_frozen(self) -> None:
        t = Ticker(
            symbol="BTCUSDT",
            last_price=50000.0,
            bid_price=49999.0,
            ask_price=50001.0,
            volume_24h=1000.0,
            high_24h=51000.0,
            low_24h=49000.0,
            timestamp="1700000000000",
        )
        assert t.symbol == "BTCUSDT"
        assert t.last_price == 50000.0
        with pytest.raises(AttributeError):
            t.symbol = "ETHUSDT"  # type: ignore[misc]

    def test_kline(self) -> None:
        k = Kline(
            open_time=1700000000000,
            open=50000.0,
            high=51000.0,
            low=49000.0,
            close=50500.0,
            volume=100.0,
            close_time=1700003600000,
        )
        assert k.open == 50000.0
        assert k.close_time > k.open_time

    def test_orderbook_level(self) -> None:
        level = OrderbookLevel(price=50000.0, quantity=1.5)
        assert level.price == 50000.0

    def test_order_result(self) -> None:
        r = OrderResult(order_id="12345", success=True, message="OK")
        assert r.success is True


# ---------------------------------------------------------------------------
# Rate limiter tests
# ---------------------------------------------------------------------------


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_acquire_within_limit(self) -> None:
        rl = RateLimiter(max_calls=5, window_seconds=1.0)
        for _ in range(5):
            await rl.acquire()

    @pytest.mark.asyncio
    async def test_acquire_respects_limit(self) -> None:
        rl = RateLimiter(max_calls=2, window_seconds=0.1)
        await rl.acquire()
        await rl.acquire()
        # Third call should still succeed (after brief wait)
        await rl.acquire()


# ---------------------------------------------------------------------------
# Binance connector tests (mocked HTTP)
# ---------------------------------------------------------------------------


def _mock_response(data: dict | list, status_code: int = 200) -> httpx.Response:
    """Create a mock httpx.Response."""
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", "https://test.com"),
    )


class TestBinanceConnector:
    @pytest.mark.asyncio
    async def test_get_ticker(self) -> None:
        connector = BinanceConnector()
        mock_data = {
            "symbol": "BTCUSDT",
            "lastPrice": "50000.00",
            "bidPrice": "49999.00",
            "askPrice": "50001.00",
            "volume": "12345.67",
            "highPrice": "51000.00",
            "lowPrice": "49000.00",
            "closeTime": 1700000000000,
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        ticker = await connector.get_ticker("BTCUSDT")
        assert ticker.symbol == "BTCUSDT"
        assert ticker.last_price == 50000.0
        assert ticker.bid_price == 49999.0
        assert ticker.ask_price == 50001.0
        assert ticker.volume_24h == 12345.67

    @pytest.mark.asyncio
    async def test_get_klines(self) -> None:
        connector = BinanceConnector()
        mock_data = [
            [1700000000000, "50000", "51000", "49000", "50500", "100", 1700003600000,
             "0", 0, "0", "0", "0"],
            [1700003600000, "50500", "52000", "50000", "51500", "200", 1700007200000,
             "0", 0, "0", "0", "0"],
        ]
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        klines = await connector.get_klines("BTCUSDT", interval="1h", limit=2)
        assert len(klines) == 2
        assert klines[0].open == 50000.0
        assert klines[0].close == 50500.0
        assert klines[1].volume == 200.0

    @pytest.mark.asyncio
    async def test_get_funding_rate(self) -> None:
        connector = BinanceConnector()
        mock_data = {
            "symbol": "BTCUSDT",
            "lastFundingRate": "0.0001",
            "nextFundingTime": 1700010000000,
            "time": 1700000000000,
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        fr = await connector.get_funding_rate("BTCUSDT")
        assert fr.symbol == "BTCUSDT"
        assert fr.funding_rate == 0.0001

    @pytest.mark.asyncio
    async def test_get_orderbook(self) -> None:
        connector = BinanceConnector()
        mock_data = {
            "bids": [["50000.00", "1.5"], ["49999.00", "2.0"]],
            "asks": [["50001.00", "1.0"], ["50002.00", "3.0"]],
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        ob = await connector.get_orderbook("BTCUSDT", limit=2)
        assert len(ob.bids) == 2
        assert len(ob.asks) == 2
        assert ob.bids[0].price == 50000.0
        assert ob.asks[0].quantity == 1.0

    @pytest.mark.asyncio
    async def test_get_account_balance(self) -> None:
        connector = BinanceConnector()
        mock_data = {
            "balances": [
                {"asset": "BTC", "free": "1.0", "locked": "0.5"},
                {"asset": "USDT", "free": "10000.0", "locked": "0.0"},
                {"asset": "ETH", "free": "0.0", "locked": "0.0"},  # zero balance, filtered
            ]
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            balances = await connector.get_account_balance()

        assert len(balances) == 2
        assert balances[0].asset == "BTC"
        assert balances[0].total == 1.5

    @pytest.mark.asyncio
    async def test_get_positions(self) -> None:
        connector = BinanceConnector()
        mock_data = [
            {"symbol": "BTCUSDT", "positionAmt": "0.5", "entryPrice": "50000",
             "unRealizedProfit": "250.0", "leverage": "10"},
            {"symbol": "ETHUSDT", "positionAmt": "0", "entryPrice": "0",
             "unRealizedProfit": "0", "leverage": "1"},  # zero position, filtered
        ]
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            positions = await connector.get_positions()

        assert len(positions) == 1
        assert positions[0].symbol == "BTCUSDT"
        assert positions[0].side == "LONG"
        assert positions[0].quantity == 0.5

    @pytest.mark.asyncio
    async def test_place_order_success(self) -> None:
        connector = BinanceConnector()
        mock_data = {"orderId": 12345, "status": "NEW"}
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.place_order(
                symbol="BTCUSDT", side="BUY", order_type="MARKET", quantity=0.001
            )

        assert result.success is True
        assert result.order_id == "12345"

    @pytest.mark.asyncio
    async def test_place_order_failure(self) -> None:
        connector = BinanceConnector()
        error_response = httpx.Response(
            status_code=400,
            json={"code": -1013, "msg": "Invalid quantity"},
            request=httpx.Request("POST", "https://test.com"),
        )
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(side_effect=httpx.HTTPStatusError(
            "Bad Request", request=error_response.request, response=error_response
        ))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.place_order(
                symbol="BTCUSDT", side="BUY", order_type="MARKET", quantity=0.001
            )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_cancel_order_success(self) -> None:
        connector = BinanceConnector()
        mock_data = {"orderId": 12345, "status": "CANCELED"}
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.cancel_order(symbol="BTCUSDT", order_id="12345")

        assert result.success is True

    def test_missing_credentials_raises(self) -> None:
        connector = BinanceConnector()
        env = {k: v for k, v in os.environ.items()
               if k not in ("BINANCE_API_KEY", "BINANCE_API_SECRET")}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="BINANCE_API_KEY"):
                connector._get_credentials()

    def test_sign_produces_hex(self) -> None:
        connector = BinanceConnector()
        sig = connector._sign({"foo": "bar"}, "secret")
        assert isinstance(sig, str)
        assert len(sig) == 64  # SHA256 hex digest


# ---------------------------------------------------------------------------
# OKX connector tests (mocked HTTP)
# ---------------------------------------------------------------------------


class TestOKXConnector:
    @pytest.mark.asyncio
    async def test_get_ticker(self) -> None:
        connector = OKXConnector()
        mock_data = {
            "code": "0",
            "data": [{
                "instId": "BTC-USDT",
                "last": "50000",
                "bidPx": "49999",
                "askPx": "50001",
                "vol24h": "12345",
                "high24h": "51000",
                "low24h": "49000",
                "ts": "1700000000000",
            }],
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        ticker = await connector.get_ticker("BTCUSDT")
        assert ticker.symbol == "BTC-USDT"
        assert ticker.last_price == 50000.0

    @pytest.mark.asyncio
    async def test_get_klines(self) -> None:
        connector = OKXConnector()
        mock_data = {
            "code": "0",
            "data": [
                ["1700000000000", "50000", "51000", "49000", "50500", "100", "0", "0", "0"],
            ],
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        klines = await connector.get_klines("BTCUSDT", interval="1h", limit=1)
        assert len(klines) == 1
        assert klines[0].open == 50000.0

    @pytest.mark.asyncio
    async def test_get_funding_rate(self) -> None:
        connector = OKXConnector()
        mock_data = {
            "code": "0",
            "data": [{
                "instId": "BTC-USDT-SWAP",
                "fundingRate": "0.0001",
                "nextFundingTime": "1700010000000",
                "fundingTime": "1700000000000",
            }],
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        fr = await connector.get_funding_rate("BTCUSDT")
        assert fr.funding_rate == 0.0001
        assert "SWAP" in fr.symbol

    @pytest.mark.asyncio
    async def test_get_orderbook(self) -> None:
        connector = OKXConnector()
        mock_data = {
            "code": "0",
            "data": [{
                "bids": [["50000", "1.5", "0", "1"]],
                "asks": [["50001", "1.0", "0", "1"]],
                "ts": "1700000000000",
            }],
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        ob = await connector.get_orderbook("BTCUSDT", limit=1)
        assert len(ob.bids) == 1
        assert ob.bids[0].price == 50000.0

    @pytest.mark.asyncio
    async def test_place_order_not_implemented(self) -> None:
        connector = OKXConnector()
        with pytest.raises(NotImplementedError):
            await connector.place_order("BTCUSDT", "BUY", "MARKET", 0.001)

    @pytest.mark.asyncio
    async def test_cancel_order_not_implemented(self) -> None:
        connector = OKXConnector()
        with pytest.raises(NotImplementedError):
            await connector.cancel_order("BTCUSDT", "12345")

    @pytest.mark.asyncio
    async def test_get_account_balance_not_implemented(self) -> None:
        connector = OKXConnector()
        with pytest.raises(NotImplementedError):
            await connector.get_account_balance()

    @pytest.mark.asyncio
    async def test_get_positions_not_implemented(self) -> None:
        connector = OKXConnector()
        with pytest.raises(NotImplementedError):
            await connector.get_positions()

    def test_to_inst_id_conversion(self) -> None:
        assert OKXConnector._to_inst_id("BTCUSDT") == "BTC-USDT"
        assert OKXConnector._to_inst_id("ETHUSDT") == "ETH-USDT"
        assert OKXConnector._to_inst_id("BTC-USDT") == "BTC-USDT"
        assert OKXConnector._to_inst_id("ETHBTC") == "ETH-BTC"


# ---------------------------------------------------------------------------
# Bybit connector tests (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBybitConnector:
    @pytest.mark.asyncio
    async def test_get_ticker(self) -> None:
        connector = BybitConnector()
        mock_data = {
            "retCode": 0,
            "result": {
                "list": [{
                    "symbol": "BTCUSDT",
                    "lastPrice": "50000",
                    "bid1Price": "49999",
                    "ask1Price": "50001",
                    "volume24h": "12345",
                    "highPrice24h": "51000",
                    "lowPrice24h": "49000",
                }],
                "time": "1700000000000",
            },
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        ticker = await connector.get_ticker("BTCUSDT")
        assert ticker.symbol == "BTCUSDT"
        assert ticker.last_price == 50000.0

    @pytest.mark.asyncio
    async def test_get_klines(self) -> None:
        connector = BybitConnector()
        mock_data = {
            "retCode": 0,
            "result": {
                "list": [
                    ["1700003600000", "50500", "52000", "50000", "51500", "200"],
                    ["1700000000000", "50000", "51000", "49000", "50500", "100"],
                ],
            },
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        klines = await connector.get_klines("BTCUSDT", interval="1h", limit=2)
        assert len(klines) == 2
        # Should be reversed to chronological order
        assert klines[0].open == 50000.0
        assert klines[1].open == 50500.0

    @pytest.mark.asyncio
    async def test_get_funding_rate(self) -> None:
        connector = BybitConnector()
        mock_data = {
            "retCode": 0,
            "result": {
                "list": [{
                    "symbol": "BTCUSDT",
                    "fundingRate": "0.0001",
                    "nextFundingTime": "1700010000000",
                }],
                "time": "1700000000000",
            },
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        fr = await connector.get_funding_rate("BTCUSDT")
        assert fr.funding_rate == 0.0001

    @pytest.mark.asyncio
    async def test_get_orderbook(self) -> None:
        connector = BybitConnector()
        mock_data = {
            "retCode": 0,
            "result": {
                "b": [["50000", "1.5"]],
                "a": [["50001", "1.0"]],
                "ts": "1700000000000",
            },
        }
        connector._client = AsyncMock()
        connector._client.get = AsyncMock(return_value=_mock_response(mock_data))

        ob = await connector.get_orderbook("BTCUSDT", limit=1)
        assert len(ob.bids) == 1
        assert ob.asks[0].price == 50001.0

    @pytest.mark.asyncio
    async def test_place_order_not_implemented(self) -> None:
        connector = BybitConnector()
        with pytest.raises(NotImplementedError):
            await connector.place_order("BTCUSDT", "BUY", "MARKET", 0.001)

    @pytest.mark.asyncio
    async def test_cancel_order_not_implemented(self) -> None:
        connector = BybitConnector()
        with pytest.raises(NotImplementedError):
            await connector.cancel_order("BTCUSDT", "12345")
