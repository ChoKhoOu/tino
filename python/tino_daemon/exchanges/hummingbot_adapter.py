"""HummingbotAdapter — bridges vendored Hummingbot connectors to Tino's BaseExchangeConnector.

This adapter wraps any vendored Hummingbot connector (HummingbotConnectorBase) and
exposes it through Tino's unified BaseExchangeConnector interface, converting between
Hummingbot's HB-prefixed data types and Tino's protobuf-aligned data types.

Usage:
    adapter = HummingbotAdapter("binance")  # uses vendored HB Binance connector
    ticker = await adapter.get_ticker("BTCUSDT")  # returns Tino Ticker type
"""

from __future__ import annotations

import logging

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
)
from tino_daemon.vendors.hummingbot import get_hb_connector
from tino_daemon.vendors.hummingbot.connector import HummingbotConnectorBase

logger = logging.getLogger(__name__)


class HummingbotAdapter(BaseExchangeConnector):
    """Adapter bridging a vendored Hummingbot connector to Tino's exchange interface.

    Converts between Hummingbot's data types (HBTicker, HBCandle, etc.) and
    Tino's BaseExchangeConnector types (Ticker, Kline, etc.) so that
    Hummingbot-backed exchanges integrate seamlessly with Tino's gRPC services.

    Args:
        exchange: The exchange name to look up in the vendored HB registry.
        prefix: Optional name prefix (default "hb-") used for the connector name
                returned by the ``name`` property.
    """

    def __init__(self, exchange: str, prefix: str = "hb-") -> None:
        self._exchange = exchange.strip().lower()
        self._prefix = prefix
        self._hb: HummingbotConnectorBase = get_hb_connector(self._exchange)

    @property
    def name(self) -> str:
        return f"{self._prefix}{self._exchange}"

    async def get_ticker(self, symbol: str) -> "Ticker":
        from tino_daemon.exchanges.base_connector import Ticker

        hb = await self._hb.get_ticker(symbol)
        return Ticker(
            symbol=symbol,
            last_price=hb.last_price,
            bid_price=hb.best_bid,
            ask_price=hb.best_ask,
            volume_24h=hb.volume,
            high_24h=hb.high,
            low_24h=hb.low,
            timestamp=str(hb.timestamp_ms),
        )

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 100,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> list[Kline]:
        candles = await self._hb.get_candles(
            symbol, interval=interval, limit=limit,
            start_time=start_time, end_time=end_time,
        )
        return [
            Kline(
                open_time=c.timestamp_ms,
                open=c.open,
                high=c.high,
                low=c.low,
                close=c.close,
                volume=c.volume,
                close_time=c.close_timestamp_ms,
            )
            for c in candles
        ]

    async def get_funding_rate(self, symbol: str) -> FundingRate:
        hb = await self._hb.get_funding_info(symbol)
        return FundingRate(
            symbol=symbol,
            funding_rate=hb.rate,
            next_funding_time=hb.next_funding_utc_ms,
            timestamp=hb.timestamp_ms,
        )

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Orderbook:
        hb = await self._hb.get_order_book(symbol, depth=limit)
        return Orderbook(
            bids=[
                OrderbookLevel(price=e.price, quantity=e.amount)
                for e in hb.bids
            ],
            asks=[
                OrderbookLevel(price=e.price, quantity=e.amount)
                for e in hb.asks
            ],
            timestamp=str(hb.timestamp_ms),
        )

    async def get_account_balance(self) -> list[Balance]:
        hb_balances = await self._hb.get_balances()
        return [
            Balance(
                asset=b.asset,
                free=b.available,
                locked=b.total - b.available,
                total=b.total,
            )
            for b in hb_balances
        ]

    async def get_positions(self, symbol: str | None = None) -> list[Position]:
        hb_positions = await self._hb.get_positions(symbol)
        return [
            Position(
                symbol=p.trading_pair,
                side=p.side,
                quantity=p.amount,
                entry_price=p.entry_price,
                unrealized_pnl=p.unrealized_pnl,
                leverage=p.leverage,
                mark_price=p.mark_price,
                liquidation_price=p.liquidation_price,
                margin_type=(
                    MarginType.ISOLATED if p.margin_mode == "isolated"
                    else MarginType.CROSS
                ),
            )
            for p in hb_positions
        ]

    async def place_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float | None = None,
        **kwargs: object,
    ) -> OrderResult:
        hb = await self._hb.place_order(
            symbol, side=side, order_type=order_type,
            amount=quantity, price=price,
        )
        return OrderResult(
            order_id=hb.exchange_order_id,
            success=hb.success,
            message=hb.message,
        )

    async def cancel_order(self, symbol: str, order_id: str) -> OrderResult:
        hb = await self._hb.cancel_order(symbol, order_id)
        return OrderResult(
            order_id=hb.exchange_order_id,
            success=hb.success,
            message=hb.message,
        )

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        return await self._hb.set_leverage(symbol, leverage)

    async def set_margin_type(
        self, symbol: str, margin_type: MarginType, leverage: int = 1
    ) -> bool:
        mode = "isolated" if margin_type == MarginType.ISOLATED else "cross"
        return await self._hb.set_position_mode(symbol, mode, leverage)

    async def get_mark_price(self, symbol: str) -> MarkPriceInfo:
        hb = await self._hb.get_mark_price(symbol)
        return MarkPriceInfo(
            mark_price=hb.mark_price,
            index_price=hb.index_price,
            timestamp=hb.timestamp_ms,
        )

    async def get_funding_rate_history(
        self, symbol: str, limit: int = 100
    ) -> list[FundingRate]:
        hb_history = await self._hb.get_funding_rate_history(symbol, limit)
        return [
            FundingRate(
                symbol=symbol,
                funding_rate=r.rate,
                next_funding_time="",
                timestamp=r.timestamp_ms,
            )
            for r in hb_history
        ]

    async def close(self) -> None:
        await self._hb.close()
