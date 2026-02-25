"""DCA (Dollar Cost Averaging) Strategy for Tino.

Implements a time-based dollar-cost averaging strategy:
  - Buy a fixed USDT amount at regular intervals (daily/weekly/monthly)
  - Optional dip-buy mode: increase buy size when price drops significantly

Parameters:
  interval: Buy frequency — 'daily', 'weekly', or 'monthly'
  amount: USDT amount per regular buy
  dip_buy_enabled: Whether to enable dip-buy mode
  dip_threshold_pct: Price drop percentage to trigger dip buy (from recent high)
  dip_multiplier: Multiplier applied to amount for dip buys
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from tino_daemon.strategies.base import Direction, Signal, Strategy


class DCAStrategy(Strategy):
    """Dollar-cost averaging strategy.

    Generates periodic LONG signals at a fixed USDT amount per buy.
    Optionally detects price dips from recent highs and triggers
    additional buys at a multiplied amount.
    """

    name: str = "dca"
    description: str = (
        "Dollar cost averaging strategy that buys a fixed USDT amount "
        "at regular intervals (daily/weekly/monthly), with optional "
        "dip-buy mode for increased purchases during price drops."
    )
    market_regime: str = "neutral"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "DCAStrategy Configuration",
        "description": (
            "Parameters for the DCA dollar-cost averaging strategy. "
            "Buys a fixed USDT amount at regular time intervals."
        ),
        "type": "object",
        "properties": {
            "interval": {
                "type": "string",
                "enum": ["daily", "weekly", "monthly"],
                "default": "daily",
                "description": (
                    "Buy frequency. 'daily' buys every new day, "
                    "'weekly' buys every Monday, 'monthly' buys on the 1st."
                ),
            },
            "amount": {
                "type": "number",
                "minimum": 0.01,
                "description": "USDT amount to buy per interval.",
            },
            "dip_buy_enabled": {
                "type": "boolean",
                "default": False,
                "description": "Enable additional buys when price drops significantly.",
            },
            "dip_threshold_pct": {
                "type": "number",
                "default": 0.05,
                "minimum": 0.01,
                "maximum": 0.5,
                "description": (
                    "Price drop percentage from recent high to trigger a dip buy. "
                    "0.05 means 5%."
                ),
            },
            "dip_multiplier": {
                "type": "number",
                "default": 2.0,
                "minimum": 1.0,
                "maximum": 10.0,
                "description": "Multiplier applied to amount for dip buys.",
            },
        },
        "required": ["amount"],
        "additionalProperties": False,
    }

    def __init__(
        self,
        symbol: str = "BTC-USDT",
        interval: str = "daily",
        amount: float = 100.0,
        dip_buy_enabled: bool = False,
        dip_threshold_pct: float = 0.05,
        dip_multiplier: float = 2.0,
    ) -> None:
        self.symbol = symbol
        self.interval = interval
        self.amount = amount
        self.dip_buy_enabled = dip_buy_enabled
        self.dip_threshold_pct = dip_threshold_pct
        self.dip_multiplier = dip_multiplier

        self._last_buy_date: date | None = None
        self._high_since_last_buy: float | None = None
        self._dip_bought_this_cycle: bool = False

    def _extract_timestamp(self, bar: Any) -> datetime:
        """Extract a datetime from a bar dict or object."""
        if isinstance(bar, dict):
            ts = bar.get("timestamp")
        else:
            ts = getattr(bar, "timestamp", None)

        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts)
        if isinstance(ts, str):
            return datetime.fromisoformat(ts)
        raise ValueError(f"Cannot extract timestamp from bar: {bar}")

    def _extract_price(self, bar: Any) -> float:
        """Extract close price from a bar dict or object."""
        if isinstance(bar, dict):
            return float(bar.get("close", bar.get("price", 0)))
        return float(getattr(bar, "close", getattr(bar, "price", 0)))

    def _is_buy_period(self, current_date: date) -> bool:
        """Check if the current date triggers a scheduled buy."""
        if self._last_buy_date is not None and current_date <= self._last_buy_date:
            return False

        if self.interval == "daily":
            return True
        elif self.interval == "weekly":
            return current_date.weekday() == 0  # Monday
        elif self.interval == "monthly":
            return current_date.day == 1
        return False

    def on_bar(self, bar: Any) -> list[Signal]:
        """Process a new bar and generate DCA buy signals.

        Checks time-based interval for regular buys and optionally
        monitors price dips for additional buy opportunities.
        """
        ts = self._extract_timestamp(bar)
        price = self._extract_price(bar)
        current_date = ts.date()
        signals: list[Signal] = []

        # Track high price for dip-buy detection
        if self._high_since_last_buy is None:
            self._high_since_last_buy = price
        else:
            self._high_since_last_buy = max(self._high_since_last_buy, price)

        # Dip buy check (before regular buy resets the high tracker)
        if (
            self.dip_buy_enabled
            and self._high_since_last_buy is not None
            and self._high_since_last_buy > 0
            and not self._dip_bought_this_cycle
        ):
            drop_pct = (self._high_since_last_buy - price) / self._high_since_last_buy
            if drop_pct > self.dip_threshold_pct:
                dip_size = (self.amount * self.dip_multiplier) / price
                signals.append(
                    Signal(
                        direction=Direction.LONG,
                        symbol=self.symbol,
                        size=dip_size,
                        price=price,
                        timestamp=ts,
                        metadata={
                            "is_dip_buy": True,
                            "drop_pct": drop_pct,
                            "high_price": self._high_since_last_buy,
                        },
                    )
                )
                self._dip_bought_this_cycle = True

        # Regular scheduled buy
        if self._is_buy_period(current_date):
            size = self.amount / price
            signals.append(
                Signal(
                    direction=Direction.LONG,
                    symbol=self.symbol,
                    size=size,
                    price=price,
                    timestamp=ts,
                    metadata={
                        "is_dip_buy": False,
                        "interval": self.interval,
                        "period_date": current_date.isoformat(),
                    },
                )
            )
            self._last_buy_date = current_date
            self._high_since_last_buy = price
            self._dip_bought_this_cycle = False

        return signals

    def on_trade(self, trade: Any) -> list[Signal]:
        """Process a tick trade — update price tracking only, no signals."""
        if isinstance(trade, dict):
            price = float(trade.get("price", 0))
        else:
            price = float(getattr(trade, "price", 0))

        if self._high_since_last_buy is None:
            self._high_since_last_buy = price
        else:
            self._high_since_last_buy = max(self._high_since_last_buy, price)

        return []
