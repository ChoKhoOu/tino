"""TradingNode wrapper — stub for NautilusTrader live/paper trading.

This module will wrap NautilusTrader's TradingNode to provide:
  - Live and paper trading node lifecycle management
  - Adapter registration (exchange connectors)
  - Strategy attachment and removal
  - Real-time position/order streaming
"""

from __future__ import annotations

# Verify NautilusTrader is importable
try:
    from nautilus_trader.live.node import TradingNode as _NTTradingNode  # noqa: F401
except ImportError:
    _NTTradingNode = None  # type: ignore[misc, assignment]


class TradingNodeWrapper:
    """Wrapper around NautilusTrader's TradingNode.

    Provides an async-friendly interface for managing live/paper trading
    from gRPC handlers. Implementation will be added in future sprints.
    """

    def __init__(self) -> None:
        if _NTTradingNode is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")
