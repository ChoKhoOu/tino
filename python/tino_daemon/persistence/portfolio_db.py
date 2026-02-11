from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

_SCHEMA_VERSION = 1

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    instrument TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    fee REAL DEFAULT 0,
    venue TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    order_id TEXT,
    strategy TEXT
);
CREATE TABLE IF NOT EXISTS positions (
    instrument TEXT PRIMARY KEY,
    quantity REAL NOT NULL,
    avg_price REAL NOT NULL,
    unrealized_pnl REAL DEFAULT 0,
    realized_pnl REAL DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_pnl (
    date TEXT NOT NULL,
    instrument TEXT,
    total_pnl REAL NOT NULL,
    realized_pnl REAL NOT NULL,
    unrealized_pnl REAL NOT NULL,
    PRIMARY KEY (date, instrument)
);
"""


class PortfolioDB:
    def __init__(self, db_path: str = ".tino/portfolio.db") -> None:
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

    def record_trade(
        self,
        *,
        trade_id: str,
        instrument: str,
        side: str,
        quantity: float,
        price: float,
        fee: float = 0.0,
        venue: str,
        timestamp: str,
        order_id: str = "",
        strategy: str = "",
    ) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO trades
               (id, instrument, side, quantity, price, fee, venue, timestamp, order_id, strategy)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                trade_id,
                instrument,
                side,
                quantity,
                price,
                fee,
                venue,
                timestamp,
                order_id,
                strategy,
            ),
        )
        self._upsert_position(instrument, side, quantity, price)
        self._conn.commit()

    def _upsert_position(
        self, instrument: str, side: str, quantity: float, price: float
    ) -> None:
        row = self._conn.execute(
            "SELECT quantity, avg_price FROM positions WHERE instrument = ?",
            (instrument,),
        ).fetchone()
        now = datetime.now(timezone.utc).isoformat()

        if row is None:
            signed_qty = quantity if side.upper() == "BUY" else -quantity
            self._conn.execute(
                """INSERT INTO positions (instrument, quantity, avg_price, updated_at)
                   VALUES (?, ?, ?, ?)""",
                (instrument, signed_qty, price, now),
            )
        else:
            old_qty, old_avg = float(row["quantity"]), float(row["avg_price"])
            if side.upper() == "BUY":
                new_qty = old_qty + quantity
                if new_qty != 0:
                    new_avg = (old_qty * old_avg + quantity * price) / new_qty
                else:
                    new_avg = 0.0
            else:
                new_qty = old_qty - quantity
                new_avg = old_avg
            self._conn.execute(
                """UPDATE positions SET quantity = ?, avg_price = ?, updated_at = ?
                   WHERE instrument = ?""",
                (new_qty, new_avg, now, instrument),
            )

    def get_trades(
        self,
        instrument: str = "",
        start_date: str = "",
        end_date: str = "",
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM trades WHERE 1=1"
        params: list[Any] = []
        if instrument:
            query += " AND instrument = ?"
            params.append(instrument)
        if start_date:
            query += " AND timestamp >= ?"
            params.append(start_date)
        if end_date:
            query += " AND timestamp <= ?"
            params.append(end_date + "T23:59:59Z")
        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def get_positions(self, instrument: str = "") -> list[dict[str, Any]]:
        if instrument:
            rows = self._conn.execute(
                "SELECT * FROM positions WHERE instrument = ?", (instrument,)
            ).fetchall()
        else:
            rows = self._conn.execute("SELECT * FROM positions").fetchall()
        return [dict(r) for r in rows]

    def get_pnl_history(
        self, instrument: str = "", start_date: str = "", end_date: str = ""
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM daily_pnl WHERE 1=1"
        params: list[Any] = []
        if instrument:
            query += " AND instrument = ?"
            params.append(instrument)
        if start_date:
            query += " AND date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND date <= ?"
            params.append(end_date)
        query += " ORDER BY date ASC"
        rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def record_daily_pnl(
        self,
        *,
        date: str,
        instrument: str,
        total_pnl: float,
        realized_pnl: float,
        unrealized_pnl: float,
    ) -> None:
        self._conn.execute(
            """INSERT OR REPLACE INTO daily_pnl
               (date, instrument, total_pnl, realized_pnl, unrealized_pnl)
               VALUES (?, ?, ?, ?, ?)""",
            (date, instrument, total_pnl, realized_pnl, unrealized_pnl),
        )
        self._conn.commit()

    def get_summary(self) -> dict[str, Any]:
        trade_count = self._conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0]
        open_positions = self._conn.execute(
            "SELECT COUNT(*) FROM positions WHERE quantity != 0"
        ).fetchone()[0]
        total_realized = self._conn.execute(
            "SELECT COALESCE(SUM(realized_pnl), 0) FROM positions"
        ).fetchone()[0]
        total_unrealized = self._conn.execute(
            "SELECT COALESCE(SUM(unrealized_pnl), 0) FROM positions"
        ).fetchone()[0]
        total_fees = self._conn.execute(
            "SELECT COALESCE(SUM(fee), 0) FROM trades"
        ).fetchone()[0]
        return {
            "total_trades": trade_count,
            "open_positions": open_positions,
            "total_realized_pnl": float(total_realized),
            "total_unrealized_pnl": float(total_unrealized),
            "total_fees": float(total_fees),
        }

    def close(self) -> None:
        self._conn.close()
