"""Tests for BacktestService gRPC implementation."""

# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import MagicMock

import grpc
import pytest
import pytest_asyncio

from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc
from tino_daemon.services.backtest import BacktestServiceServicer


def _sample_result(result_id: str) -> backtest_pb2.BacktestResult:
    return backtest_pb2.BacktestResult(
        id=result_id,
        total_return=0.12,
        sharpe_ratio=1.3,
        max_drawdown=0.08,
        sortino_ratio=1.8,
        total_trades=20,
        winning_trades=12,
        win_rate=0.6,
        profit_factor=1.4,
        equity_curve_json="[]",
        trades_json="[]",
        created_at="2026-02-10T00:00:00Z",
    )


@pytest_asyncio.fixture
async def backtest_server(
    tmp_path: Path,
) -> AsyncGenerator[tuple[grpc.aio.Server, int], None]:
    catalog = DataCatalogWrapper(catalog_path=str(tmp_path / "catalog"))
    servicer = BacktestServiceServicer(
        catalog=catalog,
        backtests_dir=str(tmp_path / "backtests"),
    )

    server = grpc.aio.server()
    backtest_pb2_grpc.add_BacktestServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port
    await server.stop(grace=0)


@pytest.mark.asyncio
async def test_run_backtest_streams_progress_events(
    backtest_server, monkeypatch: pytest.MonkeyPatch
):
    server, port = backtest_server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)

        # Patch class method so all servicer instances in-process use the fake.
        async def fake_run_backtest(self, **kwargs):
            kwargs["on_progress"](10.0, "loading")
            kwargs["on_progress"](60.0, "running")
            return _sample_result("bt-progress")

        monkeypatch.setattr(
            "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
            fake_run_backtest,
        )

        request = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )

        events = [event async for event in stub.RunBacktest(request)]
        progress_events = [
            e
            for e in events
            if e.type == backtest_pb2.RunBacktestResponse.EVENT_TYPE_PROGRESS
        ]

        assert len(progress_events) >= 2
        assert progress_events[0].progress_pct <= progress_events[-1].progress_pct


@pytest.mark.asyncio
async def test_run_backtest_returns_completed_result(
    backtest_server, monkeypatch: pytest.MonkeyPatch
):
    server, port = backtest_server
    del server

    async def fake_run_backtest(self, **kwargs):
        kwargs["on_progress"](50.0, "halfway")
        return _sample_result("bt-completed")

    monkeypatch.setattr(
        "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
        fake_run_backtest,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)
        request = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )

        events = [event async for event in stub.RunBacktest(request)]
        assert events[-1].type == backtest_pb2.RunBacktestResponse.EVENT_TYPE_COMPLETED
        assert events[-1].result.id == "bt-completed"


@pytest.mark.asyncio
async def test_cancel_backtest_sets_cancel_event(backtest_server):
    server, port = backtest_server
    del server

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)

        async def fake_run_backtest(self, **kwargs):
            kwargs["on_progress"](20.0, "running")
            for _ in range(50):
                if kwargs["cancel_event"].is_set():
                    raise asyncio.CancelledError
                await asyncio.sleep(0.01)
            return _sample_result("bt-cancel")

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(
            "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
            fake_run_backtest,
        )

        request = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )

        events: list[backtest_pb2.RunBacktestResponse] = []

        async def collect_events() -> None:
            async for event in stub.RunBacktest(request):
                events.append(event)

        task = asyncio.create_task(collect_events())
        await asyncio.sleep(0.05)
        assert events
        backtest_id = events[0].message.split(": ", 1)[1]

        resp = await stub.CancelBacktest(
            backtest_pb2.CancelBacktestRequest(id=backtest_id)
        )
        assert resp.success is True
        await task

        monkeypatch.undo()


@pytest.mark.asyncio
async def test_get_result_returns_stored_result(
    backtest_server, monkeypatch: pytest.MonkeyPatch
):
    server, port = backtest_server
    del server

    async def fake_run_backtest(self, **kwargs):
        return _sample_result("bt-get")

    monkeypatch.setattr(
        "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
        fake_run_backtest,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)
        req = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )
        _ = [event async for event in stub.RunBacktest(req)]

        resp = await stub.GetResult(backtest_pb2.GetResultRequest(id="bt-get"))
        assert resp.result.id == "bt-get"
        assert resp.result.total_trades == 20


@pytest.mark.asyncio
async def test_list_results_returns_all_results(
    backtest_server, monkeypatch: pytest.MonkeyPatch
):
    server, port = backtest_server
    del server

    ids = ["bt-1", "bt-2"]

    async def fake_run_backtest(self, **kwargs):
        return _sample_result(ids.pop(0))

    monkeypatch.setattr(
        "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
        fake_run_backtest,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)
        req = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )

        _ = [event async for event in stub.RunBacktest(req)]
        _ = [event async for event in stub.RunBacktest(req)]

        resp = await stub.ListResults(backtest_pb2.ListResultsRequest())
        result_ids = sorted([r.id for r in resp.results])
        assert result_ids == ["bt-1", "bt-2"]


