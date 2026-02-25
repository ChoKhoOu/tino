"""Tests for advanced order types (TP/SL, Trailing Stop, Stop Order)."""

from __future__ import annotations

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from tino_daemon.exchanges.base_connector import (
    BaseExchangeConnector,
    StopOrderResult,
    TpSlOrderResult,
    TrailingStopResult,
)
from tino_daemon.exchanges.binance import BinanceConnector
from tino_daemon.exchanges.okx import OKXConnector


# ---------------------------------------------------------------------------
# Dataclass unit tests
# ---------------------------------------------------------------------------


class TestDataclasses:
    def test_tp_sl_order_result_defaults(self):
        r = TpSlOrderResult(order_id="123", success=True, message="ok")
        assert r.tp_order_id == ""
        assert r.sl_order_id == ""

    def test_tp_sl_order_result_full(self):
        r = TpSlOrderResult(
            order_id="123", success=True, message="ok",
            tp_order_id="tp1", sl_order_id="sl1",
        )
        assert r.tp_order_id == "tp1"
        assert r.sl_order_id == "sl1"

    def test_trailing_stop_result(self):
        r = TrailingStopResult(order_id="456", success=True, message="ok")
        assert r.order_id == "456"
        assert r.success is True

    def test_stop_order_result(self):
        r = StopOrderResult(order_id="789", success=False, message="fail")
        assert r.success is False
        assert r.message == "fail"


# ---------------------------------------------------------------------------
# Base connector — default NotImplementedError
# ---------------------------------------------------------------------------


class TestBaseConnectorDefaults:
    @pytest.mark.asyncio
    async def test_place_tp_sl_order_raises(self):
        class Stub(BaseExchangeConnector):
            @property
            def name(self): return "stub"
            async def get_ticker(self, symbol): ...
            async def get_klines(self, symbol, interval="1h", limit=100, start_time=None, end_time=None): ...
            async def get_funding_rate(self, symbol): ...
            async def get_orderbook(self, symbol, limit=20): ...
            async def get_account_balance(self): ...
            async def get_positions(self, symbol=None): ...
            async def place_order(self, symbol, side, order_type, quantity, price=None, **kw): ...
            async def cancel_order(self, symbol, order_id): ...
            async def set_leverage(self, symbol, leverage): ...
            async def set_margin_type(self, symbol, margin_type, leverage=1): ...
            async def get_mark_price(self, symbol): ...
            async def get_funding_rate_history(self, symbol, limit=100): ...

        stub = Stub()
        with pytest.raises(NotImplementedError, match="stub"):
            await stub.place_tp_sl_order("BTCUSDT", "BUY", 1.0, tp_price=70000)

    @pytest.mark.asyncio
    async def test_place_trailing_stop_raises(self):
        class Stub(BaseExchangeConnector):
            @property
            def name(self): return "stub"
            async def get_ticker(self, symbol): ...
            async def get_klines(self, symbol, interval="1h", limit=100, start_time=None, end_time=None): ...
            async def get_funding_rate(self, symbol): ...
            async def get_orderbook(self, symbol, limit=20): ...
            async def get_account_balance(self): ...
            async def get_positions(self, symbol=None): ...
            async def place_order(self, symbol, side, order_type, quantity, price=None, **kw): ...
            async def cancel_order(self, symbol, order_id): ...
            async def set_leverage(self, symbol, leverage): ...
            async def set_margin_type(self, symbol, margin_type, leverage=1): ...
            async def get_mark_price(self, symbol): ...
            async def get_funding_rate_history(self, symbol, limit=100): ...

        stub = Stub()
        with pytest.raises(NotImplementedError, match="stub"):
            await stub.place_trailing_stop("BTCUSDT", "SELL", 1.0, 1.0)

    @pytest.mark.asyncio
    async def test_place_stop_order_raises(self):
        class Stub(BaseExchangeConnector):
            @property
            def name(self): return "stub"
            async def get_ticker(self, symbol): ...
            async def get_klines(self, symbol, interval="1h", limit=100, start_time=None, end_time=None): ...
            async def get_funding_rate(self, symbol): ...
            async def get_orderbook(self, symbol, limit=20): ...
            async def get_account_balance(self): ...
            async def get_positions(self, symbol=None): ...
            async def place_order(self, symbol, side, order_type, quantity, price=None, **kw): ...
            async def cancel_order(self, symbol, order_id): ...
            async def set_leverage(self, symbol, leverage): ...
            async def set_margin_type(self, symbol, margin_type, leverage=1): ...
            async def get_mark_price(self, symbol): ...
            async def get_funding_rate_history(self, symbol, limit=100): ...

        stub = Stub()
        with pytest.raises(NotImplementedError, match="stub"):
            await stub.place_stop_order("BTCUSDT", "SELL", 1.0, 60000.0)


# ---------------------------------------------------------------------------
# Binance connector tests (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBinanceTpSl:
    @pytest.mark.asyncio
    async def test_tp_sl_both_prices(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(side_effect=[
            {"orderId": 100},  # TP order
            {"orderId": 200},  # SL order
        ])

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0, sl_price=60000.0,
        )
        assert result.success is True
        assert result.tp_order_id == "100"
        assert result.sl_order_id == "200"
        assert connector._request.call_count == 2

    @pytest.mark.asyncio
    async def test_tp_only(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 100})

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0,
        )
        assert result.success is True
        assert result.tp_order_id == "100"
        assert result.sl_order_id == ""
        assert connector._request.call_count == 1

    @pytest.mark.asyncio
    async def test_sl_only(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 200})

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, sl_price=60000.0,
        )
        assert result.success is True
        assert result.sl_order_id == "200"
        assert result.tp_order_id == ""

    @pytest.mark.asyncio
    async def test_no_price_returns_error(self):
        connector = BinanceConnector()
        result = await connector.place_tp_sl_order("BTCUSDT", "BUY", 0.1)
        assert result.success is False
        assert "At least one" in result.message

    @pytest.mark.asyncio
    async def test_tp_sl_sell_side_uses_buy_to_close(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 300})

        await connector.place_tp_sl_order(
            "BTCUSDT", "SELL", 0.1, tp_price=50000.0,
        )
        call_args = connector._request.call_args
        params = call_args[1].get("params") or call_args[0][2]
        assert params["side"] == "BUY"

    @pytest.mark.asyncio
    async def test_tp_sl_api_error(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(side_effect=Exception("API down"))

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0,
        )
        assert result.success is False
        assert "API down" in result.message


