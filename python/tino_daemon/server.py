"""gRPC server setup with health checking, reflection, and graceful shutdown."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

import grpc
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from tino_daemon.config import DaemonConfig
from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.services.backtest import BacktestServiceServicer
from tino_daemon.services.daemon import DaemonServicer
from tino_daemon.services.data import DataServiceServicer

logger = logging.getLogger(__name__)


def _write_pid_file(path: str) -> None:
    """Write current PID to file, creating parent dirs if needed."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(os.getpid()))
    logger.info("PID %d written to %s", os.getpid(), path)


def _remove_pid_file(path: str) -> None:
    """Remove PID file if it exists."""
    try:
        Path(path).unlink(missing_ok=True)
        logger.info("PID file removed: %s", path)
    except OSError as exc:
        logger.warning("Failed to remove PID file: %s", exc)


async def serve(config: DaemonConfig) -> None:
    """Start the gRPC server and block until shutdown."""
    shutdown_event = asyncio.Event()

    server = grpc.aio.server()

    # --- Health service ---
    health_servicer = health.aio.HealthServicer()  # type: ignore[attr-defined]
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    # Mark overall server as SERVING
    await health_servicer.set(
        "",  # overall server status
        health_pb2.HealthCheckResponse.SERVING,
    )

    # --- DaemonService (hand-rolled, no proto codegen needed) ---
    daemon_servicer = DaemonServicer(shutdown_event=shutdown_event)
    daemon_servicer.register(server)

    # --- DataService (proto-generated servicer base) ---
    catalog = DataCatalogWrapper()
    data_servicer = DataServiceServicer(catalog=catalog)
    data_pb2_grpc.add_DataServiceServicer_to_server(data_servicer, server)

    # --- BacktestService (proto-generated servicer base) ---
    backtest_servicer = BacktestServiceServicer(catalog=catalog)
    backtest_pb2_grpc.add_BacktestServiceServicer_to_server(backtest_servicer, server)

    # --- Reflection (enables grpcurl discovery) ---
    service_names = (
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        "tino.daemon.v1.DaemonService",
        data_pb2.DESCRIPTOR.services_by_name["DataService"].full_name,
        backtest_pb2.DESCRIPTOR.services_by_name["BacktestService"].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)

    # --- Bind to port ---
    listen_addr = f"[::]:{config.port}"
    server.add_insecure_port(listen_addr)

    await server.start()
    logger.info("Tino daemon listening on %s", listen_addr)

    # Write PID file
    _write_pid_file(config.pid_file)

    # --- Signal handling for graceful shutdown ---
    loop = asyncio.get_running_loop()

    def _signal_handler(sig: int) -> None:
        sig_name = signal.Signals(sig).name
        logger.info("Received %s — initiating graceful shutdown", sig_name)
        shutdown_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _signal_handler, sig)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            signal.signal(sig, lambda s, f: _signal_handler(s))

    # Wait for shutdown signal
    await shutdown_event.wait()

    logger.info("Shutting down gRPC server (5s grace period)...")
    await health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)
    await server.stop(grace=5)

    _remove_pid_file(config.pid_file)
    logger.info("Tino daemon stopped.")
