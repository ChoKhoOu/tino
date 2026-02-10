"""Tests for TradingService gRPC implementation."""

# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncGenerator

import grpc
import pytest
import pytest_asyncio

from tino_daemon.proto.tino.trading.v1 import trading_pb2, trading_pb2_grpc
from tino_daemon.services.trading import TradingServiceServicer


class FakeTradingNode:
    def __init__(self) -> None:
        self.stop_calls: list[bool] = []
        self.cancelled_orders: list[str] = []
        self.started_mode: str | None = None

    async def start_trading(
        self,
        *,
        strategy_path: str,
        mode: str,
        venue: str,
        instruments: list[str],
        config_json: str,
        on_event,
    ) -> None:
        del strategy_path, venue, instruments, config_json
        self.started_mode = mode
        on_event(
            {
                "type": "order_filled",
                "message": "fill",
                "data": {"order_id": "ord-1"},
            }
        )
        await asyncio.sleep(0)
        on_event({"type": "stopped", "message": "stopped", "data": {}})

    async def stop_trading(self, *, flatten_positions: bool = True) -> None:
        self.stop_calls.append(flatten_positions)

    async def get_positions(self) -> list[dict[str, Any]]:
        return [
            {
                "instrument": "BTCUSDT.BINANCE",
                "quantity": 1.5,
                "avg_price": 42000.0,
                "unrealized_pnl": 100.0,
                "realized_pnl": 20.0,
            }
        ]

    async def get_orders(self, *, limit: int = 0) -> list[dict[str, Any]]:
        del limit
        return [
            {
                "id": "ord-1",
                "instrument": "BTCUSDT.BINANCE",
                "side": "BUY",
                "type": "LIMIT",
                "quantity": 1.0,
                "price": 42000.0,
                "status": "NEW",
                "timestamp": "2026-02-10T00:00:00Z",
            }
        ]

    async def submit_order(
        self,
        *,
        instrument: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float,
    ) -> str:
        del instrument, side, order_type, quantity, price
        return "ord-created"

    async def cancel_order(self, *, order_id: str) -> bool:
        self.cancelled_orders.append(order_id)
        return True


@pytest_asyncio.fixture
async def trading_server() -> AsyncGenerator[
    tuple[grpc.aio.Server, int, FakeTradingNode], None
]:
    node = FakeTradingNode()
    servicer = TradingServiceServicer(node=node)
    server = grpc.aio.server()
    trading_pb2_grpc.add_TradingServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port, node
    await server.stop(grace=0)


@pytest.mark.asyncio
async def test_start_trading_streams_events(trading_server):
    server, port, node = trading_server
    del server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        request = trading_pb2.StartTradingRequest(
            strategy_path="strategies/demo.py",
            venue="BINANCE",
            instruments=["BTCUSDT.BINANCE"],
            config_json="{}",
        )

        events = [event async for event in stub.StartTrading(request)]
        types = [event.type for event in events]

        assert trading_pb2.StartTradingResponse.EVENT_TYPE_STARTED in types
        assert trading_pb2.StartTradingResponse.EVENT_TYPE_ORDER_FILLED in types
        assert trading_pb2.StartTradingResponse.EVENT_TYPE_STOPPED in types
        assert node.started_mode == "paper"


@pytest.mark.asyncio
async def test_stop_trading_forces_kill_switch(trading_server):
    server, port, node = trading_server
    del server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        response = await stub.StopTrading(
            trading_pb2.StopTradingRequest(flatten_positions=False)
        )

        assert response.success is True
        assert node.stop_calls == [True]


@pytest.mark.asyncio
async def test_get_positions_returns_positions(trading_server):
    server, port, node = trading_server
    del server, node
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        response = await stub.GetPositions(trading_pb2.GetPositionsRequest())
        assert len(response.positions) == 1
        assert response.positions[0].instrument == "BTCUSDT.BINANCE"
        assert response.positions[0].quantity == 1.5


@pytest.mark.asyncio
async def test_get_orders_returns_orders(trading_server):
    server, port, node = trading_server
    del server, node
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        response = await stub.GetOrders(trading_pb2.GetOrdersRequest(limit=10))
        assert len(response.orders) == 1
        assert response.orders[0].id == "ord-1"
        assert response.orders[0].status == "NEW"


@pytest.mark.asyncio
async def test_submit_order_creates_order(trading_server):
    server, port, node = trading_server
    del server, node
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        response = await stub.SubmitOrder(
            trading_pb2.SubmitOrderRequest(
                instrument="BTCUSDT.BINANCE",
                side="BUY",
                type="LIMIT",
                quantity=1.0,
                price=42000.0,
            )
        )
        assert response.success is True
        assert response.order_id == "ord-created"


@pytest.mark.asyncio
async def test_cancel_order_calls_node(trading_server):
    server, port, node = trading_server
    del server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = trading_pb2_grpc.TradingServiceStub(channel)
        response = await stub.CancelOrder(
            trading_pb2.CancelOrderRequest(order_id="ord-1")
        )
        assert response.success is True
        assert node.cancelled_orders == ["ord-1"]


@pytest.mark.asyncio
async def test_start_trading_streams_error_when_node_crashes(monkeypatch):
    class CrashingNode(FakeTradingNode):
        async def start_trading(self, **kwargs) -> None:
            del kwargs
            raise RuntimeError("boom")

    server = grpc.aio.server()
    servicer = TradingServiceServicer(node=CrashingNode())
    trading_pb2_grpc.add_TradingServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()

    try:
        async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
            stub = trading_pb2_grpc.TradingServiceStub(channel)
            events = [
                event
                async for event in stub.StartTrading(
                    trading_pb2.StartTradingRequest(strategy_path="strategies/demo.py")
                )
            ]
            error_events = [
                event
                for event in events
                if event.type == trading_pb2.StartTradingResponse.EVENT_TYPE_ERROR
            ]
            assert error_events
            assert "boom" in error_events[-1].message
    finally:
        await server.stop(grace=0)
