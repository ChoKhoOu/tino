"""Base class for vendored Hummingbot connectors.

Adapted from Hummingbot's ConnectorBase / ExchangePyBase pattern but simplified
to a lightweight REST-only client using httpx. No WebSocket, no order tracking,
no Clock integration — just the REST API interaction layer that Tino needs.
"""

from __future__ import annotations

import abc
import logging
from dataclasses import dataclass

import httpx

from tino_daemon.exchanges.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HBTicker:
    """Hummingbot-style ticker data."""

    trading_pair: str
    last_price: float
    best_bid: float
    best_ask: float
    volume: float
    high: float
    low: float
    timestamp_ms: int


@dataclass(frozen=True)
class HBCandle:
    """Hummingbot-style candlestick/kline data."""

    timestamp_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_timestamp_ms: int


@dataclass(frozen=True)
class HBOrderBookEntry:
    price: float
    amount: float


@dataclass(frozen=True)
class HBOrderBook:
    bids: list[HBOrderBookEntry]
    asks: list[HBOrderBookEntry]
    timestamp_ms: int


@dataclass(frozen=True)
class HBFundingInfo:
    trading_pair: str
    rate: float
    next_funding_utc_ms: str
    timestamp_ms: str


@dataclass(frozen=True)
class HBBalance:
    asset: str
    available: float
    total: float


@dataclass(frozen=True)
class HBPosition:
    trading_pair: str
    side: str  # "LONG" or "SHORT"
    amount: float
    entry_price: float
    unrealized_pnl: float
    leverage: float
    mark_price: float
    liquidation_price: float
    margin_mode: str  # "cross" or "isolated"


@dataclass(frozen=True)
class HBOrderResult:
    exchange_order_id: str
    success: bool
    message: str


@dataclass(frozen=True)
class HBMarkPrice:
    mark_price: float
    index_price: float
    timestamp_ms: str


class HummingbotConnectorBase(abc.ABC):
    """Abstract base for vendored Hummingbot REST connectors.

    Subclasses implement exchange-specific API calls, returning
    HB-prefixed data types. The HummingbotAdapter then converts
    these to Tino's BaseExchangeConnector types.
    """

    def __init__(self, timeout: float = 10.0, rate_limit: int = 600) -> None:
        self._client = httpx.AsyncClient(timeout=timeout)
        self._rate_limiter = RateLimiter(max_calls=rate_limit, window_seconds=60.0)

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Exchange name as used in Hummingbot (e.g. 'binance')."""
        ...

    @abc.abstractmethod
    async def get_ticker(self, trading_pair: str) -> HBTicker:
        ...

    @abc.abstractmethod
    async def get_candles(
        self,
        trading_pair: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[HBCandle]:
        ...

    @abc.abstractmethod
    async def get_funding_info(self, trading_pair: str) -> HBFundingInfo:
        ...

    @abc.abstractmethod
    async def get_order_book(self, trading_pair: str, depth: int = 20) -> HBOrderBook:
        ...

    @abc.abstractmethod
    async def get_balances(self) -> list[HBBalance]:
        ...

    @abc.abstractmethod
    async def get_positions(self, trading_pair: str | None = None) -> list[HBPosition]:
        ...

    @abc.abstractmethod
    async def place_order(
        self,
        trading_pair: str,
        side: str,
        order_type: str,
        amount: float,
        price: float | None = None,
    ) -> HBOrderResult:
        ...

    @abc.abstractmethod
    async def cancel_order(
        self, trading_pair: str, exchange_order_id: str
    ) -> HBOrderResult:
        ...

    @abc.abstractmethod
    async def set_leverage(self, trading_pair: str, leverage: int) -> bool:
        ...

    @abc.abstractmethod
    async def set_position_mode(
        self, trading_pair: str, mode: str, leverage: int = 1
    ) -> bool:
        ...

    @abc.abstractmethod
    async def get_mark_price(self, trading_pair: str) -> HBMarkPrice:
        ...

    @abc.abstractmethod
    async def get_funding_rate_history(
        self, trading_pair: str, limit: int = 100
    ) -> list[HBFundingInfo]:
        ...

    async def close(self) -> None:
        """Release HTTP resources."""
        await self._client.aclose()
