"""Vendored Hummingbot Binance connector — REST-only, spot + linear futures.

Adapted from hummingbot/connector/exchange/binance/ (Apache 2.0).
Implements the same REST API endpoints and authentication that Hummingbot uses,
but in a lightweight httpx-based form without the full framework coupling.

Reference: https://github.com/hummingbot/hummingbot/tree/master/hummingbot/connector/exchange/binance
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from urllib.parse import urlencode

import httpx

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
    HummingbotConnectorBase,
)

logger = logging.getLogger(__name__)

# Hummingbot Binance constants (from binance_constants.py)
SPOT_REST_URL = "https://api.binance.com"
PERP_REST_URL = "https://fapi.binance.com"

# Hummingbot interval mapping
INTERVAL_MAP: dict[str, str] = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h",
    "12h": "12h", "1d": "1d", "3d": "3d", "1w": "1w", "1M": "1M",
}


class HBBinanceConnector(HummingbotConnectorBase):
    """Vendored Hummingbot Binance connector (REST-only).

    Follows Hummingbot's Binance connector patterns:
    - HMAC-SHA256 authentication (binance_auth.py)
    - Trading pair conversion (BTC-USDT -> BTCUSDT)
    - Separate spot/futures URL routing
    """

    def __init__(self) -> None:
        # Binance rate limit: 1200 req/min spot, 2400 req/min futures
        super().__init__(timeout=10.0, rate_limit=1000)

    @property
    def name(self) -> str:
        return "binance"

    # -- Hummingbot-style trading pair helpers --

    @staticmethod
    def convert_to_exchange_symbol(trading_pair: str) -> str:
        """Convert Hummingbot trading pair format to Binance symbol.

        Hummingbot uses 'BTC-USDT', Binance uses 'BTCUSDT'.
        Also accepts 'BTCUSDT' pass-through.
        """
        return trading_pair.replace("-", "")

    @staticmethod
    def convert_from_exchange_symbol(symbol: str) -> str:
        """Convert Binance symbol to Hummingbot trading pair format.

        Best-effort: tries common quote currencies.
        """
        for quote in ("USDT", "USDC", "BUSD", "BTC", "ETH", "BNB"):
            if symbol.upper().endswith(quote):
                base = symbol.upper()[: -len(quote)]
                return f"{base}-{quote}"
        return symbol

    @staticmethod
    def _is_perpetual(trading_pair: str) -> bool:
        """Detect if a trading pair is for perpetual futures."""
        sym = trading_pair.replace("-", "").upper()
        return sym.endswith("USDT") or sym.endswith("BUSD")

    # -- Auth (adapted from binance_auth.py) --

    def _get_api_keys(self) -> tuple[str, str]:
        """Read API credentials from environment."""
        api_key = os.environ.get("BINANCE_API_KEY", "")
        api_secret = os.environ.get("BINANCE_API_SECRET", "")
        if not api_key or not api_secret:
            raise ValueError(
                "BINANCE_API_KEY and BINANCE_API_SECRET environment variables required"
            )
        return api_key, api_secret

    def _generate_signature(self, params: dict[str, str], secret: str) -> str:
        """HMAC-SHA256 signature (Hummingbot binance_auth pattern)."""
        query_string = urlencode(params)
        return hmac.new(
            secret.encode(), query_string.encode(), hashlib.sha256
        ).hexdigest()

    # -- REST request helpers --

    async def _api_request(
        self,
        method: str,
        url: str,
        params: dict[str, str] | None = None,
        signed: bool = False,
    ) -> dict | list:
        """Execute REST request with rate limiting and optional auth."""
        await self._rate_limiter.acquire()

        headers: dict[str, str] = {}
        if params is None:
            params = {}

        if signed:
            api_key, api_secret = self._get_api_keys()
            headers["X-MBX-APIKEY"] = api_key
            params["timestamp"] = str(int(time.time() * 1000))
            params["signature"] = self._generate_signature(params, api_secret)

        resp = await self._client.request(method, url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()

    # -- Market data endpoints --

    async def get_ticker(self, trading_pair: str) -> HBTicker:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{SPOT_REST_URL}/api/v3/ticker/24hr",
            params={"symbol": symbol},
        )
        return HBTicker(
            trading_pair=self.convert_from_exchange_symbol(data["symbol"]),
            last_price=float(data["lastPrice"]),
            best_bid=float(data["bidPrice"]),
            best_ask=float(data["askPrice"]),
            volume=float(data["volume"]),
            high=float(data["highPrice"]),
            low=float(data["lowPrice"]),
            timestamp_ms=int(data["closeTime"]),
        )

    async def get_candles(
        self,
        trading_pair: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[HBCandle]:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        params: dict[str, str] = {
            "symbol": symbol,
            "interval": INTERVAL_MAP.get(interval, interval),
            "limit": str(min(limit, 1000)),
        }
        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        data = await self._api_request(
            "GET", f"{SPOT_REST_URL}/api/v3/klines", params=params,
        )
        return [
            HBCandle(
                timestamp_ms=int(k[0]),
                open=float(k[1]),
                high=float(k[2]),
                low=float(k[3]),
                close=float(k[4]),
                volume=float(k[5]),
                close_timestamp_ms=int(k[6]),
            )
            for k in data
        ]

    async def get_funding_info(self, trading_pair: str) -> HBFundingInfo:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{PERP_REST_URL}/fapi/v1/premiumIndex",
            params={"symbol": symbol},
        )
        return HBFundingInfo(
            trading_pair=self.convert_from_exchange_symbol(data["symbol"]),
            rate=float(data["lastFundingRate"]),
            next_funding_utc_ms=str(data["nextFundingTime"]),
            timestamp_ms=str(data["time"]),
        )

    async def get_order_book(self, trading_pair: str, depth: int = 20) -> HBOrderBook:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{SPOT_REST_URL}/api/v3/depth",
            params={"symbol": symbol, "limit": str(min(depth, 5000))},
        )
        return HBOrderBook(
            bids=[
                HBOrderBookEntry(price=float(b[0]), amount=float(b[1]))
                for b in data["bids"]
            ],
            asks=[
                HBOrderBookEntry(price=float(a[0]), amount=float(a[1]))
                for a in data["asks"]
            ],
            timestamp_ms=int(time.time() * 1000),
        )

    # -- Account / trading endpoints (signed) --

    async def get_balances(self) -> list[HBBalance]:
        data = await self._api_request(
            "GET", f"{SPOT_REST_URL}/api/v3/account", signed=True,
        )
        result = []
        for b in data.get("balances", []):
            free = float(b["free"])
            locked = float(b["locked"])
            if free > 0 or locked > 0:
                result.append(HBBalance(
                    asset=b["asset"],
                    available=free,
                    total=free + locked,
                ))
        return result

    async def get_positions(self, trading_pair: str | None = None) -> list[HBPosition]:
        params: dict[str, str] = {}
        if trading_pair:
            params["symbol"] = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{PERP_REST_URL}/fapi/v2/positionRisk",
            params=params, signed=True,
        )
        positions = []
        for p in data:
            qty = float(p.get("positionAmt", 0))
            if qty == 0:
                continue
            positions.append(HBPosition(
                trading_pair=self.convert_from_exchange_symbol(p["symbol"]),
                side="LONG" if qty > 0 else "SHORT",
                amount=abs(qty),
                entry_price=float(p.get("entryPrice", 0)),
                unrealized_pnl=float(p.get("unRealizedProfit", 0)),
                leverage=float(p.get("leverage", 1)),
                mark_price=float(p.get("markPrice", 0)),
                liquidation_price=float(p.get("liquidationPrice", 0)),
                margin_mode=p.get("marginType", "cross").lower(),
            ))
        return positions

    async def place_order(
        self,
        trading_pair: str,
        side: str,
        order_type: str,
        amount: float,
        price: float | None = None,
    ) -> HBOrderResult:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        is_futures = self._is_perpetual(trading_pair)
        base_url = PERP_REST_URL if is_futures else SPOT_REST_URL
        endpoint = "/fapi/v1/order" if is_futures else "/api/v3/order"

        params: dict[str, str] = {
            "symbol": symbol,
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": str(amount),
        }
        if price is not None and order_type.upper() == "LIMIT":
            params["price"] = str(price)
            params["timeInForce"] = "GTC"

        try:
            data = await self._api_request(
                "POST", f"{base_url}{endpoint}", params=params, signed=True,
            )
            return HBOrderResult(
                exchange_order_id=str(data["orderId"]),
                success=True,
                message="Order placed successfully",
            )
        except httpx.HTTPStatusError as exc:
            return HBOrderResult(
                exchange_order_id="",
                success=False,
                message=f"Order failed: {exc.response.text}",
            )
        except Exception as exc:
            return HBOrderResult(
                exchange_order_id="",
                success=False,
                message=f"Order failed: {exc}",
            )

    async def cancel_order(
        self, trading_pair: str, exchange_order_id: str
    ) -> HBOrderResult:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        params: dict[str, str] = {"symbol": symbol, "orderId": exchange_order_id}
        try:
            await self._api_request(
                "DELETE", f"{SPOT_REST_URL}/api/v3/order",
                params=params, signed=True,
            )
            return HBOrderResult(
                exchange_order_id=exchange_order_id,
                success=True,
                message="Order cancelled successfully",
            )
        except httpx.HTTPStatusError as exc:
            return HBOrderResult(
                exchange_order_id=exchange_order_id,
                success=False,
                message=f"Cancel failed: {exc.response.text}",
            )
        except Exception as exc:
            return HBOrderResult(
                exchange_order_id=exchange_order_id,
                success=False,
                message=f"Cancel failed: {exc}",
            )

    async def set_leverage(self, trading_pair: str, leverage: int) -> bool:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        try:
            await self._api_request(
                "POST", f"{PERP_REST_URL}/fapi/v1/leverage",
                params={"symbol": symbol, "leverage": str(leverage)},
                signed=True,
            )
            return True
        except Exception as exc:
            logger.error("set_leverage failed for %s: %s", trading_pair, exc)
            return False

    async def set_position_mode(
        self, trading_pair: str, mode: str, leverage: int = 1
    ) -> bool:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        margin_str = "CROSSED" if mode == "cross" else "ISOLATED"
        try:
            await self._api_request(
                "POST", f"{PERP_REST_URL}/fapi/v1/marginType",
                params={"symbol": symbol, "marginType": margin_str},
                signed=True,
            )
            return True
        except httpx.HTTPStatusError as exc:
            if "No need to change margin type" in exc.response.text:
                return True
            logger.error("set_position_mode failed for %s: %s", trading_pair, exc)
            return False
        except Exception as exc:
            logger.error("set_position_mode failed for %s: %s", trading_pair, exc)
            return False

    async def get_mark_price(self, trading_pair: str) -> HBMarkPrice:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{PERP_REST_URL}/fapi/v1/premiumIndex",
            params={"symbol": symbol},
        )
        return HBMarkPrice(
            mark_price=float(data["markPrice"]),
            index_price=float(data.get("indexPrice", 0)),
            timestamp_ms=str(data.get("time", "")),
        )

    async def get_funding_rate_history(
        self, trading_pair: str, limit: int = 100
    ) -> list[HBFundingInfo]:
        symbol = self.convert_to_exchange_symbol(trading_pair)
        data = await self._api_request(
            "GET", f"{PERP_REST_URL}/fapi/v1/fundingRate",
            params={"symbol": symbol, "limit": str(min(limit, 1000))},
        )
        return [
            HBFundingInfo(
                trading_pair=self.convert_from_exchange_symbol(r["symbol"]),
                rate=float(r["fundingRate"]),
                next_funding_utc_ms="",
                timestamp_ms=str(r["fundingTime"]),
            )
            for r in data
        ]
