"""TradingNodeWrapper — async facade over NautilusTrader TradingNode (direct API, no reflection)."""

from __future__ import annotations

import asyncio
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from functools import partial
from typing import Any, Callable

from tino_daemon.nautilus.nt_serializers import (
    load_strategy_class,
    order_to_dict,
    parse_config_json,
    position_to_dict,
)

try:
    from nautilus_trader.config import TradingNodeConfig  # type: ignore[import-not-found]
    from nautilus_trader.live.node import TradingNode as NTTradingNode
    from nautilus_trader.model.enums import OrderSide, TimeInForce
    from nautilus_trader.model.identifiers import ClientOrderId, InstrumentId
    from nautilus_trader.model.objects import Price, Quantity
    from nautilus_trader.trading.strategy import Strategy as NTStrategy
except ImportError:  # pragma: no cover
    NTTradingNode = None  # type: ignore[assignment, misc]

logger = logging.getLogger(__name__)


class TradingNodeWrapper:
    """Wrapper around NautilusTrader's TradingNode for paper/live sessions."""

    def __init__(self) -> None:
        if NTTradingNode is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")
        self._node: NTTradingNode | None = None
        self._strategy: NTStrategy | None = None
        self._active = False
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._event_callback: Callable[[dict[str, Any]], None] | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._run_thread: threading.Thread | None = None

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
        if self._active:
            raise RuntimeError("Trading session is already active")
        config = parse_config_json(config_json)
        mode_normalized = mode.lower().strip() if mode else "paper"
        if mode_normalized not in {"paper", "live"}:
            raise ValueError("mode must be either 'paper' or 'live'")
        self._event_callback = on_event
        self._loop = asyncio.get_running_loop()
        await self._run_blocking(
            self._start_sync, strategy_path, mode_normalized, venue,
            instruments, config,
        )
        self._active = True

    async def stop_trading(self, *, flatten_positions: bool = True) -> None:
        if self._node is None and not self._active:
            return
        await self._run_blocking(self._stop_sync, flatten_positions)
        self._active = False

    async def get_positions(self) -> list[dict[str, Any]]:
        return await self._run_blocking(self._get_positions_sync)

    async def get_orders(self, *, limit: int = 0) -> list[dict[str, Any]]:
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
        return await self._run_blocking(
            self._submit_order_sync, instrument, side, order_type, quantity, price,
        )

    async def cancel_order(self, *, order_id: str) -> bool:
        return await self._run_blocking(self._cancel_order_sync, order_id)

    def emit_event(
        self, event_type: str, message: str, data: dict[str, Any] | None = None,
    ) -> None:
        cb = self._event_callback
        if cb is None:
            return
        payload = {"type": event_type, "message": message, "data": data or {},
                   "timestamp": datetime.now(timezone.utc).isoformat()}
        if self._loop is not None:
            self._loop.call_soon_threadsafe(cb, payload)
        else:
            cb(payload)

    async def _run_blocking(self, fn: Callable[..., Any], *args: Any) -> Any:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, partial(fn, *args))

    def _start_sync(
        self, strategy_path: str, mode: str, venue: str,
        instruments: list[str], config: dict[str, Any],
    ) -> None:
        node_config = TradingNodeConfig()
        self._node = NTTradingNode(config=node_config)
        self._node.build()
        if strategy_path:
            strategy_cls = load_strategy_class(strategy_path)
            self._strategy = strategy_cls(config)
            self._node.trader.add_strategy(self._strategy)
        self._run_thread = threading.Thread(target=self._node.run, daemon=True)
        self._run_thread.start()
        self.emit_event("started", f"Trading node started in {mode} mode")

    def _stop_sync(self, flatten_positions: bool) -> None:
        node = self._node
        if node is None:
            return
        if self._strategy is not None:
            for order in node.cache.orders_open():
                self._strategy.cancel_order(order)
            if flatten_positions:
                for pos in node.cache.positions_open():
                    self._strategy.close_position(pos)
        node.stop()
        if self._run_thread is not None:
            self._run_thread.join(timeout=5.0)
            if self._run_thread.is_alive():
                logger.warning("Trading node run thread did not exit within 5s")
        node.dispose()
        self._node = None
        self._strategy = None
        self._run_thread = None
        self.emit_event("stopped", "Trading node stopped")

    def _get_positions_sync(self) -> list[dict[str, Any]]:
        node = self._require_node()
        results: list[dict[str, Any]] = []
        for pos in node.cache.positions_open():
            d = position_to_dict(pos)
            try:
                last_tick = node.cache.trade_tick(pos.instrument_id)
                if last_tick is not None:
                    unrealized = pos.unrealized_pnl(last_tick.price)
                    d["unrealized_pnl"] = (
                        float(unrealized.as_double()) if unrealized is not None else 0.0
                    )
            except Exception:
                pass  # Keep default 0.0 from position_to_dict
            results.append(d)
        return results

    def _get_orders_sync(self, limit: int) -> list[dict[str, Any]]:
        node = self._require_node()
        orders = [order_to_dict(o) for o in node.cache.orders()]
        return orders[:limit] if limit > 0 else orders

    def _submit_order_sync(
        self, instrument: str, side: str, order_type: str,
        quantity: float, price: float,
    ) -> str:
        self._require_node()
        strategy = self._strategy
        if strategy is None:
            raise RuntimeError("No strategy attached — cannot submit orders")
        instrument_id = InstrumentId.from_str(instrument)
        order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL
        qty = Quantity.from_str(str(quantity))
        if order_type.upper() == "MARKET":
            order = strategy.order_factory.market(
                instrument_id=instrument_id,
                order_side=order_side,
                quantity=qty,
            )
        else:
            order = strategy.order_factory.limit(
                instrument_id=instrument_id,
                order_side=order_side,
                quantity=qty,
                price=Price.from_str(str(price)),
                time_in_force=TimeInForce.GTC,
            )
        strategy.submit_order(order)
        return str(order.client_order_id)

    def _cancel_order_sync(self, order_id: str) -> bool:
        node = self._require_node()
        if self._strategy is None:
            return False
        order = node.cache.order(ClientOrderId(order_id))
        if order is None:
            return False
        self._strategy.cancel_order(order)
        return True

    def _require_node(self) -> NTTradingNode:  # type: ignore[return]
        if self._node is None:
            raise RuntimeError("Trading session is not active")
        return self._node

