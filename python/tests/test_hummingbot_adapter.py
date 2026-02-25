"""Tests for Hummingbot vendor layer and adapter integration."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from tino_daemon.exchanges import get_connector, list_exchanges
from tino_daemon.exchanges.base_connector import (
    Balance,
    FundingRate,
    Kline,
    MarginType,
    Orderbook,
    OrderResult,
    Position,
    Ticker,
)
from tino_daemon.exchanges.hummingbot_adapter import HummingbotAdapter
from tino_daemon.vendors.hummingbot import (
    CONNECTOR_REGISTRY,
    get_hb_connector,
    list_hb_connectors,
)
from tino_daemon.vendors.hummingbot.binance import HBBinanceConnector
from tino_daemon.vendors.hummingbot.connector import (
    HBBalance,
    HBCandle,
    HBFundingInfo,
    HBMarkPrice,
    HBOrderBook,
    HBOrderBookEntry,
    HBOrderResult,
    HBPosition,
    HBTicker,
)


def _mock_response(data: dict | list, status_code: int = 200) -> httpx.Response:
    """Create a mock httpx.Response."""
    return httpx.Response(
        status_code=status_code,
        json=data,
        request=httpx.Request("GET", "https://test.com"),
    )


# ---------------------------------------------------------------------------
# Vendor registry tests
# ---------------------------------------------------------------------------


class TestVendorRegistry:
    def test_list_hb_connectors(self) -> None:
        connectors = list_hb_connectors()
        assert "binance" in connectors

    def test_get_hb_connector_binance(self) -> None:
        connector = get_hb_connector("binance")
        assert isinstance(connector, HBBinanceConnector)
        assert connector.name == "binance"

    def test_get_hb_connector_unsupported(self) -> None:
        with pytest.raises(ValueError, match="No vendored Hummingbot connector"):
            get_hb_connector("nonexistent_exchange")

    def test_registry_contains_binance(self) -> None:
        assert "binance" in CONNECTOR_REGISTRY


# ---------------------------------------------------------------------------
# HBBinanceConnector unit tests
# ---------------------------------------------------------------------------


class TestHBBinanceConnector:
    def test_convert_to_exchange_symbol(self) -> None:
        assert HBBinanceConnector.convert_to_exchange_symbol("BTC-USDT") == "BTCUSDT"
        assert HBBinanceConnector.convert_to_exchange_symbol("BTCUSDT") == "BTCUSDT"
        assert HBBinanceConnector.convert_to_exchange_symbol("ETH-BTC") == "ETHBTC"

    def test_convert_from_exchange_symbol(self) -> None:
        assert HBBinanceConnector.convert_from_exchange_symbol("BTCUSDT") == "BTC-USDT"
        assert HBBinanceConnector.convert_from_exchange_symbol("ETHBTC") == "ETH-BTC"
        assert HBBinanceConnector.convert_from_exchange_symbol("ETHUSDC") == "ETH-USDC"

    def test_is_perpetual(self) -> None:
        assert HBBinanceConnector._is_perpetual("BTCUSDT") is True
        assert HBBinanceConnector._is_perpetual("BTC-USDT") is True
        assert HBBinanceConnector._is_perpetual("ETHBUSD") is True

    @pytest.mark.asyncio
    async def test_get_ticker(self) -> None:
        connector = HBBinanceConnector()
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
        assert ticker.trading_pair == "BTC-USDT"
        assert ticker.last_price == 50000.0
        assert ticker.best_bid == 49999.0
        assert ticker.best_ask == 50001.0
        assert ticker.volume == 12345.67

    @pytest.mark.asyncio
    async def test_get_candles(self) -> None:
        connector = HBBinanceConnector()
        mock_data = [
            [1700000000000, "50000", "51000", "49000", "50500", "100", 1700003600000,
             "0", 0, "0", "0", "0"],
        ]
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        candles = await connector.get_candles("BTCUSDT", interval="1h", limit=1)
        assert len(candles) == 1
        assert candles[0].open == 50000.0
        assert candles[0].close == 50500.0
        assert candles[0].close_timestamp_ms == 1700003600000

    @pytest.mark.asyncio
    async def test_get_funding_info(self) -> None:
        connector = HBBinanceConnector()
        mock_data = {
            "symbol": "BTCUSDT",
            "lastFundingRate": "0.0001",
            "nextFundingTime": 1700010000000,
            "time": 1700000000000,
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        info = await connector.get_funding_info("BTCUSDT")
        assert info.rate == 0.0001
        assert info.trading_pair == "BTC-USDT"

    @pytest.mark.asyncio
    async def test_get_order_book(self) -> None:
        connector = HBBinanceConnector()
        mock_data = {
            "bids": [["50000.00", "1.5"], ["49999.00", "2.0"]],
            "asks": [["50001.00", "1.0"], ["50002.00", "3.0"]],
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        ob = await connector.get_order_book("BTCUSDT", depth=2)
        assert len(ob.bids) == 2
        assert len(ob.asks) == 2
        assert ob.bids[0].price == 50000.0
        assert ob.asks[0].amount == 1.0

    @pytest.mark.asyncio
    async def test_get_balances(self) -> None:
        connector = HBBinanceConnector()
        mock_data = {
            "balances": [
                {"asset": "BTC", "free": "1.0", "locked": "0.5"},
                {"asset": "USDT", "free": "10000.0", "locked": "0.0"},
                {"asset": "ETH", "free": "0.0", "locked": "0.0"},
            ]
        }
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            balances = await connector.get_balances()

        assert len(balances) == 2
        assert balances[0].asset == "BTC"
        assert balances[0].available == 1.0
        assert balances[0].total == 1.5

    @pytest.mark.asyncio
    async def test_get_positions(self) -> None:
        connector = HBBinanceConnector()
        mock_data = [
            {"symbol": "BTCUSDT", "positionAmt": "0.5", "entryPrice": "50000",
             "unRealizedProfit": "250.0", "leverage": "10",
             "markPrice": "50500", "liquidationPrice": "45000",
             "marginType": "cross"},
            {"symbol": "ETHUSDT", "positionAmt": "0", "entryPrice": "0",
             "unRealizedProfit": "0", "leverage": "1"},
        ]
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            positions = await connector.get_positions()

        assert len(positions) == 1
        assert positions[0].trading_pair == "BTC-USDT"
        assert positions[0].side == "LONG"
        assert positions[0].amount == 0.5

    @pytest.mark.asyncio
    async def test_place_order_success(self) -> None:
        connector = HBBinanceConnector()
        mock_data = {"orderId": 12345, "status": "NEW"}
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.place_order(
                "BTCUSDT", side="BUY", order_type="MARKET", amount=0.001,
            )

        assert result.success is True
        assert result.exchange_order_id == "12345"

    @pytest.mark.asyncio
    async def test_place_order_failure(self) -> None:
        connector = HBBinanceConnector()
        error_response = httpx.Response(
            status_code=400,
            json={"code": -1013, "msg": "Invalid quantity"},
            request=httpx.Request("POST", "https://test.com"),
        )
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(side_effect=httpx.HTTPStatusError(
            "Bad Request", request=error_response.request, response=error_response,
        ))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.place_order(
                "BTCUSDT", side="BUY", order_type="MARKET", amount=0.001,
            )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_cancel_order_success(self) -> None:
        connector = HBBinanceConnector()
        mock_data = {"orderId": 12345, "status": "CANCELED"}
        connector._client = AsyncMock()
        connector._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await connector.cancel_order("BTCUSDT", "12345")

        assert result.success is True

    def test_missing_credentials_raises(self) -> None:
        connector = HBBinanceConnector()
        env = {k: v for k, v in os.environ.items()
               if k not in ("BINANCE_API_KEY", "BINANCE_API_SECRET")}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="BINANCE_API_KEY"):
                connector._get_api_keys()

    def test_generate_signature(self) -> None:
        connector = HBBinanceConnector()
        sig = connector._generate_signature({"foo": "bar"}, "secret")
        assert isinstance(sig, str)
        assert len(sig) == 64  # SHA256 hex digest


# ---------------------------------------------------------------------------
# HummingbotAdapter tests (integration with registry)
# ---------------------------------------------------------------------------


class TestHummingbotAdapter:
    def test_adapter_name(self) -> None:
        adapter = HummingbotAdapter("binance")
        assert adapter.name == "hb-binance"

    def test_adapter_is_base_connector(self) -> None:
        from tino_daemon.exchanges.base_connector import BaseExchangeConnector
        adapter = HummingbotAdapter("binance")
        assert isinstance(adapter, BaseExchangeConnector)

    @pytest.mark.asyncio
    async def test_adapter_get_ticker(self) -> None:
        adapter = HummingbotAdapter("binance")
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
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        ticker = await adapter.get_ticker("BTCUSDT")
        assert isinstance(ticker, Ticker)
        assert ticker.symbol == "BTCUSDT"
        assert ticker.last_price == 50000.0
        assert ticker.bid_price == 49999.0

    @pytest.mark.asyncio
    async def test_adapter_get_klines(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = [
            [1700000000000, "50000", "51000", "49000", "50500", "100", 1700003600000,
             "0", 0, "0", "0", "0"],
        ]
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        klines = await adapter.get_klines("BTCUSDT", interval="1h", limit=1)
        assert len(klines) == 1
        assert isinstance(klines[0], Kline)
        assert klines[0].open == 50000.0

    @pytest.mark.asyncio
    async def test_adapter_get_funding_rate(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = {
            "symbol": "BTCUSDT",
            "lastFundingRate": "0.0001",
            "nextFundingTime": 1700010000000,
            "time": 1700000000000,
        }
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        fr = await adapter.get_funding_rate("BTCUSDT")
        assert isinstance(fr, FundingRate)
        assert fr.funding_rate == 0.0001

    @pytest.mark.asyncio
    async def test_adapter_get_orderbook(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = {
            "bids": [["50000.00", "1.5"]],
            "asks": [["50001.00", "1.0"]],
        }
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        ob = await adapter.get_orderbook("BTCUSDT", limit=1)
        assert isinstance(ob, Orderbook)
        assert len(ob.bids) == 1
        assert ob.bids[0].price == 50000.0

    @pytest.mark.asyncio
    async def test_adapter_get_account_balance(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = {
            "balances": [
                {"asset": "BTC", "free": "1.0", "locked": "0.5"},
            ]
        }
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            balances = await adapter.get_account_balance()

        assert len(balances) == 1
        assert isinstance(balances[0], Balance)
        assert balances[0].asset == "BTC"
        assert balances[0].free == 1.0
        assert balances[0].locked == 0.5
        assert balances[0].total == 1.5

    @pytest.mark.asyncio
    async def test_adapter_get_positions(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = [
            {"symbol": "BTCUSDT", "positionAmt": "0.5", "entryPrice": "50000",
             "unRealizedProfit": "250.0", "leverage": "10",
             "markPrice": "50500", "liquidationPrice": "45000",
             "marginType": "isolated"},
        ]
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            positions = await adapter.get_positions()

        assert len(positions) == 1
        assert isinstance(positions[0], Position)
        assert positions[0].side == "LONG"
        assert positions[0].margin_type == MarginType.ISOLATED

    @pytest.mark.asyncio
    async def test_adapter_place_order(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = {"orderId": 99999, "status": "NEW"}
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await adapter.place_order(
                symbol="BTCUSDT", side="BUY", order_type="MARKET", quantity=0.001,
            )

        assert isinstance(result, OrderResult)
        assert result.success is True
        assert result.order_id == "99999"

    @pytest.mark.asyncio
    async def test_adapter_cancel_order(self) -> None:
        adapter = HummingbotAdapter("binance")
        mock_data = {"orderId": 99999, "status": "CANCELED"}
        adapter._hb._client = AsyncMock()
        adapter._hb._client.request = AsyncMock(return_value=_mock_response(mock_data))

        with patch.dict(os.environ, {"BINANCE_API_KEY": "k", "BINANCE_API_SECRET": "s"}):
            result = await adapter.cancel_order(symbol="BTCUSDT", order_id="99999")

        assert isinstance(result, OrderResult)
        assert result.success is True


# ---------------------------------------------------------------------------
# Exchange registry integration tests
# ---------------------------------------------------------------------------


class TestRegistryIntegration:
    def test_list_exchanges_includes_hb(self) -> None:
        exchanges = list_exchanges()
        assert "hb-binance" in exchanges
        # Native connectors still present
        assert "binance" in exchanges
        assert "okx" in exchanges

    def test_get_connector_hb_binance(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("hb-binance")
        assert isinstance(connector, HummingbotAdapter)
        assert connector.name == "hb-binance"

    def test_get_connector_hb_caches(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        c1 = get_connector("hb-binance")
        c2 = get_connector("hb-binance")
        assert c1 is c2

    def test_get_connector_hb_unknown_raises(self) -> None:
        with pytest.raises(ValueError, match="Unsupported exchange"):
            get_connector("hb-nonexistent")

    def test_native_connectors_still_work(self) -> None:
        from tino_daemon import exchanges
        exchanges._INSTANCES.clear()
        connector = get_connector("binance")
        from tino_daemon.exchanges.binance import BinanceConnector
        assert isinstance(connector, BinanceConnector)
