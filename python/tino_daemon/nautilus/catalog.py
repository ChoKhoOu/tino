"""ParquetDataCatalog wrapper — stub for NautilusTrader data management.

This module will wrap NautilusTrader's ParquetDataCatalog to provide:
  - Data ingestion from various formats (CSV, Parquet, API)
  - Efficient catalog queries for backtest data loading
  - Schema management and validation
  - Data export and sharing
"""

from __future__ import annotations

# Verify NautilusTrader is importable
try:
    from nautilus_trader.persistence.catalog import ParquetDataCatalog as _NTCatalog  # noqa: F401
except ImportError:
    _NTCatalog = None  # type: ignore[misc, assignment]


class DataCatalogWrapper:
    """Wrapper around NautilusTrader's ParquetDataCatalog.

    Provides a high-level interface for managing trading data from
    gRPC handlers. Implementation will be added in future sprints.
    """

    def __init__(self, data_dir: str = ".tino/data") -> None:
        if _NTCatalog is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")
        self._data_dir = data_dir