# --- Strategy loading and config parsing unit tests ---


@pytest.fixture
def servicer(tmp_path, monkeypatch):
    """Create a BacktestServiceServicer with tmp dirs for unit testing."""
    monkeypatch.setattr(
        "tino_daemon.persistence.backtest_db.BacktestDB.__init__",
        lambda self, db_path=None: None,
    )
    catalog = MagicMock()
    catalog.path = str(tmp_path / "catalog")
    strategies_dir = tmp_path / "strategies"
    strategies_dir.mkdir()
    return BacktestServiceServicer(
        catalog=catalog,
        backtests_dir=str(tmp_path / "backtests"),
        strategies_dir=str(strategies_dir),
    )


def test_strategy_path_rejects_traversal(servicer, tmp_path):
    """Strategy loading rejects paths that escape strategies/ directory."""
    with pytest.raises(ValueError, match="inside strategies/ directory"):
        servicer._resolve_strategy_path("../../etc/passwd")


def test_strategy_path_rejects_missing_file(servicer, tmp_path):
    """Strategy loading raises FileNotFoundError for non-existent strategies."""
    with pytest.raises(FileNotFoundError, match="not found"):
        servicer._resolve_strategy_path("nonexistent.py")


def test_config_parsing_valid_json(servicer):
    """Config parsing accepts a valid JSON object."""
    result = servicer._parse_config('{"initial_capital": 10000}')
    assert result == {"initial_capital": 10000}


def test_config_parsing_empty_string(servicer):
    """Config parsing returns empty dict for empty string."""
    result = servicer._parse_config("")
    assert result == {}


def test_config_parsing_non_object_raises(servicer):
    """Config parsing rejects non-object JSON (e.g. a list)."""
    with pytest.raises(ValueError, match="JSON object"):
        servicer._parse_config("[1, 2, 3]")


def test_load_results_from_disk(tmp_path, monkeypatch):
    """Servicer loads persisted JSON results from backtests_dir on init."""
    monkeypatch.setattr(
        "tino_daemon.persistence.backtest_db.BacktestDB.__init__",
        lambda self, db_path=None: None,
    )
    backtests_dir = tmp_path / "backtests"
    backtests_dir.mkdir()

    payload = {
        "id": "bt-disk-1",
        "total_return": 0.15,
        "sharpe_ratio": 1.2,
        "max_drawdown": 0.05,
        "sortino_ratio": 1.5,
        "total_trades": 10,
        "winning_trades": 6,
        "win_rate": 0.6,
        "profit_factor": 1.3,
        "equity_curve_json": "[]",
        "trades_json": "[]",
        "created_at": "2026-01-01T00:00:00Z",
    }
    (backtests_dir / "bt-disk-1.json").write_text(json.dumps(payload))

    catalog = MagicMock()
    catalog.path = str(tmp_path / "catalog")
    (tmp_path / "strategies").mkdir()

    svc = BacktestServiceServicer(
        catalog=catalog,
        backtests_dir=str(backtests_dir),
        strategies_dir=str(tmp_path / "strategies"),
    )

    assert "bt-disk-1" in svc._results
    assert svc._results["bt-disk-1"].total_return == 0.15
    assert svc._results["bt-disk-1"].total_trades == 10


@pytest.mark.asyncio
async def test_run_backtest_error_yields_error_event(
    backtest_server, monkeypatch: pytest.MonkeyPatch
):
    """RunBacktest yields an error event when the backtest raises an exception."""
    server, port = backtest_server

    async def failing_run_backtest(self, **kwargs):
        raise RuntimeError("strategy crashed")

    monkeypatch.setattr(
        "tino_daemon.services.backtest.BacktestServiceServicer.run_backtest",
        failing_run_backtest,
    )

    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = backtest_pb2_grpc.BacktestServiceStub(channel)
        request = backtest_pb2.RunBacktestRequest(
            strategy_path="strategies/demo.py",
            instrument="AAPL.XNAS",
            bar_type="AAPL.XNAS-1-MINUTE-LAST-EXTERNAL",
            start_date="2024-01-01",
            end_date="2024-01-02",
            config_json="{}",
        )

        events = [event async for event in stub.RunBacktest(request)]
        error_events = [
            e
            for e in events
            if e.type == backtest_pb2.RunBacktestResponse.EVENT_TYPE_ERROR
        ]
        assert len(error_events) >= 1
        assert "strategy crashed" in error_events[0].message
