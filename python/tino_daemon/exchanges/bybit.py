"""Bybit exchange connector — market data methods implemented."""

from __future__ import annotations

import logging
import time

import httpx

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
from tino_daemon.exchanges.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.bybit.com"

# Bybit interval mapping: canonical -> Bybit v5 format
_INTERVAL_MAP: dict[str, str] = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
    "1M": "M",
}


class BybitConnector(BaseExchangeConnector):
    """Bybit exchange connector with market data support.

    Trading methods (place_order, cancel_order) and account methods
    (get_account_balance, get_positions) are stubbed for future implementation.
    """

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)
        # Bybit v5: 120 requests/5 seconds for public endpoints
        self._rate_limiter = RateLimiter(max_calls=20, window_seconds=1.0)

    @property
    def name(self) -> str:
        return "bybit"

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
        if data.get("retCode") != 0:
            raise ValueError(
                f"Bybit API error: {data.get('retMsg', 'unknown')}"
            )
        return data

    async def get_ticker(self, symbol: str) -> Ticker:
        data = await self._request(
            f"{_BASE_URL}/v5/market/tickers",
            params={"category": "spot", "symbol": symbol},
        )
        t = data["result"]["list"][0]
        return Ticker(
            symbol=t["symbol"],
            last_price=float(t["lastPrice"]),
            bid_price=float(t["bid1Price"]),
            ask_price=float(t["ask1Price"]),
            volume_24h=float(t["volume24h"]),
            high_24h=float(t["highPrice24h"]),
            low_24h=float(t["lowPrice24h"]),
            timestamp=str(data["result"].get("time", data.get("time", ""))),
        )

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[Kline]:
        params: dict[str, str] = {
            "category": "spot",
            "symbol": symbol,
            "interval": _INTERVAL_MAP.get(interval, interval),
            "limit": str(min(limit, 1000)),
        }
        if start_time:
            params["start"] = start_time
        if end_time:
            params["end"] = end_time

        data = await self._request(
            f"{_BASE_URL}/v5/market/kline",
            params=params,
        )
        # Bybit returns newest first, reverse for chronological order
        rows = data["result"]["list"]
        rows.reverse()
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
            for k in rows
        ]

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        data = await self._request(
            f"{_BASE_URL}/v5/market/tickers",
            params={"category": "linear", "symbol": symbol},
        )
        t = data["result"]["list"][0]
        return FundingRate(
            symbol=t["symbol"],
            funding_rate=float(t.get("fundingRate", 0)),
            next_funding_time=str(t.get("nextFundingTime", "")),
            timestamp=str(data["result"].get("time", data.get("time", ""))),
        )

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        data = await self._request(
            f"{_BASE_URL}/v5/market/orderbook",
            params={
                "category": "spot",
                "symbol": symbol,
                "limit": str(min(limit, 200)),
            },
        )
        book = data["result"]
        return Orderbook(
            bids=[
                OrderbookLevel(price=float(b[0]), quantity=float(b[1]))
                for b in book["b"]
            ],
            asks=[
                OrderbookLevel(price=float(a[0]), quantity=float(a[1]))
                for a in book["a"]
            ],
            timestamp=str(book.get("ts", "")),
        )

    async def get_account_balance(self) -> list[Balance]:
        raise NotImplementedError(
            "Bybit get_account_balance requires signed API — not yet implemented"
        )

    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        raise NotImplementedError(
            "Bybit get_positions requires signed API — not yet implemented"
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
            "Bybit place_order requires signed API — not yet implemented"
        )

    async def cancel_order(
        self,
        symbol: str,
        order_id: str,
    ) -> OrderResult:
        raise NotImplementedError(
            "Bybit cancel_order requires signed API — not yet implemented"
        )

    async def close(self) -> None:
        await self._client.aclose()
