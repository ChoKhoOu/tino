"""OrderbookSimulator — simulated order matching against real-time prices."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable

logger = logging.getLogger(__name__)


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


@dataclass
class PaperOrder:
    """A simulated order in the paper trading engine."""

    id: str
    instrument: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: float
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    filled_price: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    filled_at: str = ""
    fee: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "instrument": self.instrument,
            "side": self.side.value,
            "type": self.order_type.value,
            "quantity": self.quantity,
            "price": self.price,
            "status": self.status.value,
            "filled_quantity": self.filled_quantity,
            "filled_price": self.filled_price,
            "timestamp": self.created_at,
            "filled_at": self.filled_at,
            "fee": self.fee,
        }


# Default fee rates (taker/maker)
DEFAULT_TAKER_FEE = 0.0004  # 0.04% (Binance futures VIP0)
DEFAULT_MAKER_FEE = 0.0002  # 0.02%


class OrderbookSimulator:
    """Simulates order matching against real-time prices.

    Market orders fill immediately at the current price.
    Limit orders fill when the market price crosses the order price.
    Fees are calculated based on configurable taker/maker rates.
    """

    def __init__(
        self,
        *,
        taker_fee: float = DEFAULT_TAKER_FEE,
        maker_fee: float = DEFAULT_MAKER_FEE,
        slippage_bps: float = 1.0,
        on_fill: Callable[[PaperOrder], None] | None = None,
    ) -> None:
        self._taker_fee = taker_fee
        self._maker_fee = maker_fee
        self._slippage_bps = slippage_bps
        self._on_fill = on_fill
        self._open_orders: dict[str, PaperOrder] = {}
        self._filled_orders: list[PaperOrder] = []
        self._all_orders: list[PaperOrder] = []

    @property
    def open_orders(self) -> list[PaperOrder]:
        return list(self._open_orders.values())

    @property
    def filled_orders(self) -> list[PaperOrder]:
        return list(self._filled_orders)

    @property
    def all_orders(self) -> list[PaperOrder]:
        return list(self._all_orders)

    def submit_order(
        self,
        *,
        instrument: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float = 0.0,
        current_price: float | None = None,
    ) -> PaperOrder:
        """Submit a new simulated order.

        For MARKET orders, fills immediately if current_price is provided.
        For LIMIT orders, queues for later matching.
        """
        order = PaperOrder(
            id=str(uuid.uuid4())[:8],
            instrument=instrument,
            side=OrderSide(side.upper()),
            order_type=OrderType(order_type.upper()),
            quantity=quantity,
            price=price,
        )
        self._all_orders.append(order)

        if order.order_type == OrderType.MARKET:
            if current_price is not None and current_price > 0:
                self._fill_order(order, current_price, is_taker=True)
            else:
                # Queue market order for next price tick
                self._open_orders[order.id] = order
        else:
            # Limit order: check immediate fill possibility
            if current_price is not None and self._should_fill_limit(order, current_price):
                self._fill_order(order, order.price, is_taker=False)
            else:
                self._open_orders[order.id] = order

        return order

    def cancel_order(self, order_id: str) -> bool:
        """Cancel a pending order. Returns True if cancelled."""
        order = self._open_orders.pop(order_id, None)
        if order is None:
            return False
        order.status = OrderStatus.CANCELLED
        return True

    def cancel_all(self, instrument: str | None = None) -> int:
        """Cancel all open orders, optionally filtered by instrument."""
        to_cancel = [
            oid
            for oid, o in self._open_orders.items()
            if instrument is None or o.instrument == instrument
        ]
        for oid in to_cancel:
            self._open_orders[oid].status = OrderStatus.CANCELLED
            del self._open_orders[oid]
        return len(to_cancel)

    def on_price_update(self, instrument: str, price: float) -> list[PaperOrder]:
        """Process a price update and fill matching orders.

        Returns list of orders that were filled.
        """
        filled: list[PaperOrder] = []

        to_remove: list[str] = []
        for oid, order in self._open_orders.items():
            if order.instrument != instrument:
                continue

            if order.order_type == OrderType.MARKET:
                # Market orders fill at current price with slippage
                self._fill_order(order, price, is_taker=True)
                to_remove.append(oid)
                filled.append(order)
            elif self._should_fill_limit(order, price):
                # Limit order price crossed
                self._fill_order(order, order.price, is_taker=False)
                to_remove.append(oid)
                filled.append(order)

        for oid in to_remove:
            self._open_orders.pop(oid, None)

        return filled

    def _should_fill_limit(self, order: PaperOrder, market_price: float) -> bool:
        """Check if a limit order should fill at the given market price."""
        if order.side == OrderSide.BUY:
            # Buy limit fills when market price <= order price
            return market_price <= order.price
        else:
            # Sell limit fills when market price >= order price
            return market_price >= order.price

    def _fill_order(self, order: PaperOrder, fill_price: float, *, is_taker: bool) -> None:
        """Fill an order at the given price with fee calculation."""
        # Apply slippage for market/taker orders
        if is_taker:
            slippage_mult = self._slippage_bps / 10000.0
            if order.side == OrderSide.BUY:
                fill_price *= 1 + slippage_mult
            else:
                fill_price *= 1 - slippage_mult

        fee_rate = self._taker_fee if is_taker else self._maker_fee
        notional = fill_price * order.quantity
        fee = notional * fee_rate

        order.status = OrderStatus.FILLED
        order.filled_quantity = order.quantity
        order.filled_price = fill_price
        order.fee = fee
        order.filled_at = datetime.now(timezone.utc).isoformat()

        self._filled_orders.append(order)

        logger.debug(
            "Paper fill: %s %s %.4f %s @ %.6f (fee=%.6f)",
            order.side.value,
            order.instrument,
            order.quantity,
            order.order_type.value,
            fill_price,
            fee,
        )

        if self._on_fill:
            self._on_fill(order)

    def get_order(self, order_id: str) -> PaperOrder | None:
        """Look up any order by ID."""
        if order_id in self._open_orders:
            return self._open_orders[order_id]
        for o in self._all_orders:
            if o.id == order_id:
                return o
        return None

    def trim_history(self, max_filled: int = 10000) -> None:
        """Trim filled order history to prevent unbounded memory growth."""
        if len(self._filled_orders) > max_filled:
            self._filled_orders = self._filled_orders[-max_filled:]
        if len(self._all_orders) > max_filled * 2:
            self._all_orders = self._all_orders[-max_filled * 2 :]
