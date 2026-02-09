"""Shared pytest fixtures for tino_daemon tests."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import AsyncGenerator

import grpc
import pytest
import pytest_asyncio

from tino_daemon.config import DaemonConfig

# Proto-generated code uses absolute imports like `from tino.data.v1 import data_pb2`
# so the proto output root must be on sys.path.
_PROTO_ROOT = str(Path(__file__).resolve().parent.parent / "tino_daemon" / "proto")
if _PROTO_ROOT not in sys.path:
    sys.path.insert(0, _PROTO_ROOT)


@pytest.fixture
def config() -> DaemonConfig:
    """Create a test config with a random available port."""
    return DaemonConfig(port=0, log_level="DEBUG", pid_file="/tmp/tino_test.pid")


@pytest_asyncio.fixture
async def daemon_server(
    config: DaemonConfig,
) -> AsyncGenerator[tuple[grpc.aio.Server, int], None]:
    """Start a daemon gRPC server on a random port, yield (server, port), then stop."""
    from tino_daemon.services.daemon import DaemonServicer
    from grpc_health.v1 import health, health_pb2, health_pb2_grpc
    from grpc_reflection.v1alpha import reflection

    shutdown_event = asyncio.Event()
    server = grpc.aio.server()

    # Health
    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    await health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)

    # Daemon
    daemon_svc = DaemonServicer(shutdown_event=shutdown_event)
    daemon_svc.register(server)

    # Reflection
    service_names = (
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        "tino.daemon.v1.DaemonService",
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)

    # Bind to port 0 = random available port
    port = server.add_insecure_port("[::]:0")
    await server.start()

    yield server, port

    await server.stop(grace=0)
