"""Basic Market Making Strategy for Tino.

Implements a pure market making strategy (inspired by Hummingbot) that places
layered bid and ask orders around the current mid-price to capture the spread.

  - Places ``order_levels`` layers of bid/ask orders around mid-price
  - Bid prices: mid_price * (1 - bid_spread * (i+1)) for each level i
  - Ask prices: mid_price * (1 + ask_spread * (i+1)) for each level i
  - Inventory skew adjusts order sizes to reduce directional exposure
  - Order refresh interval prevents excessive order updates

Parameters:
  bid_spread: Bid-side spread from mid-price (default 0.1%)
  ask_spread: Ask-side spread from mid-price (default 0.1%)
  order_amount: Base order size per level
  order_levels: Number of order layers on each side (default 3)
  order_refresh_time: Minimum seconds between order updates (default 15)
  inventory_skew: Inventory skew intensity 0-1 (default 0, disabled)
"""

from __future__ import annotations

import time
from typing import Any

from tino_daemon.strategies.base import Direction, Signal, Strategy


class BasicMarketMakingStrategy(Strategy):
    """Pure market making strategy that captures bid-ask spread.

    Places layered limit orders on both sides of the order book around
    the mid-price. Supports inventory skew to reduce directional risk
    when the strategy accumulates a position.
    """

    name: str = "basic_market_making"
    description: str = (
        "Pure market making strategy that captures bid-ask spread "
        "by placing layered buy/sell orders around the mid-price. "
        "Supports inventory skew to manage directional exposure. "
        "Best suited for liquid, ranging markets."
    )
    market_regime: str = "ranging"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "BasicMarketMakingStrategy Configuration",
        "description": (
            "Parameters for the basic market making strategy. "
            "Places layered bid/ask orders around mid-price to "
            "capture the spread in liquid markets."
        ),
        "type": "object",
        "properties": {
            "bid_spread": {
                "type": "number",
                "default": 0.001,
                "description": (
                    "Bid-side spread as a fraction of mid-price. "
                    "0.001 = 0.1%. Each subsequent level multiplies "
                    "this spread by (level + 1)."
                ),
                "minimum": 0.0001,
                "maximum": 0.1,
            },
            "ask_spread": {
                "type": "number",
                "default": 0.001,
                "description": (
                    "Ask-side spread as a fraction of mid-price. "
                    "0.001 = 0.1%. Each subsequent level multiplies "
                    "this spread by (level + 1)."
                ),
                "minimum": 0.0001,
                "maximum": 0.1,
            },
            "order_amount": {
                "type": "number",
                "description": (
                    "Base order size for each level. Actual sizes "
                    "may be adjusted by inventory skew."
                ),
                "exclusiveMinimum": 0,
            },
            "order_levels": {
                "type": "integer",
                "default": 3,
                "description": (
                    "Number of order layers on each side of the book. "
                    "More levels provide deeper liquidity but require "
                    "more capital."
                ),
                "minimum": 1,
                "maximum": 20,
            },
            "order_refresh_time": {
                "type": "number",
                "default": 15.0,
                "description": (
                    "Minimum interval in seconds between order refreshes. "
                    "Prevents excessive order updates and exchange rate limits."
                ),
                "minimum": 1.0,
                "maximum": 3600.0,
            },
            "inventory_skew": {
                "type": "number",
                "default": 0.0,
                "description": (
                    "Inventory skew intensity from 0 to 1. "
                    "0 = no skew (symmetric orders). "
                    "1 = full skew (aggressively rebalances inventory). "
                    "When long, reduces bid sizes and increases ask sizes."
                ),
                "minimum": 0.0,
                "maximum": 1.0,
            },
        },
        "required": ["order_amount"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol: str,
        order_amount: float,
        bid_spread: float = 0.001,
        ask_spread: float = 0.001,
        order_levels: int = 3,
        order_refresh_time: float = 15.0,
        inventory_skew: float = 0.0,
    ) -> None:
        if order_amount <= 0:
            raise ValueError("order_amount must be positive")
        if not (0.0001 <= bid_spread <= 0.1):
            raise ValueError("bid_spread must be between 0.0001 and 0.1")
        if not (0.0001 <= ask_spread <= 0.1):
            raise ValueError("ask_spread must be between 0.0001 and 0.1")
        if not (1 <= order_levels <= 20):
            raise ValueError("order_levels must be between 1 and 20")
        if not (1.0 <= order_refresh_time <= 3600.0):
            raise ValueError("order_refresh_time must be between 1.0 and 3600.0")
        if not (0.0 <= inventory_skew <= 1.0):
            raise ValueError("inventory_skew must be between 0.0 and 1.0")

        self.symbol = symbol
        self.order_amount = order_amount
        self.bid_spread = bid_spread
        self.ask_spread = ask_spread
        self.order_levels = order_levels
        self.order_refresh_time = order_refresh_time
        self.inventory_skew = inventory_skew

        # Internal state
        self._inventory: float = 0.0
        self._last_refresh_time: float = 0.0
        self._last_trade_price: float | None = None
        self._mid_price: float | None = None

    def _should_refresh(self) -> bool:
        """Check if enough time has passed since last order refresh."""
        now = time.time()
        if now - self._last_refresh_time >= self.order_refresh_time:
            return True
        return False

    def _compute_skewed_sizes(self) -> tuple[float, float]:
        """Compute bid and ask sizes adjusted for inventory skew.

        When inventory is positive (long), reduce bid size and increase ask size
        to encourage selling. Vice versa when short.

        Returns (bid_size, ask_size).
        """
        if self.inventory_skew == 0.0 or self.order_amount == 0.0:
            return self.order_amount, self.order_amount

        # Normalize inventory relative to order_amount for skew calculation
        normalized_inventory = self._inventory / self.order_amount
        skew_factor = self.inventory_skew * normalized_inventory

        # Clamp skew_factor to [-1, 1] to prevent negative sizes
        skew_factor = max(-1.0, min(1.0, skew_factor))

        bid_size = self.order_amount * (1.0 - skew_factor)
        ask_size = self.order_amount * (1.0 + skew_factor)

        # Ensure sizes are non-negative
        bid_size = max(0.0, bid_size)
        ask_size = max(0.0, ask_size)

        return bid_size, ask_size

    def _generate_orders(self, mid_price: float) -> list[Signal]:
        """Generate layered bid and ask orders around mid_price."""
        if mid_price <= 0:
            return []

        if not self._should_refresh():
            return []

        self._last_refresh_time = time.time()
        self._mid_price = mid_price
        bid_size, ask_size = self._compute_skewed_sizes()
        signals: list[Signal] = []

        for i in range(self.order_levels):
            level = i + 1
            # Bid orders (buy side)
            bid_price = mid_price * (1.0 - self.bid_spread * level)
            if bid_size > 0:
                signals.append(
                    Signal(
                        direction=Direction.LONG,
                        symbol=self.symbol,
                        size=bid_size,
                        price=bid_price,
                        metadata={
                            "level": i,
                            "side": "bid",
                            "mid_price": mid_price,
                            "inventory": self._inventory,
                        },
                    )
                )

            # Ask orders (sell side)
            ask_price = mid_price * (1.0 + self.ask_spread * level)
            if ask_size > 0:
                signals.append(
                    Signal(
                        direction=Direction.SHORT,
                        symbol=self.symbol,
                        size=ask_size,
                        price=ask_price,
                        metadata={
                            "level": i,
                            "side": "ask",
                            "mid_price": mid_price,
                            "inventory": self._inventory,
                        },
                    )
                )

        return signals

    def on_orderbook(self, orderbook: Any) -> list[Signal]:
        """Primary hook: generate orders from order book data.

        Expects orderbook to have ``best_bid`` and ``best_ask`` attributes
        (float or Decimal), or ``bids`` and ``asks`` lists where the first
        element has a price.
        """
        best_bid = getattr(orderbook, "best_bid", None)
        best_ask = getattr(orderbook, "best_ask", None)

        if best_bid is None or best_ask is None:
            # Try extracting from bids/asks lists
            bids = getattr(orderbook, "bids", None)
            asks = getattr(orderbook, "asks", None)
            if bids and asks:
                best_bid = float(bids[0][0]) if isinstance(bids[0], (list, tuple)) else float(getattr(bids[0], "price", bids[0]))
                best_ask = float(asks[0][0]) if isinstance(asks[0], (list, tuple)) else float(getattr(asks[0], "price", asks[0]))
            else:
                return []

        best_bid = float(best_bid)
        best_ask = float(best_ask)

        if best_bid <= 0 or best_ask <= 0:
            return []

        mid_price = (best_bid + best_ask) / 2.0
        return self._generate_orders(mid_price)

    def on_bar(self, bar: Any) -> list[Signal]:
        """Secondary hook: use bar close as mid-price reference.

        Expects bar to have a ``close`` attribute (float or Decimal).
        """
        close = float(getattr(bar, "close", bar))
        if close <= 0:
            return []
        return self._generate_orders(close)

    def on_trade(self, trade: Any) -> list[Signal]:
        """Update last trade price for reference. Does not generate signals.

        Expects trade to have a ``price`` attribute (float or Decimal).
        """
        price = float(getattr(trade, "price", trade))
        if price > 0:
            self._last_trade_price = price
        return []
