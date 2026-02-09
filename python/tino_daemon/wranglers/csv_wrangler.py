"""CSV wrangler — converts standard OHLCV CSV data to NautilusTrader Bar objects.

Expects CSV format: date,open,high,low,close,volume
  - date: ISO date string (YYYY-MM-DD) or datetime
  - open/high/low/close: float prices
  - volume: float or int volume

Uses NautilusTrader's built-in BarDataWrangler for the heavy lifting.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
from nautilus_trader.model.currencies import USD
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.identifiers import InstrumentId, Symbol
from nautilus_trader.model.instruments import Equity
from nautilus_trader.model.objects import Price, Quantity
from nautilus_trader.persistence.wranglers import BarDataWrangler

from tino_daemon.wranglers.base import BaseWrangler

logger = logging.getLogger(__name__)


class CsvWrangler(BaseWrangler):
    """Converts standard OHLCV CSV files to NautilusTrader Bar objects.

    Expected CSV columns: date (or timestamp), open, high, low, close, volume.
    The wrangler is flexible with column naming and ordering.
    """

    @property
    def source_type(self) -> str:
        return "csv"

    def wrangle(
        self,
        data: str | Path,
        instrument: str,
        bar_type: str,
    ) -> list[Bar]:
        """Convert a CSV file to NautilusTrader Bar objects.

        Args:
            data: Path to CSV file (string or Path).
            instrument: Instrument identifier (e.g. "AAPL.XNAS").
            bar_type: Bar type string (e.g. "AAPL.XNAS-1-DAY-LAST-EXTERNAL").

        Returns:
            List of Bar objects.

        Raises:
            ValueError: If CSV is empty or missing required columns.
            FileNotFoundError: If CSV file does not exist.
        """
        csv_path = Path(data)
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")

        df = pd.read_csv(csv_path)
        if df.empty:
            raise ValueError(f"CSV file is empty: {csv_path}")

        return self.wrangle_dataframe(df, instrument, bar_type)

    def wrangle_dataframe(
        self,
        df: pd.DataFrame,
        instrument: str,
        bar_type: str,
    ) -> list[Bar]:
        """Convert a DataFrame to NautilusTrader Bar objects.

        Args:
            df: DataFrame with OHLCV data.
            instrument: Instrument identifier.
            bar_type: Bar type string.

        Returns:
            List of Bar objects.

        Raises:
            ValueError: If DataFrame is missing required columns.
        """
        # Normalize column names (lowercase, strip whitespace)
        df.columns = df.columns.str.lower().str.strip()

        # Detect and rename date column
        date_col = _find_date_column(df)
        if date_col is None:
            raise ValueError(
                f"No date/timestamp column found. Columns: {list(df.columns)}"
            )

        # Ensure required OHLCV columns exist
        required = {"open", "high", "low", "close", "volume"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Prepare DataFrame in the format BarDataWrangler expects
        df[date_col] = pd.to_datetime(df[date_col], utc=True)
        df = df.set_index(date_col)
        df = df[["open", "high", "low", "close", "volume"]]

        # Ensure numeric types
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna()

        if df.empty:
            raise ValueError("No valid rows after parsing")

        # Sort by index (timestamp) to ensure chronological order
        df = df.sort_index()

        # Use NautilusTrader's BarDataWrangler
        bt = BarType.from_str(bar_type)
        synthetic_instrument = _make_synthetic_equity(bt.instrument_id)
        wrangler = BarDataWrangler(bt, synthetic_instrument)
        bars: list[Bar] = wrangler.process(df)

        logger.info(
            "Wrangled %d bars from CSV for %s (%s)", len(bars), instrument, bar_type
        )
        return bars


def _find_date_column(df: pd.DataFrame) -> str | None:
    candidates = ["date", "timestamp", "datetime", "time", "dt"]
    for col in candidates:
        if col in df.columns:
            return col
    first_col = df.columns[0]
    try:
        pd.to_datetime(df[first_col].head(5))
        return first_col
    except (ValueError, TypeError):
        return None


def _make_synthetic_equity(instrument_id: InstrumentId) -> Equity:
    """Create a minimal Equity instrument for BarDataWrangler.

    BarDataWrangler requires an Instrument to derive price/size precision.
    For CSV ingestion where we don't have exchange metadata, we create a
    synthetic equity with sensible defaults (2 decimal precision, USD).
    """
    return Equity(
        instrument_id=instrument_id,
        raw_symbol=Symbol(instrument_id.symbol.value),
        currency=USD,
        price_precision=2,
        price_increment=Price.from_str("0.01"),
        lot_size=Quantity.from_int(1),
        ts_event=0,
        ts_init=0,
    )
