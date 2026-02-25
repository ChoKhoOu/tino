"""MA Crossover Trend Following Strategy.

Implements a dual moving average crossover strategy:
  - Computes fast and slow moving averages (SMA or EMA) on bar close prices
  - Golden cross (fast crosses above slow) -> LONG signal
  - Death cross (fast crosses below slow) -> SHORT signal
  - Tracks previous MA values to detect crossover events

Parameters:
  fast_period: Fast MA period (default 10)
  slow_period: Slow MA period (default 30)
  ma_type: Moving average type, SMA or EMA (default SMA)
  position_size: Position size as fraction of equity (default 0.1)
  stop_loss_pct: Stop-loss percentage, optional (default None)
"""

from __future__ import annotations

from typing import Any

import numpy as np

from tino_daemon.strategies.base import Direction, Signal, Strategy


class MACrossoverStrategy(Strategy):
    """Dual moving average crossover trend following strategy.

    Uses fast and slow moving averages to generate trend-following signals.
    Golden cross (fast > slow after fast <= slow) emits LONG.
    Death cross (fast < slow after fast >= slow) emits SHORT.
    """

    name: str = "ma_crossover"
    description: str = (
        "Dual moving average crossover trend following strategy. "
        "Golden cross signals LONG, death cross signals SHORT."
    )
    market_regime: str = "trending"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "MACrossoverStrategy Configuration",
        "description": (
            "Parameters for the dual moving average crossover strategy. "
            "Trades trend reversals detected by fast/slow MA crossover events."
        ),
        "type": "object",
        "properties": {
            "fast_period": {
                "type": "integer",
                "default": 10,
                "minimum": 2,
                "maximum": 200,
                "description": "Fast moving average period. Shorter period reacts faster to price changes.",
            },
            "slow_period": {
                "type": "integer",
                "default": 30,
                "minimum": 5,
                "maximum": 500,
                "description": "Slow moving average period. Must be greater than fast_period.",
            },
            "ma_type": {
                "type": "string",
                "default": "SMA",
                "enum": ["SMA", "EMA"],
                "description": "Moving average type. SMA (Simple) or EMA (Exponential).",
            },
            "position_size": {
                "type": "number",
                "default": 0.1,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": "Position size as fraction of account equity per trade.",
            },
            "stop_loss_pct": {
                "type": "number",
                "default": None,
                "minimum": 0.001,
                "maximum": 0.5,
                "description": "Optional stop-loss as fraction of entry price. None disables stop-loss.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol: str = "BTC/USDT",
        fast_period: int = 10,
        slow_period: int = 30,
        ma_type: str = "SMA",
        position_size: float = 0.1,
        stop_loss_pct: float | None = None,
    ) -> None:
        self.symbol = symbol
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.ma_type = ma_type.upper()
        self.position_size = position_size
        self.stop_loss_pct = stop_loss_pct

        # Price history buffer for MA computation
        self._prices: list[float] = []
        # Previous MA values for crossover detection (None = not yet computed)
        self._prev_fast_ma: float | None = None
        self._prev_slow_ma: float | None = None

    # -- MA computation --

    @staticmethod
    def _compute_sma(prices: np.ndarray, period: int) -> float:
        """Compute Simple Moving Average over the last `period` prices."""
        return float(np.mean(prices[-period:]))

    @staticmethod
    def _compute_ema(prices: np.ndarray, period: int) -> float:
        """Compute Exponential Moving Average over the full price array.

        Uses the standard EMA formula with multiplier 2/(period+1).
        Seeds the EMA with the SMA of the first `period` values.
        """
        if len(prices) < period:
            return float(np.mean(prices))
        multiplier = 2.0 / (period + 1)
        ema = float(np.mean(prices[:period]))
        for price in prices[period:]:
            ema = (float(price) - ema) * multiplier + ema
        return ema

    def _compute_ma(self, prices: np.ndarray, period: int) -> float:
        """Compute moving average based on configured ma_type."""
        if self.ma_type == "EMA":
            return self._compute_ema(prices, period)
        return self._compute_sma(prices, period)

    # -- Strategy hooks --

    def on_bar(self, bar: Any) -> list[Signal]:
        """Process a new bar and emit crossover signals.

        Expects ``bar`` to have a ``close`` attribute (float or convertible).
        Returns a list with at most one Signal on crossover, empty otherwise.
        """
        close = float(bar.close) if hasattr(bar, "close") else float(bar)
        self._prices.append(close)

        # Need at least slow_period prices to compute both MAs
        if len(self._prices) < self.slow_period:
            return []

        prices_arr = np.array(self._prices)
        fast_ma = self._compute_ma(prices_arr, self.fast_period)
        slow_ma = self._compute_ma(prices_arr, self.slow_period)

        signals: list[Signal] = []

        # Detect crossover only when we have previous values
        if self._prev_fast_ma is not None and self._prev_slow_ma is not None:
            prev_diff = self._prev_fast_ma - self._prev_slow_ma
            curr_diff = fast_ma - slow_ma

            # Golden cross: fast crosses above slow
            if prev_diff <= 0 and curr_diff > 0:
                signals.append(
                    Signal(
                        direction=Direction.LONG,
                        symbol=self.symbol,
                        size=self.position_size,
                        price=close,
                        metadata={
                            "event": "golden_cross",
                            "fast_ma": fast_ma,
                            "slow_ma": slow_ma,
                            "ma_type": self.ma_type,
                        },
                    )
                )

            # Death cross: fast crosses below slow
            elif prev_diff >= 0 and curr_diff < 0:
                signals.append(
                    Signal(
                        direction=Direction.SHORT,
                        symbol=self.symbol,
                        size=self.position_size,
                        price=close,
                        metadata={
                            "event": "death_cross",
                            "fast_ma": fast_ma,
                            "slow_ma": slow_ma,
                            "ma_type": self.ma_type,
                        },
                    )
                )

        self._prev_fast_ma = fast_ma
        self._prev_slow_ma = slow_ma

        return signals

    def on_trade(self, trade: Any) -> list[Signal]:
        """Process a tick trade. Delegates to on_bar for signal generation."""
        return []
