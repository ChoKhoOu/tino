"""BacktestEngine wrapper — stub for NautilusTrader backtesting.

This module will wrap NautilusTrader's BacktestEngine to provide:
  - Configuration-driven engine setup
  - Thread-safe execution via ThreadPoolExecutor (NT's engine is sync)
  - Progress tracking via shared strategy state
  - Result extraction and serialization

Sprint 0 validated:
  - BacktestEngine.run() works behind grpc.aio when run in executor
  - Progress polling every 500ms can be streamed from shared strategy state
  - Multiple sequential backtests work when LogGuard is initialized once
"""

from __future__ import annotations

# Verify NautilusTrader is importable
try:
    from nautilus_trader.backtest.engine import BacktestEngine as _NTBacktestEngine  # noqa: F401
except ImportError:
    _NTBacktestEngine = None  # type: ignore[misc, assignment]


class BacktestEngineWrapper:
    """Wrapper around NautilusTrader's BacktestEngine.

    Provides an async-friendly interface for running backtests from gRPC handlers.
    Implementation will be added in future sprints.
    """

    def __init__(self) -> None:
        if _NTBacktestEngine is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")
