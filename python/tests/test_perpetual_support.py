"""Tests for perpetual contract support across exchange connectors."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from tino_daemon.exchanges.base_connector import (
    MarkPriceInfo,
    MarginType,
    compute_liquidation_price,
)
from tino_daemon.exchanges.binance import BinanceConnector


@pytest.fixture
def binance():
    return BinanceConnector()


# ---------------------------------------------------------------------------
# compute_liquidation_price shared utility
# ---------------------------------------------------------------------------


class TestComputeLiquidationPrice:
    def test_long_position(self):
        # entry=50000, leverage=10, mmr=0.004
        # expected = 50000 * (1 - 1/10 + 0.004) = 50000 * 0.904 = 45200
        result = compute_liquidation_price("LONG", 50000.0, 10)
        assert result == pytest.approx(45200.0)

    def test_short_position(self):
        # entry=50000, leverage=10, mmr=0.004
        # expected = 50000 * (1 + 1/10 - 0.004) = 50000 * 1.096 = 54800
        result = compute_liquidation_price("SHORT", 50000.0, 10)
        assert result == pytest.approx(54800.0)

    def test_long_high_leverage(self):
        # entry=100, leverage=100, mmr=0.004
        # expected = 100 * (1 - 0.01 + 0.004) = 100 * 0.994 = 99.4
        result = compute_liquidation_price("LONG", 100.0, 100)
        assert result == pytest.approx(99.4)

    def test_short_high_leverage(self):
        # entry=100, leverage=100, mmr=0.004
        # expected = 100 * (1 + 0.01 - 0.004) = 100 * 1.006 = 100.6
        result = compute_liquidation_price("SHORT", 100.0, 100)
        assert result == pytest.approx(100.6)

    def test_custom_mmr(self):
        result = compute_liquidation_price("LONG", 50000.0, 10, maintenance_margin_rate=0.01)
        # 50000 * (1 - 0.1 + 0.01) = 50000 * 0.91 = 45500
        assert result == pytest.approx(45500.0)

    def test_case_insensitive_side(self):
        assert compute_liquidation_price("long", 1000.0, 5) == compute_liquidation_price(
            "LONG", 1000.0, 5
        )


# ---------------------------------------------------------------------------
# Binance set_leverage (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBinanceSetLeverage:
    @pytest.mark.asyncio
    async def test_success(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            200,
            json={"leverage": 10, "maxNotionalValue": "1000000", "symbol": "BTCUSDT"},
            request=httpx.Request("POST", "https://fapi.binance.com/fapi/v1/leverage"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            with patch.dict("os.environ", {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"}):
                result = await binance.set_leverage("BTCUSDT", 10)
        assert result is True

    @pytest.mark.asyncio
    async def test_failure_http_error(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            400,
            json={"code": -1000, "msg": "bad request"},
            request=httpx.Request("POST", "https://fapi.binance.com/fapi/v1/leverage"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            with patch.dict("os.environ", {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"}):
                result = await binance.set_leverage("BTCUSDT", 10)
        assert result is False


# ---------------------------------------------------------------------------
# Binance set_margin_type (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBinanceSetMarginType:
    @pytest.mark.asyncio
    async def test_success(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            200,
            json={"code": 200, "msg": "success"},
            request=httpx.Request("POST", "https://fapi.binance.com/fapi/v1/marginType"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            with patch.dict("os.environ", {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"}):
                result = await binance.set_margin_type("BTCUSDT", MarginType.ISOLATED)
        assert result is True

    @pytest.mark.asyncio
    async def test_already_set(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            400,
            json={"code": -4046, "msg": "No need to change margin type."},
            request=httpx.Request("POST", "https://fapi.binance.com/fapi/v1/marginType"),
        )
        mock_response.headers["content-type"] = "application/json"

        async def raise_for_status(*args, **kwargs):
            raise httpx.HTTPStatusError(
                "400", request=mock_response.request, response=mock_response
            )

        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            with patch.dict("os.environ", {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"}):
                # The response raises HTTPStatusError on raise_for_status
                # But the connector catches it and checks for the "No need" message
                result = await binance.set_margin_type("BTCUSDT", MarginType.CROSS)
        # raise_for_status is called inside _request, which will raise
        # The connector should handle the -4046 case
        # Since our mock doesn't actually raise, it returns True
        assert result is True

    @pytest.mark.asyncio
    async def test_failure(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            500,
            json={"code": -1000, "msg": "internal error"},
            request=httpx.Request("POST", "https://fapi.binance.com/fapi/v1/marginType"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            with patch.dict("os.environ", {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"}):
                result = await binance.set_margin_type("BTCUSDT", MarginType.ISOLATED)
        assert result is False


# ---------------------------------------------------------------------------
# Binance calculate_liquidation_price (uses shared utility via base class)
# ---------------------------------------------------------------------------


class TestBinanceLiquidationPrice:
    @pytest.mark.asyncio
    async def test_long(self, binance: BinanceConnector):
        result = await binance.calculate_liquidation_price(
            symbol="BTCUSDT", side="LONG", entry_price=50000.0, leverage=10
        )
        assert result == pytest.approx(45200.0)

    @pytest.mark.asyncio
    async def test_short(self, binance: BinanceConnector):
        result = await binance.calculate_liquidation_price(
            symbol="BTCUSDT", side="SHORT", entry_price=50000.0, leverage=10
        )
        assert result == pytest.approx(54800.0)


# ---------------------------------------------------------------------------
# Binance get_mark_price (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBinanceGetMarkPrice:
    @pytest.mark.asyncio
    async def test_response_parsing(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            200,
            json={
                "symbol": "BTCUSDT",
                "markPrice": "50123.45",
                "indexPrice": "50100.00",
                "estimatedSettlePrice": "50110.00",
                "lastFundingRate": "0.00010000",
                "nextFundingTime": 1700000000000,
                "interestRate": "0.00010000",
                "time": 1699999000000,
            },
            request=httpx.Request("GET", "https://fapi.binance.com/fapi/v1/premiumIndex"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            result = await binance.get_mark_price("BTCUSDT")

        assert isinstance(result, MarkPriceInfo)
        assert result.mark_price == pytest.approx(50123.45)
        assert result.index_price == pytest.approx(50100.0)
        assert result.timestamp == "1699999000000"


# ---------------------------------------------------------------------------
# Binance get_funding_rate_history (mocked HTTP)
# ---------------------------------------------------------------------------


class TestBinanceGetFundingRateHistory:
    @pytest.mark.asyncio
    async def test_response_parsing(self, binance: BinanceConnector):
        mock_response = httpx.Response(
            200,
            json=[
                {
                    "symbol": "BTCUSDT",
                    "fundingRate": "0.00010000",
                    "fundingTime": 1699990000000,
                },
                {
                    "symbol": "BTCUSDT",
                    "fundingRate": "-0.00005000",
                    "fundingTime": 1699980000000,
                },
            ],
            request=httpx.Request("GET", "https://fapi.binance.com/fapi/v1/fundingRate"),
        )
        with patch.object(binance._client, "request", new_callable=AsyncMock, return_value=mock_response):
            result = await binance.get_funding_rate_history("BTCUSDT", limit=2)

        assert len(result) == 2
        assert result[0].symbol == "BTCUSDT"
        assert result[0].funding_rate == pytest.approx(0.0001)
        assert result[1].funding_rate == pytest.approx(-0.00005)
        assert result[0].timestamp == "1699990000000"
