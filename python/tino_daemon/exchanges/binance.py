"""Binance exchange connector — full implementation including trading."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from urllib.parse import urlencode

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

_SPOT_BASE = "https://api.binance.com"
_FUTURES_BASE = "https://fapi.binance.com"

# Binance interval mapping: canonical -> Binance format
_INTERVAL_MAP: dict[str, str] = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "6h": "6h",
    "8h": "8h",
    "12h": "12h",
    "1d": "1d",
    "3d": "3d",
    "1w": "1w",
    "1M": "1M",
}


class BinanceConnector(BaseExchangeConnector):
    """Binance exchange connector with full spot + futures support."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)
        # Binance: 1200 requests/min for spot, 2400 for futures
        self._rate_limiter = RateLimiter(max_calls=1000, window_seconds=60.0)

    @property
    def name(self) -> str:
        return "binance"

    def _get_credentials(self) -> tuple[str, str]:
        """Read API key and secret from environment variables."""
        api_key = os.environ.get("BINANCE_API_KEY", "")
        api_secret = os.environ.get("BINANCE_API_SECRET", "")
        if not api_key or not api_secret:
            raise ValueError(
                "BINANCE_API_KEY and BINANCE_API_SECRET environment variables are required"
            )
        return api_key, api_secret

    def _sign(self, params: dict[str, str], secret: str) -> str:
        """Create HMAC-SHA256 signature for Binance signed endpoints."""
        query = urlencode(params)
        return hmac.new(
            secret.encode(), query.encode(), hashlib.sha256
        ).hexdigest()

    async def _request(
        self,
        method: str,
        url: str,
        params: dict[str, str] | None = None,
        signed: bool = False,
    ) -> dict:
        """Execute an HTTP request with rate limiting and optional signing."""
        await self._rate_limiter.acquire()

        headers: dict[str, str] = {}
        if params is None:
            params = {}

        if signed:
            api_key, api_secret = self._get_credentials()
            headers["X-MBX-APIKEY"] = api_key
            params["timestamp"] = str(int(time.time() * 1000))
            params["signature"] = self._sign(params, api_secret)

        resp = await self._client.request(method, url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def get_ticker(self, symbol: str) -> Ticker:
        data = await self._request(
            "GET",
            f"{_SPOT_BASE}/api/v3/ticker/24hr",
            params={"symbol": symbol},
        )
        return Ticker(
            symbol=data["symbol"],
            last_price=float(data["lastPrice"]),
            bid_price=float(data["bidPrice"]),
            ask_price=float(data["askPrice"]),
            volume_24h=float(data["volume"]),
            high_24h=float(data["highPrice"]),
            low_24h=float(data["lowPrice"]),
            timestamp=str(data["closeTime"]),
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
            "symbol": symbol,
            "interval": _INTERVAL_MAP.get(interval, interval),
            "limit": str(min(limit, 1000)),
        }
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        data = await self._request(
            "GET", f"{_SPOT_BASE}/api/v3/klines", params=params
        )
        return [
            Kline(
                open_time=int(k[0]),
                open=float(k[1]),
                high=float(k[2]),
                low=float(k[3]),
                close=float(k[4]),
                volume=float(k[5]),
                close_time=int(k[6]),
            )
            for k in data
        ]

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        data = await self._request(
            "GET",
            f"{_FUTURES_BASE}/fapi/v1/premiumIndex",
            params={"symbol": symbol},
        )
        return FundingRate(
            symbol=data["symbol"],
            funding_rate=float(data["lastFundingRate"]),
            next_funding_time=str(data["nextFundingTime"]),
            timestamp=str(data["time"]),
        )

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        data = await self._request(
            "GET",
            f"{_SPOT_BASE}/api/v3/depth",
            params={"symbol": symbol, "limit": str(min(limit, 5000))},
        )
        return Orderbook(
            bids=[
                OrderbookLevel(price=float(b[0]), quantity=float(b[1]))
                for b in data["bids"]
            ],
            asks=[
                OrderbookLevel(price=float(a[0]), quantity=float(a[1]))
                for a in data["asks"]
            ],
            timestamp=str(int(time.time() * 1000)),
        )

    async def get_account_balance(self) -> list[Balance]:
        data = await self._request(
            "GET",
            f"{_SPOT_BASE}/api/v3/account",
            signed=True,
        )
        balances = []
        for b in data.get("balances", []):
            free = float(b["free"])
            locked = float(b["locked"])
            if free > 0 or locked > 0:
                balances.append(
                    Balance(
                        asset=b["asset"],
                        free=free,
                        locked=locked,
                        total=free + locked,
                    )
                )
        return balances

    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        params: dict[str, str] = {}
        if symbol:
            params["symbol"] = symbol
        data = await self._request(
            "GET",
            f"{_FUTURES_BASE}/fapi/v2/positionRisk",
            params=params,
            signed=True,
        )
        positions = []
        for p in data:
            qty = float(p.get("positionAmt", 0))
            if qty == 0:
                continue
            positions.append(
                Position(
                    symbol=p["symbol"],
                    side="LONG" if qty > 0 else "SHORT",
                    quantity=abs(qty),
                    entry_price=float(p.get("entryPrice", 0)),
                    unrealized_pnl=float(p.get("unRealizedProfit", 0)),
                    leverage=float(p.get("leverage", 1)),
                )
            )
        return positions

    async def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float | None = None,
    ) -> OrderResult:
        params: dict[str, str] = {
            "symbol": symbol,
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": str(quantity),
        }
        if price is not None and order_type.upper() == "LIMIT":
            params["price"] = str(price)
            params["timeInForce"] = "GTC"

        try:
            data = await self._request(
                "POST",
                f"{_SPOT_BASE}/api/v3/order",
                params=params,
                signed=True,
            )
            return OrderResult(
                order_id=str(data["orderId"]),
                success=True,
                message="Order placed successfully",
            )
        except httpx.HTTPStatusError as exc:
            return OrderResult(
                order_id="",
                success=False,
                message=f"Order failed: {exc.response.text}",
            )
        except Exception as exc:
            return OrderResult(
                order_id="",
                success=False,
                message=f"Order failed: {exc}",
            )

    async def cancel_order(
        self,
        symbol: str,
        order_id: str,
    ) -> OrderResult:
        params: dict[str, str] = {
            "symbol": symbol,
            "orderId": order_id,
        }
        try:
            await self._request(
                "DELETE",
                f"{_SPOT_BASE}/api/v3/order",
                params=params,
                signed=True,
            )
            return OrderResult(
                order_id=order_id,
                success=True,
                message="Order cancelled successfully",
            )
        except httpx.HTTPStatusError as exc:
            return OrderResult(
                order_id=order_id,
                success=False,
                message=f"Cancel failed: {exc.response.text}",
            )
        except Exception as exc:
            return OrderResult(
                order_id=order_id,
                success=False,
                message=f"Cancel failed: {exc}",
            )

    async def close(self) -> None:
        await self._client.aclose()
