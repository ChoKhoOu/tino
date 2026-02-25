"""Grid Trading Strategy for Tino.

Implements a grid trading strategy that places buy and sell orders at
predetermined price levels within a defined range. Profits from price
oscillations in ranging/sideways markets.

  - Divides the price range [lower_price, upper_price] into grid_count levels
  - Arithmetic grid: evenly spaced levels (constant price gap)
  - Geometric grid: ratio-based spacing (constant percentage gap)
  - When price crosses down to a grid level -> BUY signal
  - When price crosses up to a grid level -> SELL signal
  - Tracks which grid levels have been filled to avoid duplicate signals

Parameters:
  upper_price: Upper bound of the grid range
  lower_price: Lower bound of the grid range
  grid_count: Number of grid levels (default 10)
  total_investment: Total capital allocated to the strategy
  grid_type: "arithmetic" or "geometric" (default "arithmetic")
"""

from __future__ import annotations

import math
from typing import Any

from tino_daemon.strategies.base import Direction, Signal, Strategy


class GridTradingStrategy(Strategy):
    """Grid trading strategy for ranging/sideways markets.

    Places buy and sell orders at predetermined grid price levels.
    When price drops to a grid level, generates a BUY signal.
    When price rises to a grid level, generates a SELL signal.

    Supports arithmetic (equal spacing) and geometric (equal ratio) grids.
    """

    name: str = "grid_trading"
    description: str = (
        "Grid trading strategy that profits from price oscillations "
        "by placing layered buy/sell orders at fixed price intervals "
        "within a defined range. Best suited for ranging markets."
    )
    market_regime: str = "ranging"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "GridTradingStrategy Configuration",
        "description": (
            "Parameters for the grid trading strategy. "
            "Divides a price range into grid levels and trades "
            "price oscillations between them."
        ),
        "type": "object",
        "properties": {
            "upper_price": {
                "type": "number",
                "description": (
                    "Upper bound of the grid price range. "
                    "Must be greater than lower_price."
                ),
                "exclusiveMinimum": 0,
            },
            "lower_price": {
                "type": "number",
                "description": (
                    "Lower bound of the grid price range. "
                    "Must be less than upper_price."
                ),
                "exclusiveMinimum": 0,
            },
            "grid_count": {
                "type": "integer",
                "default": 10,
                "description": (
                    "Number of grid levels between upper and lower price. "
                    "More grids capture smaller moves but require more capital."
                ),
                "minimum": 2,
                "maximum": 200,
            },
            "total_investment": {
                "type": "number",
                "description": (
                    "Total capital allocated to the grid strategy. "
                    "Divided equally among grid levels for position sizing."
                ),
                "exclusiveMinimum": 0,
            },
            "grid_type": {
                "type": "string",
                "default": "arithmetic",
                "description": (
                    "Grid spacing mode. 'arithmetic' uses equal price gaps "
                    "between levels. 'geometric' uses equal percentage gaps, "
                    "resulting in wider spacing at higher prices."
                ),
                "enum": ["arithmetic", "geometric"],
            },
        },
        "required": ["upper_price", "lower_price", "total_investment"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol: str,
        upper_price: float,
        lower_price: float,
        total_investment: float,
        grid_count: int = 10,
        grid_type: str = "arithmetic",
    ) -> None:
        if upper_price <= lower_price:
            raise ValueError("upper_price must be greater than lower_price")
        if grid_count < 2:
            raise ValueError("grid_count must be at least 2")
        if total_investment <= 0:
            raise ValueError("total_investment must be positive")
        if grid_type not in ("arithmetic", "geometric"):
            raise ValueError("grid_type must be 'arithmetic' or 'geometric'")

        self.symbol = symbol
        self.upper_price = upper_price
        self.lower_price = lower_price
        self.grid_count = grid_count
        self.total_investment = total_investment
        self.grid_type = grid_type

        self._grid_levels = self._calculate_grid_levels()
        self._size_per_grid = total_investment / (grid_count + 1)
        # Track which levels have been filled (bought).
        # A filled level means we bought at that price and wait to sell higher.
        self._filled: set[int] = set()
        # Last known price for cross detection
        self._last_price: float | None = None

    def _calculate_grid_levels(self) -> list[float]:
        """Calculate grid price levels from lower to upper.

        Returns a sorted list of grid_count + 1 price levels (including
        both boundaries).

        Arithmetic: levels[i] = lower + i * (upper - lower) / grid_count
        Geometric:  levels[i] = lower * (upper / lower) ^ (i / grid_count)
        """
        levels: list[float] = []
        if self.grid_type == "arithmetic":
            step = (self.upper_price - self.lower_price) / self.grid_count
            for i in range(self.grid_count + 1):
                levels.append(self.lower_price + i * step)
        else:  # geometric
            ratio = self.upper_price / self.lower_price
            for i in range(self.grid_count + 1):
                levels.append(
                    self.lower_price * math.pow(ratio, i / self.grid_count)
                )
        return levels

    @property
    def grid_levels(self) -> list[float]:
        """Return the computed grid price levels."""
        return list(self._grid_levels)

    def _check_signals(self, price: float) -> list[Signal]:
        """Check price against grid levels and generate signals.

        When price crosses DOWN through a grid level -> BUY signal at that level.
        When price crosses UP through a grid level -> SELL signal at that level.
        """
        if self._last_price is None:
            self._last_price = price
            return []

        signals: list[Signal] = []
        prev = self._last_price

        for i, level in enumerate(self._grid_levels):
            # Price crossed down through this level: BUY
            if prev >= level > price and i not in self._filled:
                signals.append(
                    Signal(
                        direction=Direction.LONG,
                        symbol=self.symbol,
                        size=self._size_per_grid / level,
                        price=level,
                        metadata={"grid_index": i, "grid_level": level},
                    )
                )
                self._filled.add(i)

            # Price crossed up through this level: SELL
            elif prev <= level < price and i in self._filled:
                signals.append(
                    Signal(
                        direction=Direction.SHORT,
                        symbol=self.symbol,
                        size=self._size_per_grid / level,
                        price=level,
                        metadata={"grid_index": i, "grid_level": level},
                    )
                )
                self._filled.discard(i)

        self._last_price = price
        return signals

    def on_bar(self, bar: Any) -> list[Signal]:
        """Evaluate grid signals on each new bar.

        Expects bar to have a ``close`` attribute (float or Decimal).
        """
        close = float(getattr(bar, "close", bar))
        if close <= 0:
            return []
        return self._check_signals(close)

    def on_trade(self, trade: Any) -> list[Signal]:
        """Evaluate grid signals on each tick trade.

        Expects trade to have a ``price`` attribute (float or Decimal).
        """
        price = float(getattr(trade, "price", trade))
        if price <= 0:
            return []
        return self._check_signals(price)
