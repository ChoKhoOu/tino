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
from tino_daemon.node_registry import NodeRegistry
from tino_daemon.persistence.portfolio_db import PortfolioDB
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc
from tino_daemon.proto.tino.chart.v1 import chart_pb2, chart_pb2_grpc
from tino_daemon.proto.tino.daemon.v1 import daemon_pb2, daemon_pb2_grpc
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.proto.tino.exchange.v1 import exchange_pb2, exchange_pb2_grpc
from tino_daemon.proto.tino.portfolio.v1 import portfolio_pb2, portfolio_pb2_grpc
from tino_daemon.proto.tino.streaming.v1 import streaming_pb2, streaming_pb2_grpc
from tino_daemon.proto.tino.trading.v1 import trading_pb2, trading_pb2_grpc
from tino_daemon.services.backtest import BacktestServiceServicer
from tino_daemon.services.chart import ChartServiceServicer
from tino_daemon.services.daemon import DaemonServicer
from tino_daemon.services.data import DataServiceServicer
from tino_daemon.services.exchange import ExchangeServiceServicer
from tino_daemon.services.portfolio import PortfolioServiceServicer
from tino_daemon.services.streaming import StreamingServiceServicer
from tino_daemon.services.trading import TradingServiceServicer

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

    # --- DaemonService (proto-generated servicer base) ---
    daemon_servicer = DaemonServicer(
        shutdown_event=shutdown_event,
        service_names=["DataService", "BacktestService", "TradingService", "PortfolioService", "ChartService", "ExchangeService"],
    )
    daemon_pb2_grpc.add_DaemonServiceServicer_to_server(daemon_servicer, server)

    # --- DataService (proto-generated servicer base) ---
    catalog = DataCatalogWrapper()
    data_servicer = DataServiceServicer(catalog=catalog)
    data_pb2_grpc.add_DataServiceServicer_to_server(data_servicer, server)

    # --- BacktestService (proto-generated servicer base) ---
    backtest_servicer = BacktestServiceServicer(catalog=catalog)
    backtest_pb2_grpc.add_BacktestServiceServicer_to_server(backtest_servicer, server)

    # --- TradingService (proto-generated servicer base) ---
    node_registry = NodeRegistry()
    trading_servicer = TradingServiceServicer(registry=node_registry)
    trading_pb2_grpc.add_TradingServiceServicer_to_server(trading_servicer, server)

    # --- PortfolioService (proto-generated servicer base) ---
    Path(".tino").mkdir(parents=True, exist_ok=True)
    portfolio_db = PortfolioDB(db_path=".tino/portfolio.db")
    portfolio_servicer = PortfolioServiceServicer(db=portfolio_db)
    portfolio_pb2_grpc.add_PortfolioServiceServicer_to_server(
        portfolio_servicer, server
    )

    # --- ChartService (proto-generated servicer base) ---
    chart_servicer = ChartServiceServicer()
    chart_pb2_grpc.add_ChartServiceServicer_to_server(chart_servicer, server)

    # --- StreamingService (proto-generated servicer base) ---
    streaming_servicer = StreamingServiceServicer()
    streaming_pb2_grpc.add_StreamingServiceServicer_to_server(
        streaming_servicer, server
    )

    # --- ExchangeService (proto-generated servicer base) ---
    exchange_servicer = ExchangeServiceServicer()
    exchange_pb2_grpc.add_ExchangeServiceServicer_to_server(
        exchange_servicer, server
    )

    # --- Reflection (enables grpcurl discovery) ---
    service_names = (
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        daemon_pb2.DESCRIPTOR.services_by_name["DaemonService"].full_name,
        data_pb2.DESCRIPTOR.services_by_name["DataService"].full_name,
        backtest_pb2.DESCRIPTOR.services_by_name["BacktestService"].full_name,
        trading_pb2.DESCRIPTOR.services_by_name["TradingService"].full_name,
        portfolio_pb2.DESCRIPTOR.services_by_name["PortfolioService"].full_name,
        chart_pb2.DESCRIPTOR.services_by_name["ChartService"].full_name,
        streaming_pb2.DESCRIPTOR.services_by_name["StreamingService"].full_name,
        exchange_pb2.DESCRIPTOR.services_by_name["ExchangeService"].full_name,
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
