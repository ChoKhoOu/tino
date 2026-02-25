"""Pairs Trading Strategy using Cointegration (Engle-Granger) for Tino.

Implements a pairs trading strategy based on cointegration:
  - Tracks prices for two correlated assets (symbol_a, symbol_b)
  - Computes hedge ratio via OLS regression
  - Tests for cointegration using simplified Engle-Granger method
  - Spread = price_a - hedge_ratio * price_b
  - Z-score of spread > entry_zscore -> SHORT symbol_a + LONG symbol_b
  - Z-score of spread < -entry_zscore -> LONG symbol_a + SHORT symbol_b
  - abs(Z-score) < exit_zscore -> FLAT signals to close positions

Parameters:
  symbol_a: First symbol in the pair (default BTCUSDT)
  symbol_b: Second symbol in the pair (default ETHUSDT)
  lookback_period: Cointegration lookback period (default 60)
  entry_zscore: Z-score threshold to enter positions (default 2.0)
  exit_zscore: Z-score threshold to exit positions (default 0.5)
  position_size: Fraction of equity per trade (default 0.1)
"""

from __future__ import annotations

from collections import deque
from typing import Any

import numpy as np

from tino_daemon.strategies.base import Direction, Signal, Strategy


class PairsTradingStrategy(Strategy):
    """Pairs trading strategy using cointegration (Engle-Granger method).

    Generates hedged trading signals when the spread between two cointegrated
    assets deviates significantly from its mean. Suitable for ranging markets
    where two assets maintain a stable long-run relationship.
    """

    name: str = "pairs_trading"
    description: str = (
        "Pairs trading strategy using cointegration (Engle-Granger method) "
        "that trades spread deviations between two correlated assets."
    )
    market_regime: str = "ranging"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "PairsTradingStrategy Configuration",
        "description": (
            "Parameters for the pairs trading strategy using cointegration. "
            "Trades spread mean-reversion between two correlated assets."
        ),
        "type": "object",
        "properties": {
            "symbol_a": {
                "type": "string",
                "default": "BTCUSDT",
                "description": "First symbol in the trading pair.",
            },
            "symbol_b": {
                "type": "string",
                "default": "ETHUSDT",
                "description": "Second symbol in the trading pair.",
            },
            "lookback_period": {
                "type": "integer",
                "default": 60,
                "minimum": 10,
                "maximum": 500,
                "description": (
                    "Lookback period for cointegration test and spread calculation."
                ),
            },
            "entry_zscore": {
                "type": "number",
                "default": 2.0,
                "minimum": 0.5,
                "maximum": 5.0,
                "description": (
                    "Z-score threshold to enter a pairs trade. "
                    "Higher values mean fewer but stronger signals."
                ),
            },
            "exit_zscore": {
                "type": "number",
                "default": 0.5,
                "minimum": 0.0,
                "maximum": 3.0,
                "description": (
                    "Z-score threshold to exit a pairs trade. "
                    "Positions are closed when abs(z-score) falls below this level."
                ),
            },
            "position_size": {
                "type": "number",
                "default": 0.1,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": "Fraction of account equity to allocate per trade.",
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol_a: str = "BTCUSDT",
        symbol_b: str = "ETHUSDT",
        lookback_period: int = 60,
        entry_zscore: float = 2.0,
        exit_zscore: float = 0.5,
        position_size: float = 0.1,
    ) -> None:
        self.symbol_a = symbol_a
        self.symbol_b = symbol_b
        self.lookback_period = lookback_period
        self.entry_zscore = entry_zscore
        self.exit_zscore = exit_zscore
        self.position_size = position_size
        self._prices: dict[str, deque[float]] = {
            symbol_a: deque(maxlen=lookback_period),
            symbol_b: deque(maxlen=lookback_period),
        }

    def _compute_hedge_ratio(
        self, prices_a: np.ndarray, prices_b: np.ndarray
    ) -> float:
        """Compute hedge ratio via OLS regression: price_a = beta * price_b + alpha."""
        # OLS: beta = cov(a, b) / var(b)
        var_b = float(np.var(prices_b, ddof=1))
        if var_b == 0:
            return 0.0
        beta = float(np.cov(prices_a, prices_b)[0, 1] / var_b)
        return beta

    def _check_cointegration(self, residuals: np.ndarray) -> bool:
        """Simplified ADF-like stationarity check on residuals.

        Uses a first-order autoregression test: regress diff(residuals) on
        lagged residuals. If the coefficient is sufficiently negative (< -0.5),
        we consider the residuals stationary (cointegrated).
        """
        if len(residuals) < 3:
            return False
        diff = np.diff(residuals)
        lagged = residuals[:-1]
        # OLS: diff = gamma * lagged + error
        # gamma = cov(diff, lagged) / var(lagged)
        var_lagged = float(np.var(lagged, ddof=1))
        if var_lagged == 0:
            return False
        gamma = float(np.cov(diff, lagged)[0, 1] / var_lagged)
        return gamma < -0.5

    def _compute_spread_and_zscore(
        self,
    ) -> tuple[float, float, float, bool] | None:
        """Compute spread, z-score, hedge ratio, and cointegration status.

        Returns (zscore, spread, hedge_ratio, is_cointegrated) or None if
        insufficient data.
        """
        prices_a = self._prices[self.symbol_a]
        prices_b = self._prices[self.symbol_b]

        if (
            len(prices_a) < self.lookback_period
            or len(prices_b) < self.lookback_period
        ):
            return None

        arr_a = np.array(prices_a)
        arr_b = np.array(prices_b)

        hedge_ratio = self._compute_hedge_ratio(arr_a, arr_b)
        spread = arr_a - hedge_ratio * arr_b
        residuals = spread

        is_cointegrated = self._check_cointegration(residuals)

        spread_mean = float(np.mean(spread))
        spread_std = float(np.std(spread, ddof=0))
        if spread_std == 0:
            return None

        current_spread = float(spread[-1])
        zscore = (current_spread - spread_mean) / spread_std

        return zscore, current_spread, hedge_ratio, is_cointegrated

    def _evaluate(self, price: float, symbol: str) -> list[Signal]:
        """Core signal logic shared by on_bar and on_trade."""
        if symbol not in self._prices:
            return []

        self._prices[symbol].append(price)

        result = self._compute_spread_and_zscore()
        if result is None:
            return []

        zscore, spread, hedge_ratio, is_cointegrated = result
        signals: list[Signal] = []
        metadata = {
            "zscore": zscore,
            "spread": spread,
            "hedge_ratio": hedge_ratio,
            "is_cointegrated": is_cointegrated,
        }

        if zscore > self.entry_zscore:
            # Spread too high: SHORT symbol_a, LONG symbol_b
            signals.append(
                Signal(
                    direction=Direction.SHORT,
                    symbol=self.symbol_a,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_a][-1]),
                    metadata=metadata,
                )
            )
            signals.append(
                Signal(
                    direction=Direction.LONG,
                    symbol=self.symbol_b,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_b][-1]),
                    metadata=metadata,
                )
            )
        elif zscore < -self.entry_zscore:
            # Spread too low: LONG symbol_a, SHORT symbol_b
            signals.append(
                Signal(
                    direction=Direction.LONG,
                    symbol=self.symbol_a,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_a][-1]),
                    metadata=metadata,
                )
            )
            signals.append(
                Signal(
                    direction=Direction.SHORT,
                    symbol=self.symbol_b,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_b][-1]),
                    metadata=metadata,
                )
            )
        elif abs(zscore) < self.exit_zscore:
            # Spread reverted: FLAT both symbols
            signals.append(
                Signal(
                    direction=Direction.FLAT,
                    symbol=self.symbol_a,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_a][-1]),
                    metadata=metadata,
                )
            )
            signals.append(
                Signal(
                    direction=Direction.FLAT,
                    symbol=self.symbol_b,
                    size=self.position_size,
                    price=float(self._prices[self.symbol_b][-1]),
                    metadata=metadata,
                )
            )

        return signals

    def on_bar(self, bar: Any) -> list[Signal]:
        """Evaluate bar close price for pairs trading signals."""
        close = (
            float(bar.get("close", 0))
            if isinstance(bar, dict)
            else float(getattr(bar, "close", 0))
        )
        symbol = (
            bar.get("symbol", "UNKNOWN")
            if isinstance(bar, dict)
            else getattr(bar, "symbol", "UNKNOWN")
        )
        if close <= 0:
            return []
        return self._evaluate(close, symbol)

    def on_trade(self, trade: Any) -> list[Signal]:
        """Evaluate trade price for pairs trading signals."""
        price = (
            float(trade.get("price", 0))
            if isinstance(trade, dict)
            else float(getattr(trade, "price", 0))
        )
        symbol = (
            trade.get("symbol", "UNKNOWN")
            if isinstance(trade, dict)
            else getattr(trade, "symbol", "UNKNOWN")
        )
        if price <= 0:
            return []
        return self._evaluate(price, symbol)
