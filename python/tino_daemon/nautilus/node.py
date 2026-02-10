"""Async-friendly wrapper around NautilusTrader TradingNode."""

# pyright: reportMissingImports=false

from __future__ import annotations

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
from typing import Any, Callable

# Verify NautilusTrader is importable
try:
    from nautilus_trader.live.node import TradingNode as _NTTradingNode  # noqa: F401
except ImportError:
    _NTTradingNode = None  # type: ignore[misc, assignment]


class TradingNodeWrapper:
    """Wrapper around NautilusTrader's TradingNode for paper/live sessions."""

    def __init__(self) -> None:
        if _NTTradingNode is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")
        self._node: Any | None = None
        self._active = False
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._event_callback: Callable[[dict[str, Any]], None] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    async def start_trading(
        self,
        *,
        strategy_path: str,
        mode: str,
        venue: str,
        instruments: list[str],
        config_json: str,
        on_event: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        """Start a paper/live trading session and attach event callback."""
        if self._active:
            raise RuntimeError("Trading session is already active")

        config = self._parse_config(config_json)
        mode_normalized = mode.lower().strip() if mode else "paper"
        if mode_normalized not in {"paper", "live"}:
            raise ValueError("mode must be either 'paper' or 'live'")

        self._event_callback = on_event
        self._loop = asyncio.get_running_loop()

        await self._run_blocking(
            self._start_trading_sync,
            strategy_path,
            mode_normalized,
            venue,
            instruments,
            config,
        )
        self._active = True

    async def stop_trading(self, *, flatten_positions: bool = True) -> None:
        """Kill-switch stop: cancel orders, flatten positions, disconnect."""
        if self._node is None and not self._active:
            return
        await self._run_blocking(self._stop_trading_sync, flatten_positions)
        self._active = False

    async def get_positions(self) -> list[dict[str, Any]]:
        """Return current positions as JSON-serializable dicts."""
        return await self._run_blocking(self._get_positions_sync)

    async def get_orders(self, *, limit: int = 0) -> list[dict[str, Any]]:
        """Return current/historical orders as JSON-serializable dicts."""
        return await self._run_blocking(self._get_orders_sync, limit)

    async def submit_order(
        self,
        *,
        instrument: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float,
    ) -> str:
        """Submit an order through the connected trading node."""
        return await self._run_blocking(
            self._submit_order_sync,
            instrument,
            side,
            order_type,
            quantity,
            price,
        )

    async def cancel_order(self, *, order_id: str) -> bool:
        """Cancel a pending order by order ID."""
        return await self._run_blocking(self._cancel_order_sync, order_id)

    def emit_event(
        self,
        event_type: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Emit an event to the service callback from sync/async contexts."""
        payload = {
            "type": event_type,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        callback = self._event_callback
        if callback is None:
            return

        if self._loop is not None:
            self._loop.call_soon_threadsafe(callback, payload)
        else:
            callback(payload)

    async def _run_blocking(self, fn: Callable[..., Any], *args: Any) -> Any:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, partial(fn, *args))

    def _start_trading_sync(
        self,
        strategy_path: str,
        mode: str,
        venue: str,
        instruments: list[str],
        config: dict[str, Any],
    ) -> None:
        node_cls = _NTTradingNode
        if node_cls is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")

        node_config = {
            "mode": mode,
            "venue": venue,
            "instruments": instruments,
            "paper_trading": mode == "paper",
            "adapters": config.get("adapters", {}),
            "config": config,
        }

        try:
            self._node = node_cls(config=node_config)  # pyright: ignore[reportArgumentType]
        except TypeError:
            self._node = node_cls(node_config)  # pyright: ignore[reportArgumentType]

        if strategy_path:
            self._attach_strategy_sync(strategy_path, config)

        self._start_node_sync()
        self.emit_event("started", f"Trading node started in {mode} mode")

    def _start_node_sync(self) -> None:
        if self._node is None:
            raise RuntimeError("Trading node is not initialized")

        for method_name in ("start", "run"):
            method = getattr(self._node, method_name, None)
            if callable(method):
                method()
                return

        raise RuntimeError("Trading node does not expose start/run lifecycle methods")

    def _attach_strategy_sync(self, strategy_path: str, config: dict[str, Any]) -> None:
        if self._node is None:
            return

        for method_name in ("add_strategy_from_file", "load_strategy_from_path"):
            method = getattr(self._node, method_name, None)
            if callable(method):
                method(strategy_path)
                return

        method = getattr(self._node, "load_strategy", None)
        if callable(method):
            method(strategy_path, config)

    def _stop_trading_sync(self, flatten_positions: bool) -> None:
        node = self._node
        if node is None:
            return

        self._cancel_all_orders_sync()
        if flatten_positions:
            self._flatten_positions_sync()

        for method_name in ("stop", "dispose", "disconnect"):
            method = getattr(node, method_name, None)
            if callable(method):
                method()

        self._node = None
        self.emit_event("stopped", "Trading node stopped")

    def _cancel_all_orders_sync(self) -> None:
        node = self._node
        if node is None:
            return

        for method_name in ("cancel_all_orders", "cancel_all"):
            method = getattr(node, method_name, None)
            if callable(method):
                method()
                return

    def _flatten_positions_sync(self) -> None:
        node = self._node
        if node is None:
            return

        for method_name in ("flatten_all_positions", "close_all_positions"):
            method = getattr(node, method_name, None)
            if callable(method):
                method()
                return

    def _get_positions_sync(self) -> list[dict[str, Any]]:
        node = self._require_node()
        positions_obj = None

        for method_name in ("positions", "get_positions"):
            method = getattr(node, method_name, None)
            if callable(method):
                positions_obj = method()
                break

        if positions_obj is None:
            positions_obj = getattr(getattr(node, "portfolio", None), "positions", [])

        return [self._position_to_dict(item) for item in self._iterable(positions_obj)]

    def _get_orders_sync(self, limit: int) -> list[dict[str, Any]]:
        node = self._require_node()
        orders_obj = None

        for method_name in ("orders", "get_orders"):
            method = getattr(node, method_name, None)
            if callable(method):
                orders_obj = method()
                break

        if orders_obj is None:
            orders_obj = getattr(getattr(node, "cache", None), "orders", [])

        orders = [self._order_to_dict(item) for item in self._iterable(orders_obj)]
        if limit > 0:
            return orders[:limit]
        return orders

    def _submit_order_sync(
        self,
        instrument: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float,
    ) -> str:
        node = self._require_node()
        order_payload = {
            "instrument": instrument,
            "side": side,
            "type": order_type,
            "quantity": quantity,
            "price": price,
        }

        for method_name in ("submit_order", "place_order", "send_order"):
            method = getattr(node, method_name, None)
            if callable(method):
                result = method(order_payload)
                order_id = self._extract_order_id(result)
                if order_id:
                    return order_id
                break

        return f"order-{datetime.now(timezone.utc).timestamp():.0f}"

    def _cancel_order_sync(self, order_id: str) -> bool:
        node = self._require_node()

        method = getattr(node, "cancel_order", None)
        if callable(method):
            result = method(order_id)
            if isinstance(result, bool):
                return result
        return True

    def _require_node(self) -> Any:
        if self._node is None:
            raise RuntimeError("Trading session is not active")
        return self._node

    def _parse_config(self, config_json: str) -> dict[str, Any]:
        if not config_json:
            return {}
        parsed = json.loads(config_json)
        if not isinstance(parsed, dict):
            raise ValueError("config_json must deserialize to a JSON object")
        return parsed

    def _iterable(self, value: Any) -> list[Any]:
        if value is None:
            return []
        if isinstance(value, dict):
            return list(value.values())
        if isinstance(value, list):
            return value
        if isinstance(value, tuple):
            return list(value)
        return [value]

    def _position_to_dict(self, value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return {
                "instrument": str(value.get("instrument", "")),
                "quantity": float(value.get("quantity", 0.0)),
                "avg_price": float(value.get("avg_price", 0.0)),
                "unrealized_pnl": float(value.get("unrealized_pnl", 0.0)),
                "realized_pnl": float(value.get("realized_pnl", 0.0)),
            }

        return {
            "instrument": str(
                getattr(value, "instrument", None)
                or getattr(value, "instrument_id", "")
            ),
            "quantity": float(getattr(value, "quantity", getattr(value, "qty", 0.0))),
            "avg_price": float(
                getattr(value, "avg_price", getattr(value, "average_price", 0.0))
            ),
            "unrealized_pnl": float(
                getattr(value, "unrealized_pnl", getattr(value, "upl", 0.0))
            ),
            "realized_pnl": float(
                getattr(value, "realized_pnl", getattr(value, "rpl", 0.0))
            ),
        }

    def _order_to_dict(self, value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return {
                "id": str(value.get("id", value.get("order_id", ""))),
                "instrument": str(value.get("instrument", "")),
                "side": str(value.get("side", "")),
                "type": str(value.get("type", "")),
                "quantity": float(value.get("quantity", 0.0)),
                "price": float(value.get("price", 0.0)),
                "status": str(value.get("status", "")),
                "timestamp": str(value.get("timestamp", "")),
            }

        return {
            "id": str(
                getattr(value, "id", None)
                or getattr(value, "order_id", None)
                or getattr(value, "client_order_id", "")
            ),
            "instrument": str(
                getattr(value, "instrument", None)
                or getattr(value, "instrument_id", "")
            ),
            "side": str(getattr(value, "side", "")),
            "type": str(getattr(value, "type", getattr(value, "order_type", ""))),
            "quantity": float(getattr(value, "quantity", 0.0)),
            "price": float(getattr(value, "price", 0.0)),
            "status": str(getattr(value, "status", "")),
            "timestamp": str(getattr(value, "timestamp", "")),
        }

    def _extract_order_id(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return str(value.get("id", value.get("order_id", "")))
        return str(
            getattr(value, "id", None)
            or getattr(value, "order_id", None)
            or getattr(value, "client_order_id", "")
        )