class TestBinanceTrailingStop:
    @pytest.mark.asyncio
    async def test_trailing_stop_success(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 500})

        result = await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=1.0,
        )
        assert result.success is True
        assert result.order_id == "500"

    @pytest.mark.asyncio
    async def test_trailing_stop_with_activation_price(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 501})

        result = await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=1.5, activation_price=72000.0,
        )
        assert result.success is True
        call_args = connector._request.call_args
        params = call_args[1].get("params") or call_args[0][2]
        assert params["activationPrice"] == "72000.0"
        assert params["callbackRate"] == "1.5"

    @pytest.mark.asyncio
    async def test_trailing_stop_failure(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(side_effect=Exception("timeout"))

        result = await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=1.0,
        )
        assert result.success is False
        assert "timeout" in result.message


class TestBinanceStopOrder:
    @pytest.mark.asyncio
    async def test_stop_market_order(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 600})

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0,
        )
        assert result.success is True
        assert result.order_id == "600"
        call_args = connector._request.call_args
        params = call_args[1].get("params") or call_args[0][2]
        assert params["type"] == "STOP_MARKET"

    @pytest.mark.asyncio
    async def test_stop_limit_order(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(return_value={"orderId": 601})

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0, price=59500.0,
        )
        assert result.success is True
        call_args = connector._request.call_args
        params = call_args[1].get("params") or call_args[0][2]
        assert params["type"] == "STOP"
        assert params["price"] == "59500.0"
        assert params["timeInForce"] == "GTC"

    @pytest.mark.asyncio
    async def test_stop_order_failure(self):
        connector = BinanceConnector()
        connector._request = AsyncMock(side_effect=Exception("rejected"))

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0,
        )
        assert result.success is False


# ---------------------------------------------------------------------------
# OKX connector tests (mocked HTTP)
# ---------------------------------------------------------------------------


class TestOKXTpSl:
    @pytest.mark.asyncio
    async def test_tp_sl_both_prices(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(side_effect=[
            {"data": [{"algoId": "algo-tp"}]},
            {"data": [{"algoId": "algo-sl"}]},
        ])

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0, sl_price=60000.0,
        )
        assert result.success is True
        assert result.tp_order_id == "algo-tp"
        assert result.sl_order_id == "algo-sl"

    @pytest.mark.asyncio
    async def test_tp_only(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(
            return_value={"data": [{"algoId": "algo-tp"}]},
        )

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0,
        )
        assert result.success is True
        assert result.tp_order_id == "algo-tp"
        assert result.sl_order_id == ""

    @pytest.mark.asyncio
    async def test_no_price_returns_error(self):
        connector = OKXConnector()
        result = await connector.place_tp_sl_order("BTCUSDT", "BUY", 0.1)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_tp_sl_api_error(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(side_effect=Exception("OKX error"))

        result = await connector.place_tp_sl_order(
            "BTCUSDT", "BUY", 0.1, tp_price=70000.0,
        )
        assert result.success is False
        assert "OKX error" in result.message


class TestOKXTrailingStop:
    @pytest.mark.asyncio
    async def test_trailing_stop_success(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(
            return_value={"data": [{"algoId": "trail-1"}]},
        )

        result = await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=1.0,
        )
        assert result.success is True
        assert result.order_id == "trail-1"

    @pytest.mark.asyncio
    async def test_trailing_stop_callback_rate_conversion(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(
            return_value={"data": [{"algoId": "trail-2"}]},
        )

        await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=2.0, activation_price=72000.0,
        )
        call_args = connector._signed_request.call_args
        body = call_args[1].get("body") or call_args[0][2]
        # OKX uses decimal ratio: 2.0% -> 0.02
        assert body["callbackRatio"] == "0.02"
        assert body["activePx"] == "72000.0"

    @pytest.mark.asyncio
    async def test_trailing_stop_failure(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(side_effect=Exception("fail"))

        result = await connector.place_trailing_stop(
            "BTCUSDT", "SELL", 0.1, callback_rate=1.0,
        )
        assert result.success is False


class TestOKXStopOrder:
    @pytest.mark.asyncio
    async def test_stop_market_order(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(
            return_value={"data": [{"algoId": "stop-1"}]},
        )

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0,
        )
        assert result.success is True
        assert result.order_id == "stop-1"

    @pytest.mark.asyncio
    async def test_stop_limit_order(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(
            return_value={"data": [{"algoId": "stop-2"}]},
        )

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0, price=59500.0,
        )
        assert result.success is True
        call_args = connector._signed_request.call_args
        body = call_args[1].get("body") or call_args[0][2]
        assert body["slOrdPx"] == "59500.0"

    @pytest.mark.asyncio
    async def test_stop_order_failure(self):
        connector = OKXConnector()
        connector._signed_request = AsyncMock(side_effect=Exception("nope"))

        result = await connector.place_stop_order(
            "BTCUSDT", "SELL", 0.1, stop_price=60000.0,
        )
        assert result.success is False
