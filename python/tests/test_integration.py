"""Integration tests covering cross-service daemon workflows."""

# pyright: reportMissingImports=false, reportAttributeAccessIssue=false, reportDeprecated=false, reportUnknownParameterType=false, reportMissingParameterType=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnusedCallResult=false, reportImplicitStringConcatenation=false

from __future__ import annotations

import asyncio
from pathlib import Path
from collections.abc import AsyncGenerator

import grpc
import pytest
import pytest_asyncio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc
from tino_daemon.proto.tino.daemon.v1 import daemon_pb2, daemon_pb2_grpc
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.proto.tino.trading.v1 import trading_pb2, trading_pb2_grpc
from tino_daemon.services.backtest import BacktestServiceServicer
from tino_daemon.services.daemon import DaemonServicer
from tino_daemon.services.data import DataServiceServicer
from tino_daemon.services.trading import TradingServiceServicer


SERVING_STATUS = 1


class _FakeTradingNode:
    async def get_positions(self) -> list[dict[str, object]]:
        return []

    async def get_orders(self, *, limit: int = 0) -> list[dict[str, object]]:
        del limit
        return []

    async def stop_trading(self, *, flatten_positions: bool = True) -> None:
        del flatten_positions

    async def submit_order(self, **kwargs: object) -> str:
        del kwargs
        return "order-1"

    async def cancel_order(self, *, order_id: str) -> bool:
        del order_id
        return True


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    csv_file = tmp_path / "integration_ohlcv.csv"
    csv_file.write_text(
        "date,open,high,low,close,volume\n"
        "2024-01-02,100.0,105.0,99.0,104.0,1000000\n"
        "2024-01-03,104.0,106.0,103.0,105.5,1200000\n"
        "2024-01-04,105.5,108.0,104.0,107.0,1100000\n",
        encoding="utf-8",
    )
    return csv_file


@pytest_asyncio.fixture
async def integration_server(
    tmp_path: Path,
) -> AsyncGenerator[tuple[grpc.aio.Server, int], None]:
    shutdown_event = asyncio.Event()
    server = grpc.aio.server()

    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    await health_servicer.set("", SERVING_STATUS)

    daemon_service = DaemonServicer(shutdown_event=shutdown_event)
    daemon_pb2_grpc.add_DaemonServiceServicer_to_server(daemon_service, server)

    catalog = DataCatalogWrapper(catalog_path=str(tmp_path / "catalog"))
    data_pb2_grpc.add_DataServiceServicer_to_server(
        DataServiceServicer(catalog=catalog),
        server,
    )
    backtest_pb2_grpc.add_BacktestServiceServicer_to_server(
        BacktestServiceServicer(
            catalog=catalog, backtests_dir=str(tmp_path / "backtests")
        ),
        server,
    )
    trading_pb2_grpc.add_TradingServiceServicer_to_server(
        TradingServiceServicer(node=_FakeTradingNode()),
        server,
    )

    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port
    await server.stop(grace=0)


@pytest.mark.asyncio
async def test_data_and_backtest_services_work_together(
    integration_server,
    sample_csv: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    server, port = integration_server
    del server

    async def fake_run_backtest(_self, **kwargs):
        kwargs["on_progress"](25.0, "loading")
        kwargs["on_progress"](75.0, "running")
        return backtest_pb2.BacktestResult(
            id="integration-bt-1",
            total_return=0.11,
            sharpe_ratio=1.1,
            max_drawdown=0.07,
            sortino_ratio=1.5,
            total_trades=10,
            winning_trades=6,
            win_rate=0.6,
            profit_factor=1.3,
            equity_curve_json="[]",
            trades_json="[]",
            created_at="2026-02-10T00:00:00Z",
        )

    monkeypatch.setattr(
        "tino_daemon.nautilus.engine.BacktestEngineWrapper.run_backtest",
        fake_run_backtest,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        data_stub = data_pb2_grpc.DataServiceStub(channel)
        backtest_stub = backtest_pb2_grpc.BacktestServiceStub(channel)

        ingest_request = data_pb2.IngestDataRequest(
            source="csv",
            instrument=str(sample_csv),
            bar_type="AAPL.XNAS-1-DAY-LAST-EXTERNAL",
        )
        ingest_events = [event async for event in data_stub.IngestData(ingest_request)]
        completed = [
            event
            for event in ingest_events
            if event.type == data_pb2.IngestDataResponse.EVENT_TYPE_COMPLETED
        ]
        assert completed
        assert completed[-1].rows_ingested == 3

        run_request = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-DAY-LAST-EXTERNAL",
            start_date="2024-01-02",
            end_date="2024-01-04",
            config_json="{}",
        )
        backtest_events = [
            event async for event in backtest_stub.RunBacktest(run_request)
        ]
        assert (
            backtest_events[-1].type
            == backtest_pb2.RunBacktestResponse.EVENT_TYPE_COMPLETED
        )
        assert backtest_events[-1].result.id == "integration-bt-1"


@pytest.mark.asyncio
async def test_all_services_registered_on_server(integration_server):
    server, port = integration_server
    del server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        data_stub = data_pb2_grpc.DataServiceStub(channel)
        backtest_stub = backtest_pb2_grpc.BacktestServiceStub(channel)
        trading_stub = trading_pb2_grpc.TradingServiceStub(channel)

        data_resp = await data_stub.ListCatalog(data_pb2.ListCatalogRequest())
        backtest_resp = await backtest_stub.ListResults(
            backtest_pb2.ListResultsRequest()
        )
        trading_resp = await trading_stub.GetPositions(
            trading_pb2.GetPositionsRequest()
        )
        daemon_stub = daemon_pb2_grpc.DaemonServiceStub(channel)
        daemon_resp = await daemon_stub.GetSystemInfo(daemon_pb2.GetSystemInfoRequest())

        assert len(data_resp.entries) >= 0
        assert len(backtest_resp.results) >= 0
        assert len(trading_resp.positions) >= 0
        assert daemon_resp.python_version != ""


@pytest.mark.asyncio
async def test_health_check_returns_serving(integration_server):
    server, port = integration_server
    del server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        health_stub = health_pb2_grpc.HealthStub(channel)
        response = await health_stub.Check(health_pb2.HealthCheckRequest(service=""))
        assert response.status == SERVING_STATUS
