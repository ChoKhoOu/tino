"""TradingService gRPC implementation.

Supports two backends:
- Paper mode (default): Uses the built-in PaperTradingEngine for simulated
  order execution with real-time market data.
- Live mode: Delegates to NautilusTrader's TradingNodeWrapper.
"""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import grpc

from tino_daemon.nautilus.exchange_factory import create_exchange_config
from tino_daemon.nautilus.node import TradingNodeWrapper
from tino_daemon.node_registry import NodeRegistry
from tino_daemon.paper.engine import PaperTradingEngine
from tino_daemon.proto.tino.trading.v1 import trading_pb2, trading_pb2_grpc

logger = logging.getLogger(__name__)


class TradingServiceServicer(trading_pb2_grpc.TradingServiceServicer):
    def __init__(
        self,
        node: Any | None = None,
        registry: NodeRegistry | None = None,
    ) -> None:
        self._node = node
        self._registry = registry
        self._paper_engine: PaperTradingEngine | None = None

    def _get_node(self) -> TradingNodeWrapper:
        if self._node is None:
            if self._registry is not None:
                self._node = self._registry.get_node()
            else:
                self._node = TradingNodeWrapper()
        return self._node

    async def StartTrading(
        self,
        request: Any,
        context: Any,
    ) -> AsyncIterator[Any]:
        """Start trading and stream lifecycle/fill/position/pnl/error events."""

        mode_raw = (request.mode or "").strip().lower()
        mode = "live" if mode_raw == "live" else "paper"
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_event(payload: dict[str, Any]) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, payload)

        if mode == "paper":
            # Use built-in PaperTradingEngine
            try:
                config = json.loads(request.config_json) if request.config_json else {}
                exchange = (request.venue or "binance").strip().lower()
                instruments = list(request.instruments) if request.instruments else []

                self._paper_engine = PaperTradingEngine(
                    instruments=instruments,
                    exchange=exchange,
                    initial_balance=float(config.get("initial_balance", 100_000)),
                    poll_interval=float(config.get("poll_interval", 2.0)),
                    taker_fee=float(config.get("taker_fee", 0.0004)),
                    maker_fee=float(config.get("maker_fee", 0.0002)),
                    on_event=on_event,
                )
                await self._paper_engine.start()

                yield self._event_response(
                    event_type=trading_pb2.StartTradingResponse.EVENT_TYPE_STARTED,
                    message=f"Paper trading session started for {instruments}",
                )
            except Exception as exc:
                yield self._event_response(
                    event_type=trading_pb2.StartTradingResponse.EVENT_TYPE_ERROR,
                    message=f"Failed to start paper trading: {exc}",
                )
                return
        else:
            # Live mode: delegate to NautilusTrader
            node = self._get_node()
            try:
                await node.start_trading(
                    strategy_path=request.strategy_path,
                    mode=mode,
                    venue=request.venue,
                    instruments=list(request.instruments),
                    config_json=request.config_json,
                    on_event=on_event,
                )
                yield self._event_response(
                    event_type=trading_pb2.StartTradingResponse.EVENT_TYPE_STARTED,
                    message=f"Trading session started in {mode} mode",
                )
            except Exception as exc:
                yield self._event_response(
                    event_type=trading_pb2.StartTradingResponse.EVENT_TYPE_ERROR,
                    message=f"Failed to start trading session: {exc}",
                )
                return

        # Keep streaming until stop, error, or client disconnect.
        while True:
            if context.cancelled():
                break

            try:
                payload = await asyncio.wait_for(queue.get(), timeout=0.5)
            except TimeoutError:
                continue

            response = self._response_from_payload(payload)
            yield response

            if response.type in {
                trading_pb2.StartTradingResponse.EVENT_TYPE_STOPPED,
                trading_pb2.StartTradingResponse.EVENT_TYPE_ERROR,
            }:
                break

    async def StopTrading(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Kill switch stop: cancel all orders, flatten, and disconnect."""
        del request
        del context

        try:
            if self._paper_engine is not None and self._paper_engine.is_running:
                await self._paper_engine.stop()
                self._paper_engine = None
                return trading_pb2.StopTradingResponse(success=True)

            # Safety invariant: StopTrading always flattens regardless of request flag.
            await self._get_node().stop_trading(flatten_positions=True)
            return trading_pb2.StopTradingResponse(success=True)
        except Exception:
            return trading_pb2.StopTradingResponse(success=False)

    async def GetPositions(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Return current open positions."""
        del request
        del context

        if self._paper_engine is not None and self._paper_engine.is_running:
            positions = self._paper_engine.position_manager.open_positions
            return trading_pb2.GetPositionsResponse(
                positions=[
                    trading_pb2.Position(
                        instrument=p.instrument,
                        quantity=p.quantity,
                        avg_price=p.avg_price,
                        unrealized_pnl=p.unrealized_pnl,
                        realized_pnl=p.realized_pnl,
                    )
                    for p in positions
                ]
            )

        positions = await self._get_node().get_positions()
        return trading_pb2.GetPositionsResponse(
            positions=[
                trading_pb2.Position(
                    instrument=str(item.get("instrument", "")),
                    quantity=float(item.get("quantity", 0.0)),
                    avg_price=float(item.get("avg_price", 0.0)),
                    unrealized_pnl=float(item.get("unrealized_pnl", 0.0)),
                    realized_pnl=float(item.get("realized_pnl", 0.0)),
                )
                for item in positions
            ]
        )

    async def GetOrders(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Return order history (most recent first when provided by backend)."""
        del context

        if self._paper_engine is not None and self._paper_engine.is_running:
            all_orders = self._paper_engine.orderbook_sim.all_orders
            if request.limit > 0:
                all_orders = all_orders[-request.limit:]
            return trading_pb2.GetOrdersResponse(
                orders=[
                    trading_pb2.Order(
                        id=o.id,
                        instrument=o.instrument,
                        side=o.side.value,
                        type=o.order_type.value,
                        quantity=o.quantity,
                        price=o.price,
                        status=o.status.value,
                        timestamp=o.created_at,
                        filled_quantity=o.filled_quantity,
                    )
                    for o in reversed(all_orders)
                ]
            )

        orders = await self._get_node().get_orders(limit=request.limit)
        return trading_pb2.GetOrdersResponse(
            orders=[
                trading_pb2.Order(
                    id=str(item.get("id", "")),
                    instrument=str(item.get("instrument", "")),
                    side=str(item.get("side", "")),
                    type=str(item.get("type", "")),
                    quantity=float(item.get("quantity", 0.0)),
                    price=float(item.get("price", 0.0)),
                    status=str(item.get("status", "")),
                    timestamp=str(item.get("timestamp", "")),
                )
                for item in orders
            ]
        )

    async def SubmitOrder(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Submit a new order to the active trading session."""
        del context

        if self._paper_engine is not None and self._paper_engine.is_running:
            try:
                order = self._paper_engine.submit_order(
                    instrument=request.instrument,
                    side=request.side,
                    order_type=request.type,
                    quantity=request.quantity,
                    price=request.price,
                )
                return trading_pb2.SubmitOrderResponse(order_id=order.id, success=True)
            except Exception:
                return trading_pb2.SubmitOrderResponse(order_id="", success=False)

        venue = (request.venue or "").strip().upper()
        if venue and venue not in {"SIM", ""}:
            try:
                create_exchange_config(venue)
            except ValueError as exc:
                return trading_pb2.SubmitOrderResponse(order_id="", success=False)

        try:
            order_id = await self._get_node().submit_order(
                instrument=request.instrument,
                side=request.side,
                order_type=request.type,
                quantity=request.quantity,
                price=request.price,
            )
            return trading_pb2.SubmitOrderResponse(order_id=order_id, success=True)
        except Exception:
            return trading_pb2.SubmitOrderResponse(order_id="", success=False)

    async def GetAccountSummary(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Return aggregated account summary for risk engine PnL queries."""
        del request
        del context

        if self._paper_engine is not None and self._paper_engine.is_running:
            summary = self._paper_engine.position_manager.get_account_summary()
            return trading_pb2.GetAccountSummaryResponse(
                total_position_value=summary["total_position_value"],
                daily_pnl=summary["daily_pnl"],
                margin_used=summary["margin_used"],
                available_balance=summary["available_balance"],
                open_position_count=summary["open_position_count"],
            )

        try:
            positions = await self._get_node().get_positions()
            total_value = sum(
                abs(float(p.get("quantity", 0)) * float(p.get("avg_price", 0)))
                for p in positions
            )
            daily_pnl = sum(
                float(p.get("realized_pnl", 0)) + float(p.get("unrealized_pnl", 0))
                for p in positions
            )
            return trading_pb2.GetAccountSummaryResponse(
                total_position_value=total_value,
                daily_pnl=daily_pnl,
                margin_used=0.0,
                available_balance=0.0,
                open_position_count=len(positions),
            )
        except Exception:
            return trading_pb2.GetAccountSummaryResponse()

    async def CancelOrder(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Cancel a pending order by ID."""
        del context

        if self._paper_engine is not None and self._paper_engine.is_running:
            ok = self._paper_engine.cancel_order(order_id=request.order_id)
            return trading_pb2.CancelOrderResponse(success=ok)

        try:
            ok = await self._get_node().cancel_order(order_id=request.order_id)
            return trading_pb2.CancelOrderResponse(success=ok)
        except Exception:
            return trading_pb2.CancelOrderResponse(success=False)

    def _response_from_payload(
        self,
        payload: dict[str, Any],
    ) -> Any:
        event_map = {
            "started": trading_pb2.StartTradingResponse.EVENT_TYPE_STARTED,
            "order_filled": trading_pb2.StartTradingResponse.EVENT_TYPE_ORDER_FILLED,
            "position_changed": trading_pb2.StartTradingResponse.EVENT_TYPE_POSITION_CHANGED,
            "pnl_update": trading_pb2.StartTradingResponse.EVENT_TYPE_PNL_UPDATE,
            "error": trading_pb2.StartTradingResponse.EVENT_TYPE_ERROR,
            "stopped": trading_pb2.StartTradingResponse.EVENT_TYPE_STOPPED,
        }
        event_type = event_map.get(
            str(payload.get("type", "")).lower(),
            trading_pb2.StartTradingResponse.EVENT_TYPE_UNSPECIFIED,
        )
        message = str(payload.get("message", ""))
        data = payload.get("data", {})
        timestamp = str(payload.get("timestamp", ""))

        return self._event_response(
            event_type=event_type,
            message=message,
            data=data if isinstance(data, dict) else {"value": data},
            timestamp=timestamp,
        )

    def _event_response(
        self,
        *,
        event_type: int,
        message: str,
        data: dict[str, Any] | None = None,
        timestamp: str | None = None,
    ) -> Any:
        return trading_pb2.StartTradingResponse(
            type=event_type,
            message=message,
            data_json=json.dumps(data or {}),
            timestamp=timestamp or datetime.now(timezone.utc).isoformat(),
        )
