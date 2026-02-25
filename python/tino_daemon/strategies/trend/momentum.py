"""RSI Momentum Strategy for Tino.

Implements a trend-following strategy based on the Relative Strength Index (RSI):
  - RSI below oversold threshold -> LONG signal (market is oversold, expect bounce)
  - RSI above overbought threshold -> SHORT signal (market is overbought, expect pullback)
  - RSI between thresholds -> no signal

Parameters:
  rsi_period: Number of bars for RSI calculation (default 14)
  overbought: RSI level above which to generate SHORT signals (default 70)
  oversold: RSI level below which to generate LONG signals (default 30)
  position_size: Fraction of equity per trade
  stop_loss_pct: Maximum loss before forced exit (optional)
"""

from __future__ import annotations

from typing import Any

import numpy as np

from tino_daemon.strategies.base import Direction, Signal, Strategy


class RSIMomentumStrategy(Strategy):
    """RSI-based momentum strategy.

    Computes RSI from bar close prices and generates directional signals
    when RSI crosses overbought/oversold thresholds. Uses pure numpy
    for RSI calculation (no ta-lib dependency).
    """

    name: str = "rsi_momentum"
    description: str = (
        "RSI momentum strategy that generates LONG signals when RSI drops "
        "below the oversold threshold and SHORT signals when RSI rises "
        "above the overbought threshold."
    )
    market_regime: str = "trending"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "RSIMomentumStrategy Configuration",
        "description": (
            "Parameters for the RSI momentum strategy. "
            "Generates signals based on RSI overbought/oversold levels."
        ),
        "type": "object",
        "properties": {
            "rsi_period": {
                "type": "integer",
                "default": 14,
                "minimum": 2,
                "maximum": 200,
                "description": (
                    "Number of bars used to calculate the RSI. "
                    "Standard value is 14. Lower values increase sensitivity."
                ),
            },
            "overbought": {
                "type": "number",
                "default": 70,
                "minimum": 50,
                "maximum": 100,
                "description": (
                    "RSI level above which the market is considered overbought. "
                    "Triggers SHORT signals."
                ),
            },
            "oversold": {
                "type": "number",
                "default": 30,
                "minimum": 0,
                "maximum": 50,
                "description": (
                    "RSI level below which the market is considered oversold. "
                    "Triggers LONG signals."
                ),
            },
            "position_size": {
                "type": "number",
                "default": 0.10,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": "Fraction of account equity to allocate per trade.",
            },
            "stop_loss_pct": {
                "type": "number",
                "minimum": 0.001,
                "maximum": 0.5,
                "description": (
                    "Maximum loss as fraction of entry price before forced exit. "
                    "Optional; omit to disable stop-loss."
                ),
            },
        },
        "required": ["position_size"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol: str = "BTC-USDT",
        rsi_period: int = 14,
        overbought: float = 70,
        oversold: float = 30,
        position_size: float = 0.10,
        stop_loss_pct: float | None = None,
    ) -> None:
        self.symbol = symbol
        self.rsi_period = rsi_period
        self.overbought = overbought
        self.oversold = oversold
        self.position_size = position_size
        self.stop_loss_pct = stop_loss_pct
        self._closes: list[float] = []

    # -- RSI calculation --

    def compute_rsi(self, closes: list[float] | np.ndarray) -> float | None:
        """Compute RSI from a sequence of close prices.

        Uses the standard Wilder smoothing method:
          deltas = diff(closes)
          avg_gain = mean of positive deltas over rsi_period
          avg_loss = mean of abs(negative deltas) over rsi_period
          RS = avg_gain / avg_loss
          RSI = 100 - (100 / (1 + RS))

        Returns None if insufficient data (need at least rsi_period + 1 prices).
        """
        prices = np.asarray(closes, dtype=np.float64)
        if len(prices) < self.rsi_period + 1:
            return None

        deltas = np.diff(prices)
        # Use the last rsi_period deltas
        recent = deltas[-(self.rsi_period) :]
        gains = np.where(recent > 0, recent, 0.0)
        losses = np.where(recent < 0, -recent, 0.0)

        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return float(rsi)

    # -- Strategy hooks --

    def _process_price(self, price: float) -> list[Signal]:
        """Append price, trim buffer, compute RSI, and return signals."""
        self._closes.append(price)

        # Keep only the data needed for RSI calculation
        max_len = self.rsi_period + 1
        if len(self._closes) > max_len * 2:
            self._closes = self._closes[-max_len:]

        rsi = self.compute_rsi(self._closes)
        if rsi is None:
            return []

        if rsi < self.oversold:
            return [
                Signal(
                    direction=Direction.LONG,
                    symbol=self.symbol,
                    size=self.position_size,
                    price=price,
                    metadata={"rsi": rsi},
                )
            ]
        elif rsi > self.overbought:
            return [
                Signal(
                    direction=Direction.SHORT,
                    symbol=self.symbol,
                    size=self.position_size,
                    price=price,
                    metadata={"rsi": rsi},
                )
            ]
        return []

    def on_bar(self, bar: Any) -> list[Signal]:
        """Process a new bar and generate signals based on RSI.

        Expects bar to have a ``close`` attribute (float or convertible).
        """
        close = float(bar.close) if hasattr(bar, "close") else float(bar)
        return self._process_price(close)

    def on_trade(self, trade: Any) -> list[Signal]:
        """Process a tick trade.

        Delegates to the same RSI logic as on_bar by treating the
        trade price as a close price.
        """
        price = float(trade.price) if hasattr(trade, "price") else float(trade)
        return self._process_price(price)
