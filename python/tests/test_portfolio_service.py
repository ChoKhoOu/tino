# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import AsyncGenerator

import grpc
import pytest
import pytest_asyncio

from tino_daemon.persistence.portfolio_db import PortfolioDB
from tino_daemon.proto.tino.portfolio.v1 import portfolio_pb2, portfolio_pb2_grpc
from tino_daemon.services.portfolio import PortfolioServiceServicer


@pytest.fixture
def db_path(tmp_path: Path) -> str:
    return str(tmp_path / "test_portfolio.db")


@pytest.fixture
def db(db_path: str) -> PortfolioDB:
    return PortfolioDB(db_path=db_path)


@pytest_asyncio.fixture
async def portfolio_server(
    db: PortfolioDB,
) -> AsyncGenerator[tuple[grpc.aio.Server, int, PortfolioDB], None]:
    servicer = PortfolioServiceServicer(db=db)
    server = grpc.aio.server()
    portfolio_pb2_grpc.add_PortfolioServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port, db
    await server.stop(grace=0)


def test_db_schema_has_four_tables(db: PortfolioDB) -> None:
    conn = sqlite3.connect(db.db_path)
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = sorted(row[0] for row in cursor.fetchall())
    conn.close()
    assert tables == ["daily_pnl", "positions", "schema_version", "trades"]


def test_wal_mode_enabled(db: PortfolioDB) -> None:
    conn = sqlite3.connect(db.db_path)
    mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    conn.close()
    assert mode == "wal"


@pytest.mark.asyncio
async def test_record_trade_and_query_by_instrument(
    portfolio_server: tuple[grpc.aio.Server, int, PortfolioDB],
) -> None:
    _server, port, _db = portfolio_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        # given — a recorded trade
        resp = await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="t-001",
                instrument="AAPL",
                side="BUY",
                quantity=100.0,
                price=150.0,
                fee=1.0,
                venue="NASDAQ",
                timestamp="2026-02-10T10:00:00Z",
                order_id="o-001",
                strategy="momentum",
            )
        )
        assert resp.success is True
        assert resp.trade_id == "t-001"

        # when — querying by instrument
        trades_resp = await stub.GetTrades(
            portfolio_pb2.GetTradesRequest(instrument="AAPL")
        )

        # then
        assert len(trades_resp.trades) == 1
        assert trades_resp.trades[0].instrument == "AAPL"
        assert trades_resp.trades[0].quantity == 100.0
        assert trades_resp.trades[0].price == 150.0


@pytest.mark.asyncio
async def test_record_trade_and_query_by_date_range(
    portfolio_server: tuple[grpc.aio.Server, int, PortfolioDB],
) -> None:
    _server, port, _db = portfolio_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        # given — two trades on different dates
        await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="t-010",
                instrument="MSFT",
                side="BUY",
                quantity=50.0,
                price=300.0,
                fee=0.5,
                venue="NASDAQ",
                timestamp="2026-01-15T10:00:00Z",
            )
        )
        await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="t-011",
                instrument="MSFT",
                side="SELL",
                quantity=25.0,
                price=310.0,
                fee=0.5,
                venue="NASDAQ",
                timestamp="2026-02-05T10:00:00Z",
            )
        )

        # when — narrowing to February only
        trades_resp = await stub.GetTrades(
            portfolio_pb2.GetTradesRequest(
                instrument="MSFT",
                start_date="2026-02-01",
                end_date="2026-02-28",
            )
        )

        # then — only the second trade
        assert len(trades_resp.trades) == 1
        assert trades_resp.trades[0].id == "t-011"

        # when — full year range
        all_resp = await stub.GetTrades(
            portfolio_pb2.GetTradesRequest(
                instrument="MSFT",
                start_date="2026-01-01",
                end_date="2026-12-31",
            )
        )

        # then — both trades
        assert len(all_resp.trades) == 2


@pytest.mark.asyncio
async def test_get_positions_summary(
    portfolio_server: tuple[grpc.aio.Server, int, PortfolioDB],
) -> None:
    _server, port, db = portfolio_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        # given — a buy trade
        await stub.RecordTrade(
            portfolio_pb2.RecordTradeRequest(
                id="t-020",
                instrument="TSLA",
                side="BUY",
                quantity=10.0,
                price=200.0,
                fee=1.0,
                venue="NASDAQ",
                timestamp="2026-02-10T10:00:00Z",
            )
        )

        # when — querying positions
        pos_resp = await stub.GetPositions(
            portfolio_pb2.GetPositionsRequest(instrument="TSLA")
        )

        # then
        assert len(pos_resp.positions) == 1
        pos = pos_resp.positions[0]
        assert pos.instrument == "TSLA"
        assert pos.quantity == 10.0
        assert pos.avg_price == 200.0

        # when — querying summary
        summary = await stub.GetSummary(portfolio_pb2.GetSummaryRequest())

        # then
        assert summary.total_trades == 1
        assert summary.open_positions == 1
        assert summary.total_fees == 1.0


def test_data_persists_across_restart(db_path: str) -> None:
    # given — data written and DB closed
    db1 = PortfolioDB(db_path=db_path)
    db1.record_trade(
        trade_id="t-persist",
        instrument="GOOG",
        side="BUY",
        quantity=5.0,
        price=100.0,
        fee=0.0,
        venue="NASDAQ",
        timestamp="2026-02-10T10:00:00Z",
    )
    db1.close()

    # when — reopened
    db2 = PortfolioDB(db_path=db_path)
    trades = db2.get_trades(instrument="GOOG")

    # then — data still present
    assert len(trades) == 1
    assert trades[0]["id"] == "t-persist"
    assert trades[0]["quantity"] == 5.0
    db2.close()


@pytest.mark.asyncio
async def test_get_pnl_history(
    portfolio_server: tuple[grpc.aio.Server, int, PortfolioDB],
) -> None:
    _server, port, db = portfolio_server

    # given — PnL data recorded
    db.record_daily_pnl(
        date="2026-02-10",
        instrument="AAPL",
        total_pnl=150.0,
        realized_pnl=100.0,
        unrealized_pnl=50.0,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = portfolio_pb2_grpc.PortfolioServiceStub(channel)

        # when
        resp = await stub.GetPnLHistory(
            portfolio_pb2.GetPnLHistoryRequest(
                instrument="AAPL",
                start_date="2026-02-01",
                end_date="2026-02-28",
            )
        )

        # then
        assert len(resp.entries) == 1
        assert resp.entries[0].total_pnl == 150.0
        assert resp.entries[0].realized_pnl == 100.0
