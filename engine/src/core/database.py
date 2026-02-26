"""SQLite database setup and management."""

import aiosqlite

_db: aiosqlite.Connection | None = None
DB_PATH = "data/tino.db"


async def init_db(db_path: str = DB_PATH) -> None:
    """Initialize SQLite database and create tables."""
    global _db
    _db = await aiosqlite.connect(db_path)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")
    await _create_tables(_db)


async def close_db() -> None:
    """Close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None


async def get_db() -> aiosqlite.Connection:
    """Get the database connection."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def _create_tables(db: aiosqlite.Connection) -> None:
    """Create all required tables."""
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS strategies (
            id TEXT PRIMARY KEY,
            version_hash TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            source_code TEXT NOT NULL,
            parameters TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            created_by_session TEXT,
            parent_version_hash TEXT,
            FOREIGN KEY (parent_version_hash) REFERENCES strategies(version_hash)
        );

        CREATE INDEX IF NOT EXISTS idx_strategies_version_hash ON strategies(version_hash);
        CREATE INDEX IF NOT EXISTS idx_strategies_name ON strategies(name);

        CREATE TABLE IF NOT EXISTS backtest_runs (
            id TEXT PRIMARY KEY,
            strategy_version_hash TEXT NOT NULL,
            trading_pair TEXT NOT NULL,
            exchange TEXT NOT NULL DEFAULT 'BINANCE',
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            bar_type TEXT NOT NULL DEFAULT '1-HOUR',
            status TEXT NOT NULL DEFAULT 'PENDING',
            progress_pct REAL DEFAULT 0.0,
            metrics TEXT,
            trade_log TEXT,
            equity_curve TEXT,
            parameters TEXT,
            dataset_identifier TEXT,
            started_at TEXT,
            completed_at TEXT,
            error_message TEXT,
            FOREIGN KEY (strategy_version_hash) REFERENCES strategies(version_hash)
        );

        CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy ON backtest_runs(strategy_version_hash);
        CREATE INDEX IF NOT EXISTS idx_backtest_runs_status ON backtest_runs(status);

        CREATE TABLE IF NOT EXISTS live_sessions (
            id TEXT PRIMARY KEY,
            strategy_version_hash TEXT NOT NULL,
            trading_pair TEXT NOT NULL,
            exchange TEXT NOT NULL DEFAULT 'BINANCE',
            lifecycle_state TEXT NOT NULL DEFAULT 'DEPLOYING',
            positions TEXT NOT NULL DEFAULT '[]',
            open_orders TEXT NOT NULL DEFAULT '[]',
            realized_pnl TEXT NOT NULL DEFAULT '0',
            unrealized_pnl TEXT NOT NULL DEFAULT '0',
            risk_profile_id TEXT NOT NULL,
            parameters TEXT,
            confirmed_by TEXT NOT NULL,
            started_at TEXT NOT NULL,
            paused_at TEXT,
            stopped_at TEXT,
            pause_resume_history TEXT DEFAULT '[]',
            FOREIGN KEY (strategy_version_hash) REFERENCES strategies(version_hash),
            FOREIGN KEY (risk_profile_id) REFERENCES risk_profiles(id)
        );

        CREATE INDEX IF NOT EXISTS idx_live_sessions_state ON live_sessions(lifecycle_state);

        CREATE TABLE IF NOT EXISTS risk_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            max_drawdown_pct REAL NOT NULL,
            single_order_size_cap REAL NOT NULL,
            daily_loss_limit REAL NOT NULL,
            max_concurrent_strategies INTEGER NOT NULL DEFAULT 3,
            kill_switch_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            modification_log TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS market_data_cache (
            trading_pair TEXT NOT NULL,
            bar_type TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            record_count INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            PRIMARY KEY (trading_pair, bar_type)
        );
    """)
    await db.commit()

    # Insert default risk profile if not exists
    existing = await db.execute("SELECT id FROM risk_profiles WHERE name = 'default'")
    if await existing.fetchone() is None:
        from uuid import uuid4
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO risk_profiles (id, name, max_drawdown_pct, single_order_size_cap,
               daily_loss_limit, max_concurrent_strategies, kill_switch_active, created_at, updated_at)
               VALUES (?, 'default', 0.08, 0.1, 500.0, 3, 0, ?, ?)""",
            (str(uuid4()), now, now)
        )
        await db.commit()
