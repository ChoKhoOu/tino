"""Vendored Hummingbot CEX connector code.

Adapted from the Hummingbot open-source project (https://github.com/hummingbot/hummingbot)
under the Apache License 2.0. See LICENSE in this directory.

Hummingbot's full pip package cannot be used as a library dependency due to heavy
transitive dependencies (web3, numba, TA-Lib, pandas-ta, etc.) and Python version
constraints. This vendored module extracts the essential REST API connector logic
in a lightweight form that integrates with Tino's exchange adapter interface.

Supported exchanges (vendored):
- Binance (spot + futures)

To add a new exchange, create a new module following the pattern in binance.py
and register it in CONNECTOR_REGISTRY below.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tino_daemon.vendors.hummingbot.connector import HummingbotConnectorBase

# Version of Hummingbot source this vendor was adapted from
HUMMINGBOT_SOURCE_VERSION = "20260201"
HUMMINGBOT_LICENSE = "Apache-2.0"

# Registry of vendored connectors: name -> factory function
# Lazy imports to avoid loading all connectors at module import time
CONNECTOR_REGISTRY: dict[str, str] = {
    "binance": "tino_daemon.vendors.hummingbot.binance.HBBinanceConnector",
}


def get_hb_connector(exchange: str) -> HummingbotConnectorBase:
    """Instantiate a vendored Hummingbot connector by exchange name."""
    import importlib

    key = exchange.strip().lower()
    class_path = CONNECTOR_REGISTRY.get(key)
    if class_path is None:
        raise ValueError(
            f"No vendored Hummingbot connector for: {exchange!r}. "
            f"Available: {', '.join(sorted(CONNECTOR_REGISTRY))}"
        )
    module_path, class_name = class_path.rsplit(".", 1)
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    return cls()


def list_hb_connectors() -> list[str]:
    """Return list of available vendored Hummingbot connector names."""
    return sorted(CONNECTOR_REGISTRY.keys())
