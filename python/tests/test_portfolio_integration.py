# pyright: reportMissingImports=false, reportAttributeAccessIssue=false, reportDeprecated=false, reportUnknownParameterType=false, reportMissingParameterType=false, reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownArgumentType=false, reportUnusedCallResult=false

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path

import grpc
import pytest
import pytest_asyncio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

from tino_daemon.persistence.portfolio_db import PortfolioDB
from tino_daemon.proto.tino.chart.v1 import chart_pb2, chart_pb2_grpc
from tino_daemon.proto.tino.portfolio.v1 import portfolio_pb2, portfolio_pb2_grpc
from tino_daemon.services.chart import ChartServiceServicer
from tino_daemon.services.daemon import DaemonServicer
from tino_daemon.services.portfolio import PortfolioServiceServicer

SERVING_STATUS = 1


@pytest_asyncio.fixture
async def portfolio_server(
    tmp_path: Path,
) -> AsyncGenerator[tuple[grpc.aio.Server, int, PortfolioDB], None]:
    shutdown_event = asyncio.Event()
    server = grpc.aio.server()

    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    await health_servicer.set("", SERVING_STATUS)

    daemon_svc = DaemonServicer(shutdown_event=shutdown_event)
    daemon_svc.register(server)

    db = PortfolioDB(db_path=str(tmp_path / "portfolio.db"))
    portfolio_svc = PortfolioServiceServicer(db=db)
    portfolio_pb2_grpc.add_PortfolioServiceServicer_to_server(portfolio_svc, server)

    chart_svc = ChartServiceServicer()
    chart_pb2_grpc.add_ChartServiceServicer_to_server(chart_svc, server)

    service_names = (
        health_pb2.DESCRIPTOR.services_by_name["Health"].full_name,
        "tino.daemon.v1.DaemonService",
        portfolio_pb2.DESCRIPTOR.services_by_name["PortfolioService"].full_name,
        chart_pb2.DESCRIPTOR.services_by_name["ChartService"].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)

    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port, db
    await server.stop(grace=0)
    db.close()


@pytest.mark.asyncio
async def test_portfolio_service_registered_via_reflection(portfolio_server):
    _server, port, _db = portfolio_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)
        resp = await stub.GetSummary(portfolio_pb2.GetSummaryRequest())
        assert resp.total_trades == 0
        assert resp.open_positions == 0


@pytest.mark.asyncio
async def test_chart_service_registered_via_reflection(portfolio_server):
    _server, port, _db = portfolio_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = chart_pb2_grpc.ChartServiceStub(channel)
        resp = await stub.RenderLineChart(
            chart_pb2.RenderLineChartRequest(
                labels=["a", "b", "c"],
                values=[1.0, 2.0, 3.0],
                width=40,
                height=10,
                title="test",
            )
        )
        assert isinstance(resp.ansi_chart, str)


@pytest.mark.asyncio
async def test_record_trade_then_query(portfolio_server):
    _server, port, _db = portfolio_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        record_resp = await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="trade-001",
                instrument="AAPL.XNAS",
                side="BUY",
                quantity=100.0,
                price=150.50,
                fee=1.0,
                venue="XNAS",
                timestamp="2026-02-10T10:00:00Z",
                order_id="order-001",
                strategy="momentum",
            )
        )
        assert record_resp.success is True
        assert record_resp.trade_id == "trade-001"

        trades_resp = await stub.GetTrades(
            portfolio_pb2.GetTradesRequest(instrument="AAPL.XNAS", limit=10)
        )
        assert len(trades_resp.trades) == 1
        t = trades_resp.trades[0]
        assert t.id == "trade-001"
        assert t.instrument == "AAPL.XNAS"
        assert t.side == "BUY"
        assert t.quantity == 100.0
        assert t.price == 150.50

        positions_resp = await stub.GetPositions(
            portfolio_pb2.GetPositionsRequest(instrument="AAPL.XNAS")
        )
        assert len(positions_resp.positions) == 1
        pos = positions_resp.positions[0]
        assert pos.instrument == "AAPL.XNAS"
        assert pos.quantity == 100.0
        assert pos.avg_price == 150.50

        summary_resp = await stub.GetSummary(portfolio_pb2.GetSummaryRequest())
        assert summary_resp.total_trades == 1
        assert summary_resp.open_positions == 1
        assert summary_resp.total_fees == 1.0


@pytest.mark.asyncio
async def test_portfolio_data_persists_across_db_restart(portfolio_server):
    _server, port, db = portfolio_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="persist-001",
                instrument="MSFT.XNAS",
                side="BUY",
                quantity=50.0,
                price=400.0,
                fee=0.5,
                venue="XNAS",
                timestamp="2026-02-10T12:00:00Z",
            )
        )

    db_path = db.db_path
    db.close()

    reopened = PortfolioDB(db_path=db_path)
    trades = reopened.get_trades(instrument="MSFT.XNAS")
    assert len(trades) == 1
    assert trades[0]["id"] == "persist-001"
    assert trades[0]["price"] == 400.0

    positions = reopened.get_positions(instrument="MSFT.XNAS")
    assert len(positions) == 1
    assert positions[0]["quantity"] == 50.0
    reopened.close()
