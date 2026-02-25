"""Bollinger Band Mean Reversion Strategy for Tino.

Implements a mean-reversion strategy based on Bollinger Bands:
  - Computes middle band as SMA(period) of close prices
  - Upper band = middle + std_dev * StdDev(period)
  - Lower band = middle - std_dev * StdDev(period)
  - Price touches lower band -> LONG (oversold)
  - Price touches upper band -> SHORT (overbought)

Parameters:
  period: Bollinger Band lookback period (default 20)
  std_dev: Standard deviation multiplier (default 2.0)
  position_size: Fraction of equity per trade
  stop_loss_pct: Maximum loss before exit (default 0.03)
  take_profit_pct: Profit target for exit (default 0.02)
"""

from __future__ import annotations

from collections import deque
from typing import Any

import numpy as np

from tino_daemon.strategies.base import Direction, Signal, Strategy


class BollingerReversionStrategy(Strategy):
    """Bollinger Band mean reversion strategy.

    Generates LONG signals when price touches the lower band (oversold)
    and SHORT signals when price touches the upper band (overbought).
    Suitable for ranging/sideways markets.
    """

    name: str = "bollinger_reversion"
    description: str = (
        "Bollinger Band mean reversion strategy that trades oversold/overbought "
        "conditions when price touches the lower/upper bands."
    )
    market_regime: str = "ranging"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "BollingerReversionStrategy Configuration",
        "description": (
            "Parameters for the Bollinger Band mean reversion strategy. "
            "Trades mean-reversion when price deviates beyond Bollinger Bands."
        ),
        "type": "object",
        "properties": {
            "period": {
                "type": "integer",
                "default": 20,
                "minimum": 2,
                "maximum": 500,
                "description": (
                    "Bollinger Band lookback period for SMA and standard deviation calculation."
                ),
            },
            "std_dev": {
                "type": "number",
                "default": 2.0,
                "minimum": 0.1,
                "maximum": 5.0,
                "description": (
                    "Standard deviation multiplier for upper and lower bands. "
                    "Higher values mean wider bands and fewer signals."
                ),
            },
            "position_size": {
                "type": "number",
                "default": 0.1,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": "Fraction of account equity to allocate per trade.",
            },
            "stop_loss_pct": {
                "type": "number",
                "default": 0.03,
                "minimum": 0.001,
                "maximum": 0.5,
                "description": "Maximum loss as fraction of entry price before forced exit.",
            },
            "take_profit_pct": {
                "type": "number",
                "default": 0.02,
                "minimum": 0.001,
                "maximum": 1.0,
                "description": "Profit target as fraction of entry price for exit.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(
        self,
        period: int = 20,
        std_dev: float = 2.0,
        position_size: float = 0.1,
        stop_loss_pct: float = 0.03,
        take_profit_pct: float = 0.02,
    ) -> None:
        self.period = period
        self.std_dev = std_dev
        self.position_size = position_size
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self._prices: deque[float] = deque(maxlen=period)

    def _compute_bands(self) -> tuple[float, float, float] | None:
        """Compute Bollinger Bands from buffered prices.

        Returns (lower, middle, upper) or None if insufficient data.
        """
        if len(self._prices) < self.period:
            return None

        prices = np.array(self._prices)
        middle = float(np.mean(prices))
        std = float(np.std(prices, ddof=0))
        upper = middle + self.std_dev * std
        lower = middle - self.std_dev * std
        return lower, middle, upper

    def _evaluate(self, price: float, symbol: str) -> list[Signal]:
        """Core signal logic shared by on_bar and on_trade."""
        self._prices.append(price)
        bands = self._compute_bands()
        if bands is None:
            return []

        lower, middle, upper = bands
        signals: list[Signal] = []

        if price <= lower:
            signals.append(
                Signal(
                    direction=Direction.LONG,
                    symbol=symbol,
                    size=self.position_size,
                    price=price,
                    metadata={
                        "lower": lower,
                        "middle": middle,
                        "upper": upper,
                    },
                )
            )
        elif price >= upper:
            signals.append(
                Signal(
                    direction=Direction.SHORT,
                    symbol=symbol,
                    size=self.position_size,
                    price=price,
                    metadata={
                        "lower": lower,
                        "middle": middle,
                        "upper": upper,
                    },
                )
            )

        return signals

    def on_bar(self, bar: Any) -> list[Signal]:
        """Evaluate bar close price against Bollinger Bands."""
        close = float(bar.get("close", 0)) if isinstance(bar, dict) else float(getattr(bar, "close", 0))
        symbol = bar.get("symbol", "UNKNOWN") if isinstance(bar, dict) else getattr(bar, "symbol", "UNKNOWN")
        if close <= 0:
            return []
        return self._evaluate(close, symbol)

    def on_trade(self, trade: Any) -> list[Signal]:
        """Evaluate trade price against Bollinger Bands."""
        price = float(trade.get("price", 0)) if isinstance(trade, dict) else float(getattr(trade, "price", 0))
        symbol = trade.get("symbol", "UNKNOWN") if isinstance(trade, dict) else getattr(trade, "symbol", "UNKNOWN")
        if price <= 0:
            return []
        return self._evaluate(price, symbol)
