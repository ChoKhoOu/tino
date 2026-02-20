"""Tests for BacktestDB SQLite persistence."""

from __future__ import annotations

from pathlib import Path

import pytest

from tino_daemon.persistence.backtest_db import BacktestDB


def _sample_result(result_id: str = "bt-001") -> dict:
    return {
        "id": result_id,
        "strategy_path": "strategies/demo.py",
        "instrument": "BTCUSDT",
        "bar_type": "BTCUSDT-1-MINUTE-LAST",
        "start_date": "2025-01-01",
        "end_date": "2025-01-31",
        "total_return": 0.15,
        "sharpe_ratio": 1.8,
        "max_drawdown": 0.05,
        "sortino_ratio": 2.1,
        "total_trades": 42,
        "winning_trades": 28,
        "win_rate": 0.667,
        "profit_factor": 1.9,
        "config_json": '{"fast": 10, "slow": 20}',
        "equity_curve_json": "[100, 105, 115]",
        "trades_json": "[]",
        "created_at": "2025-02-01T00:00:00Z",
    }


@pytest.fixture
def db(tmp_path: Path) -> BacktestDB:
    db = BacktestDB(db_path=str(tmp_path / "test_backtests.db"))
    yield db
    db.close()


def test_record_and_get_backtest(db: BacktestDB):
    sample = _sample_result()
    db.record_backtest(sample)
    result = db.get_backtest("bt-001")
    assert result is not None
    assert result["id"] == "bt-001"
    assert result["total_return"] == 0.15
    assert result["instrument"] == "BTCUSDT"


def test_get_backtest_not_found(db: BacktestDB):
    assert db.get_backtest("nonexistent") is None


def test_list_backtests_ordering(db: BacktestDB):
    for i in range(5):
        r = _sample_result(f"bt-{i:03d}")
        r["created_at"] = f"2025-02-0{i + 1}T00:00:00Z"
        db.record_backtest(r)

    results = db.list_backtests(limit=3)
    assert len(results) == 3
    # Most recent first
    assert results[0]["id"] == "bt-004"
    assert results[2]["id"] == "bt-002"


def test_compare_backtests(db: BacktestDB):
    r1 = _sample_result("bt-a")
    r1["total_return"] = 0.10
    r2 = _sample_result("bt-b")
    r2["total_return"] = 0.20
    db.record_backtest(r1)
    db.record_backtest(r2)

    comparison = db.compare_backtests("bt-a", "bt-b")
    assert comparison is not None
    assert comparison["deltas"]["total_return"] == pytest.approx(0.10)


def test_compare_backtests_missing(db: BacktestDB):
    db.record_backtest(_sample_result("bt-x"))
    assert db.compare_backtests("bt-x", "bt-missing") is None


def test_schema_version_set(db: BacktestDB):
    row = db._conn.execute(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
    ).fetchone()
    assert row is not None
    assert row["version"] == 1


def test_wal_mode_enabled(db: BacktestDB):
    mode = db._conn.execute("PRAGMA journal_mode").fetchone()
    assert mode[0] == "wal"
