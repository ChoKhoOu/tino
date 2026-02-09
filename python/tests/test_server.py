"""Tests for gRPC server: health check, DaemonService, and service stubs."""

from __future__ import annotations

import json

import grpc
import pytest
from grpc_health.v1 import health_pb2, health_pb2_grpc


@pytest.mark.asyncio
async def test_health_check_serving(daemon_server):
    """Health check should return SERVING."""
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = health_pb2_grpc.HealthStub(channel)
        resp = await stub.Check(health_pb2.HealthCheckRequest(service=""))
        assert resp.status == health_pb2.HealthCheckResponse.SERVING


@pytest.mark.asyncio
async def test_get_system_info(daemon_server):
    """GetSystemInfo should return valid JSON with expected fields."""
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        resp = await channel.unary_unary(
            "/tino.daemon.v1.DaemonService/GetSystemInfo",
            request_serializer=None,
            response_deserializer=None,
        )(b"")

        info = json.loads(resp)
        assert "python_version" in info
        assert "nautilus_trader_version" in info
        assert "memory_total_mb" in info
        assert "uptime_seconds" in info
        assert "pid" in info
        assert info["uptime_seconds"] >= 0


@pytest.mark.asyncio
async def test_shutdown_rpc(daemon_server):
    """Shutdown RPC should return success status."""
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        resp = await channel.unary_unary(
            "/tino.daemon.v1.DaemonService/Shutdown",
            request_serializer=None,
            response_deserializer=None,
        )(b"")

        result = json.loads(resp)
        assert result["status"] == "shutting_down"


@pytest.mark.asyncio
async def test_unimplemented_service_stub(daemon_server):
    """Calling an unimplemented service should return UNIMPLEMENTED or UNAVAILABLE."""
    server, port = daemon_server

    # The backtest stub isn't registered in the test fixture, so this should fail
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        try:
            await channel.unary_unary(
                "/tino.backtest.v1.BacktestService/RunBacktest",
                request_serializer=None,
                response_deserializer=None,
            )(b"")
            assert False, "Should have raised"
        except grpc.aio.AioRpcError as exc:
            # UNIMPLEMENTED if stub is registered, UNIMPLEMENTED if not
            assert exc.code() in (
                grpc.StatusCode.UNIMPLEMENTED,
                grpc.StatusCode.UNAVAILABLE,
            )
