"""Tests for gRPC server: health check, DaemonService, and service stubs."""

from __future__ import annotations

import grpc
import pytest
from grpc_health.v1 import health_pb2, health_pb2_grpc

from tino_daemon.proto.tino.daemon.v1 import daemon_pb2, daemon_pb2_grpc


@pytest.mark.asyncio
async def test_health_check_serving(daemon_server):
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = health_pb2_grpc.HealthStub(channel)
        resp = await stub.Check(health_pb2.HealthCheckRequest(service=""))
        assert resp.status == health_pb2.HealthCheckResponse.SERVING


@pytest.mark.asyncio
async def test_get_system_info(daemon_server):
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = daemon_pb2_grpc.DaemonServiceStub(channel)
        resp = await stub.GetSystemInfo(daemon_pb2.GetSystemInfoRequest())

        assert resp.python_version != ""
        assert resp.nautilus_version != ""
        assert resp.memory_usage_bytes > 0
        assert float(resp.uptime) >= 0


@pytest.mark.asyncio
async def test_shutdown_rpc(daemon_server):
    server, port = daemon_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = daemon_pb2_grpc.DaemonServiceStub(channel)
        resp = await stub.Shutdown(daemon_pb2.ShutdownRequest())

        assert resp.success is True


@pytest.mark.asyncio
async def test_unimplemented_service_stub(daemon_server):
    server, port = daemon_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        try:
            await channel.unary_unary(
                "/tino.backtest.v1.BacktestService/RunBacktest",
                request_serializer=None,
                response_deserializer=None,
            )(b"")
            assert False, "Should have raised"
        except grpc.aio.AioRpcError as exc:
            assert exc.code() in (
                grpc.StatusCode.UNIMPLEMENTED,
                grpc.StatusCode.UNAVAILABLE,
            )
