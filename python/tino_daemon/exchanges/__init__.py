"""Exchange connector package — unified interface for Binance, OKX, Bybit."""

from __future__ import annotations

from tino_daemon.exchanges.base_connector import BaseExchangeConnector
from tino_daemon.exchanges.binance import BinanceConnector
from tino_daemon.exchanges.bitget import BitgetConnector
from tino_daemon.exchanges.bybit import BybitConnector
from tino_daemon.exchanges.okx import OKXConnector

_REGISTRY: dict[str, type[BaseExchangeConnector]] = {
    "binance": BinanceConnector,
    "bitget": BitgetConnector,
    "okx": OKXConnector,
    "bybit": BybitConnector,
}

_INSTANCES: dict[str, BaseExchangeConnector] = {}


def get_connector(exchange: str) -> BaseExchangeConnector:
    """Get or create a connector instance for the given exchange name."""
    key = exchange.strip().lower()
    if key not in _INSTANCES:
        cls = _REGISTRY.get(key)
        if cls is None:
            raise ValueError(
                f"Unsupported exchange: {exchange!r}. "
                f"Supported: {', '.join(sorted(_REGISTRY))}"
            )
        _INSTANCES[key] = cls()
    return _INSTANCES[key]


def list_exchanges() -> list[str]:
    """Return list of supported exchange names."""
    return sorted(_REGISTRY.keys())
