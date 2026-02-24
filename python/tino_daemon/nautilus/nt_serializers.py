"""NautilusTrader model serialization and strategy loading utilities.

Shared helpers used by both BacktestEngineWrapper and TradingNodeWrapper
to convert NT model objects to plain dicts and to load strategy classes
from Python files.
"""

from __future__ import annotations

import importlib.util
import inspect
import json
from pathlib import Path
from typing import Any

try:
    from nautilus_trader.trading.strategy import (  # type: ignore[import-not-found]
        Strategy as NTStrategy,
    )
except ImportError:  # pragma: no cover
    NTStrategy = object  # type: ignore[assignment, misc]


def position_to_dict(position: Any) -> dict[str, Any]:
    """Convert a NautilusTrader Position to a JSON-serializable dict.

    Uses NT public API directly: instrument_id, signed_qty, avg_px_open,
    realized_pnl (Money).
    """
    realized = position.realized_pnl
    return {
        "instrument": str(position.instrument_id),
        "quantity": float(position.signed_qty),
        "avg_price": float(position.avg_px_open),
        "unrealized_pnl": 0.0,  # requires last price; use portfolio for live PnL
        "realized_pnl": float(realized.as_double()) if realized is not None else 0.0,
    }


def order_to_dict(order: Any) -> dict[str, Any]:
    """Convert a NautilusTrader Order to a JSON-serializable dict.

    Uses NT public API directly: client_order_id, instrument_id,
    side_string(), type_string(), quantity, status_string(), ts_init.
    """
    price = float(order.price) if order.has_price else 0.0
    return {
        "id": str(order.client_order_id),
        "instrument": str(order.instrument_id),
        "side": order.side_string(),
        "type": order.type_string(),
        "quantity": float(order.quantity),
        "price": price,
        "status": order.status_string(),
        "timestamp": str(order.ts_init),
    }


def to_float(value: Any) -> float:
    """Safely convert a value to float, returning 0.0 on failure."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def to_int(value: Any) -> int:
    """Safely convert a value to int, returning 0 on failure."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def parse_config_json(config_json: str) -> dict[str, object]:
    """Parse a JSON config string into a dict, or return empty dict."""
    if not config_json:
        return {}
    parsed = json.loads(config_json)
    if not isinstance(parsed, dict):
        raise ValueError("config_json must deserialize to a JSON object")
    return parsed


def load_strategy_class(
    strategy_path: str,
    strategies_dir: str | None = None,
) -> type:
    """Load the first Strategy subclass from a Python file.

    Args:
        strategy_path: Relative or absolute path to the strategy .py file.
        strategies_dir: If provided, relative paths are resolved against it
            and the resolved path must be inside that directory (sandbox).
            If None, the path is resolved against cwd without restriction.

    Returns:
        The first NTStrategy subclass found in the module.

    Raises:
        FileNotFoundError: If the strategy file does not exist.
        ValueError: If no Strategy subclass is found or path escapes sandbox.
    """
    path = Path(strategy_path)

    if strategies_dir is not None:
        base = Path(strategies_dir).resolve()
        if not path.is_absolute():
            path = base / path
        resolved = path.resolve()
        try:
            resolved.relative_to(base)
        except ValueError as exc:
            raise ValueError(
                "Strategy path must be inside strategies/ directory"
            ) from exc
    else:
        resolved = path.resolve()

    if not resolved.exists() or not resolved.is_file():
        raise FileNotFoundError(f"Strategy file not found: {resolved}")

    spec = importlib.util.spec_from_file_location(
        f"strategy_{resolved.stem}", resolved,
    )
    if spec is None or spec.loader is None:
        raise ValueError(f"Failed to load strategy module from: {resolved}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    for _, cls in inspect.getmembers(module, inspect.isclass):
        if issubclass(cls, NTStrategy) and cls is not NTStrategy:
            return cls

    raise ValueError(f"No Strategy subclass found in: {resolved}")
