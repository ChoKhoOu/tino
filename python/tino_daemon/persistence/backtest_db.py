"""SQLite persistence for backtest results (TDR-005 dual-write)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

_SCHEMA_VERSION = 1

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS backtests (
    id TEXT PRIMARY KEY,
    strategy_path TEXT NOT NULL,
    instrument TEXT NOT NULL,
    bar_type TEXT,
    start_date TEXT,
    end_date TEXT,
    total_return REAL,
    sharpe_ratio REAL,
    max_drawdown REAL,
    sortino_ratio REAL,
    total_trades INTEGER,
    winning_trades INTEGER,
    win_rate REAL,
    profit_factor REAL,
    config_json TEXT,
    equity_curve_json TEXT,
    trades_json TEXT,
    created_at TEXT NOT NULL
);
"""


class BacktestDB:
    """SQLite store for backtest results with WAL mode and schema versioning."""

    def __init__(self, db_path: str = ".tino/backtests.db") -> None:
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=wal")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(_CREATE_TABLES)
        existing = self._conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if existing is None:
            self._conn.execute(
                "INSERT INTO schema_version (version) VALUES (?)",
                (_SCHEMA_VERSION,),
            )
            self._conn.commit()

    def record_backtest(self, result: dict[str, Any]) -> None:
        """Insert or replace a backtest result row."""
        now = result.get("created_at", datetime.now(timezone.utc).isoformat())
        self._conn.execute(
            """INSERT OR REPLACE INTO backtests
               (id, strategy_path, instrument, bar_type, start_date, end_date,
                total_return, sharpe_ratio, max_drawdown, sortino_ratio,
                total_trades, winning_trades, win_rate, profit_factor,
                config_json, equity_curve_json, trades_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                result["id"],
                result.get("strategy_path", ""),
                result.get("instrument", ""),
                result.get("bar_type", ""),
                result.get("start_date", ""),
                result.get("end_date", ""),
                result.get("total_return", 0.0),
                result.get("sharpe_ratio", 0.0),
                result.get("max_drawdown", 0.0),
                result.get("sortino_ratio", 0.0),
                result.get("total_trades", 0),
                result.get("winning_trades", 0),
                result.get("win_rate", 0.0),
                result.get("profit_factor", 0.0),
                result.get("config_json", "{}"),
                result.get("equity_curve_json", "[]"),
                result.get("trades_json", "[]"),
                now,
            ),
        )
        self._conn.commit()

    def list_backtests(self, limit: int = 20) -> list[dict[str, Any]]:
        """Return most recent backtests ordered by created_at descending."""
        rows = self._conn.execute(
            "SELECT * FROM backtests ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_backtest(self, backtest_id: str) -> dict[str, Any] | None:
        """Return a single backtest by ID, or None if not found."""
        row = self._conn.execute(
            "SELECT * FROM backtests WHERE id = ?", (backtest_id,)
        ).fetchone()
        return dict(row) if row else None

    def compare_backtests(
        self, id1: str, id2: str
    ) -> dict[str, Any] | None:
        """Return a side-by-side comparison of two backtests."""
        bt1 = self.get_backtest(id1)
        bt2 = self.get_backtest(id2)
        if bt1 is None or bt2 is None:
            return None

        metrics = [
            "total_return", "sharpe_ratio", "max_drawdown", "sortino_ratio",
            "total_trades", "winning_trades", "win_rate", "profit_factor",
        ]
        deltas: dict[str, float] = {}
        for m in metrics:
            v1 = float(bt1.get(m, 0) or 0)
            v2 = float(bt2.get(m, 0) or 0)
            deltas[m] = v2 - v1

        return {"backtest_1": bt1, "backtest_2": bt2, "deltas": deltas}

    def close(self) -> None:
        self._conn.close()
