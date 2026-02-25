"""Exchange connector package — unified interface for Binance, OKX, Bybit, and Hummingbot-backed exchanges."""

from __future__ import annotations

import logging

from tino_daemon.exchanges.base_connector import BaseExchangeConnector
from tino_daemon.exchanges.binance import BinanceConnector
from tino_daemon.exchanges.bitget import BitgetConnector
from tino_daemon.exchanges.bybit import BybitConnector
from tino_daemon.exchanges.okx import OKXConnector

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, type[BaseExchangeConnector]] = {
    "binance": BinanceConnector,
    "bitget": BitgetConnector,
    "okx": OKXConnector,
    "bybit": BybitConnector,
}

# Hummingbot-backed connectors use a "hb-" prefix and are created via the adapter.
# These are registered lazily — the vendored connector is only loaded when requested.
_HB_PREFIX = "hb-"

_INSTANCES: dict[str, BaseExchangeConnector] = {}


def _try_hummingbot_connector(key: str) -> BaseExchangeConnector | None:
    """Try to create a Hummingbot-backed connector for the given key.

    Returns None if the key doesn't match any vendored Hummingbot connector.
    """
    if not key.startswith(_HB_PREFIX):
        return None
    exchange = key[len(_HB_PREFIX):]
    try:
        from tino_daemon.exchanges.hummingbot_adapter import HummingbotAdapter
        return HummingbotAdapter(exchange)
    except (ImportError, ValueError):
        return None


def get_connector(exchange: str) -> BaseExchangeConnector:
    """Get or create a connector instance for the given exchange name.

    Supports both native connectors (e.g. 'binance') and Hummingbot-backed
    connectors (e.g. 'hb-binance').
    """
    key = exchange.strip().lower()
    if key not in _INSTANCES:
        cls = _REGISTRY.get(key)
        if cls is not None:
            _INSTANCES[key] = cls()
        else:
            # Try Hummingbot adapter for "hb-*" prefixed names
            hb_connector = _try_hummingbot_connector(key)
            if hb_connector is not None:
                _INSTANCES[key] = hb_connector
            else:
                raise ValueError(
                    f"Unsupported exchange: {exchange!r}. "
                    f"Supported: {', '.join(sorted(list_exchanges()))}"
                )
    return _INSTANCES[key]


def list_exchanges() -> list[str]:
    """Return list of supported exchange names (native + Hummingbot-backed)."""
    native = list(_REGISTRY.keys())
    try:
        from tino_daemon.vendors.hummingbot import list_hb_connectors
        hb = [f"{_HB_PREFIX}{name}" for name in list_hb_connectors()]
    except ImportError:
        hb = []
    return sorted(native + hb)
