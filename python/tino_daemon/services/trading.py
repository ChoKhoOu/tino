"""TradingService gRPC implementation."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator

import grpc

from tino_daemon.nautilus.node import TradingNodeWrapper
from tino_daemon.node_registry import NodeRegistry
from tino_daemon.proto.tino.trading.v1 import trading_pb2, trading_pb2_grpc


class TradingServiceServicer(trading_pb2_grpc.TradingServiceServicer):
    def __init__(
        self,
        node: Any | None = None,
        registry: NodeRegistry | None = None,
    ) -> None:
        self._node = node
        self._registry = registry

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

        # Keep streaming until the node reports stop, emits error, or client disconnects.
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

    async def CancelOrder(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        """Cancel a pending order by ID."""
        del context

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
