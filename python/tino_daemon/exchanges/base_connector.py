"""BaseExchangeConnector — abstract base class for exchange adapters."""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class Ticker:
    symbol: str
    last_price: float
    bid_price: float
    ask_price: float
    volume_24h: float
    high_24h: float
    low_24h: float
    timestamp: str


@dataclass(frozen=True)
class Kline:
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    close_time: int


@dataclass(frozen=True)
class FundingRate:
    symbol: str
    funding_rate: float
    next_funding_time: str
    timestamp: str


@dataclass(frozen=True)
class OrderbookLevel:
    price: float
    quantity: float


@dataclass(frozen=True)
class Orderbook:
    bids: list[OrderbookLevel]
    asks: list[OrderbookLevel]
    timestamp: str


@dataclass(frozen=True)
class Balance:
    asset: str
    free: float
    locked: float
    total: float


@dataclass(frozen=True)
class Position:
    symbol: str
    side: str
    quantity: float
    entry_price: float
    unrealized_pnl: float
    leverage: float


@dataclass(frozen=True)
class OrderResult:
    order_id: str
    success: bool
    message: str


class BaseExchangeConnector(abc.ABC):
    """Abstract base class defining the unified exchange interface.

    All exchange adapters must implement these methods. Market data methods
    (get_ticker, get_klines, get_funding_rate, get_orderbook) are required.
    Trading methods (place_order, cancel_order) and account methods
    (get_positions, get_account_balance) may raise NotImplementedError
    if not yet supported for a given exchange.
    """

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Return the canonical exchange name (e.g. 'binance', 'okx', 'bybit')."""
        ...

    @abc.abstractmethod
    async def get_ticker(self, symbol: str) -> Ticker:
        """Query latest ticker/market data for a symbol."""
        ...

    @abc.abstractmethod
    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[Kline]:
        """Query kline/candlestick data."""
        ...

    @abc.abstractmethod
    async def get_funding_rate(self, symbol: str) -> FundingRate:
        """Query current funding rate for a perpetual futures symbol."""
        ...

    @abc.abstractmethod
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        """Query order book depth."""
        ...

    @abc.abstractmethod
    async def get_account_balance(self) -> list[Balance]:
        """Query account balances. Requires API credentials."""
        ...

    @abc.abstractmethod
    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        """Query open positions. Requires API credentials."""
        ...

    @abc.abstractmethod
    async def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float | None = None,
    ) -> OrderResult:
        """Place an order. Requires API credentials."""
        ...

    @abc.abstractmethod
    async def cancel_order(
        self,
        symbol: str,
        order_id: str,
    ) -> OrderResult:
        """Cancel an order. Requires API credentials."""
        ...

    async def close(self) -> None:
        """Clean up resources (e.g. HTTP client). Override if needed."""
        pass
