"""Base wrangler abstract class for data source adapters."""

from __future__ import annotations

import abc
from typing import Any

from nautilus_trader.model.data import Bar


class BaseWrangler(abc.ABC):
    """Abstract base class for data wranglers.

    A wrangler converts raw data from a specific source format into
    NautilusTrader Bar objects suitable for catalog storage.

    Subclasses must implement:
      - source_type: class property identifying the source (e.g. "csv", "polygon")
      - wrangle(): convert raw data to Bar objects
    """

    @property
    @abc.abstractmethod
    def source_type(self) -> str:
        """Return the source type identifier (e.g. 'csv', 'polygon', 'alpaca')."""
        ...

    @abc.abstractmethod
    def wrangle(
        self,
        data: Any,
        instrument: str,
        bar_type: str,
    ) -> list[Bar]:
        """Convert raw data into NautilusTrader Bar objects.

        Args:
            data: Raw data (type depends on the source — file path, DataFrame, etc.)
            instrument: Instrument identifier string (e.g. "AAPL.XNAS")
            bar_type: Bar type string (e.g. "AAPL.XNAS-1-DAY-LAST-EXTERNAL")

        Returns:
            List of Bar objects ready for catalog storage.

        Raises:
            ValueError: If data format is invalid or cannot be parsed.
        """
        ...
