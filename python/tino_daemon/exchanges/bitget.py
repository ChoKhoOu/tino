"""Bitget exchange connector — full implementation including trading."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from base64 import b64encode
from urllib.parse import urlencode

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

_BASE_URL = "https://api.bitget.com"

# Bitget interval mapping: canonical -> Bitget format
_INTERVAL_MAP: dict[str, str] = {
    "1m": "1min",
    "3m": "3min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "6h": "6h",
    "12h": "12h",
    "1d": "1day",
    "3d": "3day",
    "1w": "1week",
    "1M": "1M",
}

# Bitget futures side mapping
_SIDE_MAP: dict[str, str] = {
    "BUY": "buy",
    "SELL": "sell",
    "buy": "buy",
    "sell": "sell",
}


class BitgetConnector(BaseExchangeConnector):
    """Bitget exchange connector with spot + USDT-M futures support."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=10.0)
        # Bitget: 20 requests/second for public, 10 for private
        self._rate_limiter = RateLimiter(max_calls=900, window_seconds=60.0)

    @property
    def name(self) -> str:
        return "bitget"

    def _get_credentials(self) -> tuple[str, str, str]:
        """Read API key, secret, and passphrase from environment variables."""
        api_key = os.environ.get("BITGET_API_KEY", "")
        api_secret = os.environ.get("BITGET_API_SECRET", "")
        passphrase = os.environ.get("BITGET_PASSPHRASE", "")
        if not api_key or not api_secret or not passphrase:
            raise ValueError(
                "BITGET_API_KEY, BITGET_API_SECRET, and BITGET_PASSPHRASE "
                "environment variables are required"
            )
        return api_key, api_secret, passphrase

    def _sign(self, timestamp: str, method: str, path: str, body: str, secret: str) -> str:
        """Create HMAC-SHA256 signature for Bitget signed endpoints."""
        message = timestamp + method.upper() + path + body
        mac = hmac.new(secret.encode(), message.encode(), hashlib.sha256)
        return b64encode(mac.digest()).decode()

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, str] | None = None,
        body: dict | None = None,
        signed: bool = False,
    ) -> dict:
        """Execute an HTTP request with rate limiting and optional signing."""
        await self._rate_limiter.acquire()

        url = f"{_BASE_URL}{path}"
        request_headers: dict[str, str] = {
            "Content-Type": "application/json",
        }

        query_string = ""
        if params:
            query_string = "?" + urlencode(params)

        body_str = ""
        if body:
            import json
            body_str = json.dumps(body)

        if signed:
            api_key, api_secret, passphrase = self._get_credentials()
            timestamp = str(int(time.time() * 1000))
            sign_path = path + query_string
            signature = self._sign(timestamp, method, sign_path, body_str, api_secret)
            request_headers["ACCESS-KEY"] = api_key
            request_headers["ACCESS-SIGN"] = signature
            request_headers["ACCESS-TIMESTAMP"] = timestamp
            request_headers["ACCESS-PASSPHRASE"] = passphrase

        if method.upper() == "GET":
            resp = await self._client.request(method, url, params=params, headers=request_headers)
        else:
            resp = await self._client.request(
                method, url, params=params, headers=request_headers, content=body_str
            )

        resp.raise_for_status()
        result = resp.json()

        if result.get("code") != "00000":
            raise httpx.HTTPStatusError(
                f"Bitget API error: {result.get('msg', 'unknown')} (code {result.get('code')})",
                request=resp.request,
                response=resp,
            )

        return result.get("data", result)

    async def get_ticker(self, symbol: str) -> Ticker:
        data = await self._request(
            "GET",
            "/api/v2/spot/market/tickers",
            params={"symbol": symbol},
        )
        # API returns a list; take the first entry
        item = data[0] if isinstance(data, list) else data
        return Ticker(
            symbol=item["symbol"],
            last_price=float(item["lastPr"]),
            bid_price=float(item["bidPr"]),
            ask_price=float(item["askPr"]),
            volume_24h=float(item["baseVolume"]),
            high_24h=float(item["high24h"]),
            low_24h=float(item["low24h"]),
            timestamp=str(item["ts"]),
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
            "granularity": _INTERVAL_MAP.get(interval, interval),
            "limit": str(min(limit, 1000)),
        }
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        data = await self._request(
            "GET", "/api/v2/spot/market/candles", params=params
        )
        # Bitget returns array of arrays: [ts, open, high, low, close, volume, quoteVolume, usdtVolume]
        return [
            Kline(
                open_time=int(k[0]),
                open=float(k[1]),
                high=float(k[2]),
                low=float(k[3]),
                close=float(k[4]),
                volume=float(k[5]),
                close_time=int(k[0]),  # Bitget doesn't provide separate close time
            )
            for k in data
        ]

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        data = await self._request(
            "GET",
            "/api/v2/mix/market/current-fund-rate",
            params={"symbol": symbol, "productType": "USDT-FUTURES"},
        )
        item = data[0] if isinstance(data, list) else data
        return FundingRate(
            symbol=item["symbol"],
            funding_rate=float(item["fundingRate"]),
            next_funding_time="",
            timestamp=str(int(time.time() * 1000)),
        )

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        data = await self._request(
            "GET",
            "/api/v2/spot/market/orderbook",
            params={"symbol": symbol, "limit": str(min(limit, 150))},
        )
        return Orderbook(
            bids=[
                OrderbookLevel(price=float(b[0]), quantity=float(b[1]))
                for b in data.get("bids", [])
            ],
            asks=[
                OrderbookLevel(price=float(a[0]), quantity=float(a[1]))
                for a in data.get("asks", [])
            ],
            timestamp=str(data.get("ts", int(time.time() * 1000))),
        )

    async def get_account_balance(self) -> list[Balance]:
        data = await self._request(
            "GET",
            "/api/v2/spot/account/assets",
            signed=True,
        )
        balances = []
        for b in data if isinstance(data, list) else []:
            free = float(b.get("available", 0))
            locked = float(b.get("frozen", 0))
            if free > 0 or locked > 0:
                balances.append(
                    Balance(
                        asset=b["coin"],
                        free=free,
                        locked=locked,
                        total=free + locked,
                    )
                )
        return balances

    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        params: dict[str, str] = {"productType": "USDT-FUTURES"}
        if symbol:
            params["symbol"] = symbol
        data = await self._request(
            "GET",
            "/api/v2/mix/position/all-position",
            params=params,
            signed=True,
        )
        positions = []
        for p in data if isinstance(data, list) else []:
            qty = float(p.get("total", 0))
            if qty == 0:
                continue
            hold_side = p.get("holdSide", "long").upper()
            margin_mode = p.get("marginMode", "crossed").lower()
            positions.append(
                Position(
                    symbol=p["symbol"],
                    side="LONG" if hold_side == "LONG" else "SHORT",
                    quantity=abs(qty),
                    entry_price=float(p.get("openPriceAvg", 0)),
                    unrealized_pnl=float(p.get("unrealizedPL", 0)),
                    leverage=float(p.get("leverage", 1)),
                    mark_price=float(p.get("markPrice", 0)),
                    liquidation_price=float(p.get("liquidationPrice", 0)),
                    margin_type=MarginType.ISOLATED if margin_mode == "isolated" else MarginType.CROSS,
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
        **kwargs: object,
    ) -> OrderResult:
        body: dict = {
            "symbol": symbol,
            "productType": "USDT-FUTURES",
            "marginMode": "crossed",
            "side": _SIDE_MAP.get(side.upper(), side.lower()),
            "orderType": order_type.lower(),
            "size": str(quantity),
        }
        if price is not None and order_type.upper() == "LIMIT":
            body["price"] = str(price)

        try:
            data = await self._request(
                "POST",
                "/api/v2/mix/order/place-order",
                body=body,
                signed=True,
            )
            order_id = data.get("orderId", "") if isinstance(data, dict) else ""
            return OrderResult(
                order_id=str(order_id),
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
        body = {
            "symbol": symbol,
            "productType": "USDT-FUTURES",
            "orderId": order_id,
        }
        try:
            await self._request(
                "POST",
                "/api/v2/mix/order/cancel-order",
                body=body,
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

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        try:
            await self._request(
                "POST",
                "/api/v2/mix/account/set-leverage",
                body={
                    "symbol": symbol,
                    "productType": "USDT-FUTURES",
                    "marginCoin": "USDT",
                    "leverage": str(leverage),
                },
                signed=True,
            )
            return True
        except Exception as exc:
            logger.error("set_leverage failed for %s: %s", symbol, exc)
            return False

    async def set_margin_type(
        self, symbol: str, margin_type: MarginType, leverage: int = 1
    ) -> bool:
        margin_str = "crossed" if margin_type == MarginType.CROSS else "isolated"
        try:
            await self._request(
                "POST",
                "/api/v2/mix/account/set-margin-mode",
                body={
                    "symbol": symbol,
                    "productType": "USDT-FUTURES",
                    "marginCoin": "USDT",
                    "marginMode": margin_str,
                },
                signed=True,
            )
            return True
        except Exception as exc:
            logger.error("set_margin_type failed for %s: %s", symbol, exc)
            return False

    async def get_mark_price(self, symbol: str) -> MarkPriceInfo:
        data = await self._request(
            "GET",
            "/api/v2/mix/market/mark-price",
            params={"symbol": symbol, "productType": "USDT-FUTURES"},
        )
        item = data[0] if isinstance(data, list) else data
        return MarkPriceInfo(
            mark_price=float(item.get("markPrice", 0)),
            index_price=float(item.get("indexPrice", 0)),
            timestamp=str(item.get("ts", "")),
        )

    async def get_funding_rate_history(
        self, symbol: str, limit: int = 100
    ) -> list[FundingRate]:
        data = await self._request(
            "GET",
            "/api/v2/mix/market/history-fund-rate",
            params={
                "symbol": symbol,
                "productType": "USDT-FUTURES",
                "pageSize": str(min(limit, 100)),
            },
        )
        return [
            FundingRate(
                symbol=r.get("symbol", symbol),
                funding_rate=float(r["fundingRate"]),
                next_funding_time="",
                timestamp=str(r.get("fundingTime", "")),
            )
            for r in (data if isinstance(data, list) else [])
        ]

    async def close(self) -> None:
        await self._client.aclose()
