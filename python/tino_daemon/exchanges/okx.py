"""OKX exchange connector — market data methods implemented."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx

from tino_daemon.exchanges.base_connector import (
    Balance,
    BaseExchangeConnector,
    FundingRate,
    Kline,
    MarkPriceInfo,
    MarginType,
    Orderbook,
    OrderbookLevel,
    OrderResult,
    Position,
    Ticker,
)
from tino_daemon.exchanges.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.okx.com"

# OKX interval mapping: canonical -> OKX format
_INTERVAL_MAP: dict[str, str] = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1H",
    "2h": "2H",
    "4h": "4H",
    "6h": "6H",
    "12h": "12H",
    "1d": "1D",
    "1w": "1W",
    "1M": "1M",
}


class OKXConnector(BaseExchangeConnector):
    """OKX exchange connector with market data support.

    Trading methods (place_order, cancel_order) and account methods
    (get_account_balance, get_positions) are stubbed for future implementation.
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)
        # OKX: 20 requests/2 seconds for public endpoints
        self._rate_limiter = RateLimiter(max_calls=10, window_seconds=1.0)

    @property
    def name(self) -> str:
        return "okx"

    async def _request(
        self,
        url: str,
        params: dict[str, str] | None = None,
    ) -> dict:
        """Execute a GET request with rate limiting."""
        await self._rate_limiter.acquire()
        resp = await self._client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "0":
            raise ValueError(f"OKX API error: {data.get('msg', 'unknown')}")
        return data

    def _get_credentials(self) -> tuple[str, str, str]:
        """Read API key, secret, and passphrase from environment variables."""
        api_key = os.environ.get("OKX_API_KEY", "")
        api_secret = os.environ.get("OKX_API_SECRET", "")
        passphrase = os.environ.get("OKX_PASSPHRASE", "")
        if not api_key or not api_secret or not passphrase:
            raise ValueError(
                "OKX_API_KEY, OKX_API_SECRET, and OKX_PASSPHRASE environment variables are required"
            )
        return api_key, api_secret, passphrase

    async def _signed_request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
    ) -> dict:
        """Execute a signed request using OKX V5 HMAC-SHA256 authentication."""
        await self._rate_limiter.acquire()
        api_key, api_secret, passphrase = self._get_credentials()
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        body_str = json.dumps(body) if body else ""
        sign_payload = f"{timestamp}{method.upper()}{path}{body_str}"
        signature = base64.b64encode(
            hmac.new(
                api_secret.encode(), sign_payload.encode(), hashlib.sha256
            ).digest()
        ).decode()

        headers = {
            "OK-ACCESS-KEY": api_key,
            "OK-ACCESS-SIGN": signature,
            "OK-ACCESS-TIMESTAMP": timestamp,
            "OK-ACCESS-PASSPHRASE": passphrase,
            "Content-Type": "application/json",
        }

        url = f"{_BASE_URL}{path}"
        resp = await self._client.request(
            method, url, content=body_str.encode() if body_str else None, headers=headers
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "0":
            raise ValueError(f"OKX API error: {data.get('msg', 'unknown')}")
        return data

    @staticmethod
    def _to_inst_id(symbol: str) -> str:
        """Convert symbol to OKX instId format (e.g. BTCUSDT -> BTC-USDT)."""
        if "-" in symbol:
            return symbol
        # Try common quote currencies
        for quote in ("USDT", "USDC", "BTC", "ETH"):
            if symbol.upper().endswith(quote):
                base = symbol.upper()[: -len(quote)]
                return f"{base}-{quote}"
        return symbol

    async def get_ticker(self, symbol: str) -> Ticker:
        inst_id = self._to_inst_id(symbol)
        data = await self._request(
            f"{_BASE_URL}/api/v5/market/ticker",
            params={"instId": inst_id},
        )
        t = data["data"][0]
        return Ticker(
            symbol=t["instId"],
            last_price=float(t["last"]),
            bid_price=float(t["bidPx"]),
            ask_price=float(t["askPx"]),
            volume_24h=float(t["vol24h"]),
            high_24h=float(t["high24h"]),
            low_24h=float(t["low24h"]),
            timestamp=t["ts"],
        )

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[Kline]:
        inst_id = self._to_inst_id(symbol)
        params: dict[str, str] = {
            "instId": inst_id,
            "bar": _INTERVAL_MAP.get(interval, interval),
            "limit": str(min(limit, 300)),
        }
        if end_time:
            params["before"] = end_time
        if start_time:
            params["after"] = start_time

        data = await self._request(
            f"{_BASE_URL}/api/v5/market/candles",
            params=params,
        )
        return [
            Kline(
                open_time=int(k[0]),
                open=float(k[1]),
                high=float(k[2]),
                low=float(k[3]),
                close=float(k[4]),
                volume=float(k[5]),
                close_time=int(k[0]),
            )
            for k in data["data"]
        ]

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        inst_id = self._to_inst_id(symbol)
        # OKX uses SWAP suffix for perpetual funding rates
        if not inst_id.endswith("-SWAP"):
            inst_id = f"{inst_id}-SWAP"
        data = await self._request(
            f"{_BASE_URL}/api/v5/public/funding-rate",
            params={"instId": inst_id},
        )
        fr = data["data"][0]
        return FundingRate(
            symbol=fr["instId"],
            funding_rate=float(fr["fundingRate"]),
            next_funding_time=fr["nextFundingTime"],
            timestamp=fr["fundingTime"],
        )

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        inst_id = self._to_inst_id(symbol)
        data = await self._request(
            f"{_BASE_URL}/api/v5/market/books",
            params={"instId": inst_id, "sz": str(min(limit, 400))},
        )
        book = data["data"][0]
        return Orderbook(
            bids=[
                OrderbookLevel(price=float(b[0]), quantity=float(b[1]))
                for b in book["bids"]
            ],
            asks=[
                OrderbookLevel(price=float(a[0]), quantity=float(a[1]))
                for a in book["asks"]
            ],
            timestamp=book["ts"],
        )

    async def get_account_balance(self) -> list[Balance]:
        raise NotImplementedError(
            "OKX get_account_balance requires signed API — not yet implemented"
        )

    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        raise NotImplementedError(
            "OKX get_positions requires signed API — not yet implemented"
        )

    async def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float | None = None,
    ) -> OrderResult:
        raise NotImplementedError(
            "OKX place_order requires signed API — not yet implemented"
        )

    async def cancel_order(
        self,
        symbol: str,
        order_id: str,
    ) -> OrderResult:
        raise NotImplementedError(
            "OKX cancel_order requires signed API — not yet implemented"
        )

    @staticmethod
    def _to_swap_inst_id(symbol: str) -> str:
        """Convert symbol to OKX SWAP instId format (e.g. BTCUSDT -> BTC-USDT-SWAP)."""
        inst_id = OKXConnector._to_inst_id(symbol)
        if not inst_id.endswith("-SWAP"):
            inst_id = f"{inst_id}-SWAP"
        return inst_id

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        inst_id = self._to_swap_inst_id(symbol)
        try:
            await self._signed_request(
                "POST",
                "/api/v5/account/set-leverage",
                body={
                    "instId": inst_id,
                    "lever": str(leverage),
                    "mgnMode": "cross",
                },
            )
            return True
        except Exception as exc:
            logger.error("set_leverage failed for %s: %s", symbol, exc)
            return False

    async def set_margin_type(
        self, symbol: str, margin_type: MarginType, leverage: int = 1
    ) -> bool:
        inst_id = self._to_swap_inst_id(symbol)
        mgn_mode = "isolated" if margin_type == MarginType.ISOLATED else "cross"
        try:
            await self._signed_request(
                "POST",
                "/api/v5/account/set-leverage",
                body={
                    "instId": inst_id,
                    "lever": str(leverage),
                    "mgnMode": mgn_mode,
                },
            )
            return True
        except Exception as exc:
            logger.error("set_margin_type failed for %s: %s", symbol, exc)
            return False

    async def get_mark_price(self, symbol: str) -> MarkPriceInfo:
        inst_id = self._to_swap_inst_id(symbol)
        data = await self._request(
            f"{_BASE_URL}/api/v5/public/mark-price",
            params={"instId": inst_id, "instType": "SWAP"},
        )
        item = data["data"][0]
        return MarkPriceInfo(
            mark_price=float(item["markPx"]),
            index_price=float(item.get("idxPx", 0)),
            timestamp=item.get("ts", ""),
        )

    async def get_funding_rate_history(
        self, symbol: str, limit: int = 100
    ) -> list[FundingRate]:
        inst_id = self._to_swap_inst_id(symbol)
        data = await self._request(
            f"{_BASE_URL}/api/v5/public/funding-rate-history",
            params={"instId": inst_id, "limit": str(min(limit, 100))},
        )
        return [
            FundingRate(
                symbol=r["instId"],
                funding_rate=float(r["fundingRate"]),
                next_funding_time="",
                timestamp=r["fundingTime"],
            )
            for r in data["data"]
        ]

    async def close(self) -> None:
        await self._client.aclose()
