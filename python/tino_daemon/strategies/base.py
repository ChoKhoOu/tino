"""Strategy base class and Signal dataclass for Tino's quantitative strategy framework.

Defines the abstract interface that all trading strategies must implement,
along with CONFIG_SCHEMA (JSON Schema) for AI-readable parameter descriptions.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Direction(str, Enum):
    """Trading signal direction."""

    LONG = "LONG"
    SHORT = "SHORT"
    FLAT = "FLAT"


@dataclass(frozen=True)
class Signal:
    """Output of a strategy evaluation step.

    Represents a trading signal that the execution layer converts into
    actual orders. Immutable to prevent accidental mutation after emission.
    """

    direction: Direction
    symbol: str
    size: float
    price: float | None = None
    timestamp: datetime | None = None
    metadata: dict[str, Any] | None = None


class Strategy(ABC):
    """Abstract base class for all Tino trading strategies.

    Subclasses must implement ``on_bar`` and ``on_trade``.  The optional
    ``on_orderbook`` and ``on_funding_rate`` hooks default to returning an
    empty signal list.

    Each concrete strategy must also declare:
      - ``CONFIG_SCHEMA`` — a JSON Schema dict describing tunable parameters.
      - ``name`` — human-readable strategy name.
      - ``description`` — one-line summary of what the strategy does.
      - ``market_regime`` — applicable market condition (trending/ranging/neutral).
    """

    # -- class attributes (override in subclasses) --

    CONFIG_SCHEMA: dict[str, Any] = {}
    name: str = ""
    description: str = ""
    market_regime: str = "neutral"

    # -- required hooks --

    @abstractmethod
    def on_bar(self, bar: Any) -> list[Signal]:
        """Called on every new bar (K-line). Must be implemented."""
        ...

    @abstractmethod
    def on_trade(self, trade: Any) -> list[Signal]:
        """Called on every tick trade. Must be implemented."""
        ...

    # -- optional hooks --

    def on_orderbook(self, orderbook: Any) -> list[Signal]:
        """Called on order-book updates. Override for market-making strategies."""
        return []

    def on_funding_rate(self, rate: Any) -> list[Signal]:
        """Called on funding-rate updates. Override for arbitrage strategies."""
        return []
