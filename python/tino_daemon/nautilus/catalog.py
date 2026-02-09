"""ParquetDataCatalog wrapper for NautilusTrader data management.

Provides a high-level interface over NautilusTrader's ParquetDataCatalog for:
  - Writing Bar data to parquet files
  - Listing available instruments, date ranges, bar types
  - Deleting data for specific instruments
"""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.persistence.catalog import ParquetDataCatalog

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CatalogEntry:
    """Metadata for a single catalog entry (instrument + bar_type combination)."""

    instrument: str
    bar_type: str
    start_date: str
    end_date: str
    row_count: int


class DataCatalogWrapper:
    """Wrapper around NautilusTrader's ParquetDataCatalog.

    Provides a high-level interface for managing trading data from
    gRPC handlers.
    """

    def __init__(self, catalog_path: str = "data/catalog") -> None:
        self._catalog_path = Path(catalog_path)
        self._catalog_path.mkdir(parents=True, exist_ok=True)
        self._catalog = ParquetDataCatalog(self._catalog_path)
        logger.info("DataCatalog initialized at %s", self._catalog_path)

    @property
    def path(self) -> Path:
        """Return the catalog base path."""
        return self._catalog_path

    def write_data(self, bars: list[Bar]) -> int:
        """Write Bar objects to the catalog.

        Args:
            bars: List of NautilusTrader Bar objects to persist.

        Returns:
            Number of bars written.

        Raises:
            ValueError: If bars list is empty.
        """
        if not bars:
            raise ValueError("Cannot write empty bars list")

        self._catalog.write_data(bars)
        count = len(bars)
        logger.info("Wrote %d bars to catalog", count)
        return count

    def list_data(self) -> list[CatalogEntry]:
        entries: list[CatalogEntry] = []

        bar_dir = self._catalog_path / "data" / "bar"
        if not bar_dir.exists():
            return entries

        for type_dir in sorted(bar_dir.iterdir()):
            if not type_dir.is_dir():
                continue

            bt_str = type_dir.name
            try:
                bar_type = BarType.from_str(bt_str)
                bars = self._catalog.bars(bar_types=[bt_str])
                if not bars:
                    continue

                instrument_id = str(bar_type.instrument_id)
                start_ts = bars[0].ts_init
                end_ts = bars[-1].ts_init

                start_dt = datetime.fromtimestamp(
                    start_ts / 1_000_000_000, tz=timezone.utc
                )
                end_dt = datetime.fromtimestamp(end_ts / 1_000_000_000, tz=timezone.utc)

                entries.append(
                    CatalogEntry(
                        instrument=instrument_id,
                        bar_type=bt_str,
                        start_date=start_dt.strftime("%Y-%m-%d"),
                        end_date=end_dt.strftime("%Y-%m-%d"),
                        row_count=len(bars),
                    )
                )
            except Exception as exc:
                logger.warning("Failed to read bar_type %s: %s", bt_str, exc)
                continue

        return entries

    def delete_data(self, instrument: str, bar_type: str | None = None) -> bool:
        """Delete data for a specific instrument (and optionally bar_type).

        This removes the underlying parquet files for the matching data.
        Since ParquetDataCatalog doesn't have a native delete method,
        we rebuild the catalog by removing matching directories.

        Args:
            instrument: Instrument identifier string (e.g. "AAPL.XNAS").
            bar_type: Optional bar type string to narrow deletion.

        Returns:
            True if any data was deleted, False otherwise.
        """
        deleted = False
        data_dir = self._catalog_path / "data"

        if not data_dir.exists():
            return False

        # Bar data is stored under data/bar_type=<bar_type_str>/
        # We scan for directories matching the instrument
        bar_dir = data_dir / "bar"
        if not bar_dir.exists():
            return False

        for type_dir in bar_dir.iterdir():
            if not type_dir.is_dir():
                continue

            dir_name = type_dir.name
            # Directory names are like "bar_type=AAPL.XNAS-1-MINUTE-LAST-EXTERNAL"
            if bar_type and bar_type not in dir_name:
                continue
            if instrument not in dir_name:
                continue

            shutil.rmtree(type_dir)
            logger.info("Deleted catalog data: %s", type_dir)
            deleted = True

        # Reinitialize catalog to reflect deletions
        if deleted:
            self._catalog = ParquetDataCatalog(self._catalog_path)

        return deleted
