"""Backtest execution wrapper: orchestrates strategy loading, data prep, and engine execution."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from ..api.ws.manager import ws_manager
from ..core.database import get_db
from ..core.data_manager import MarketDataManager
from ..core.engine import TradingEngineWrapper
from ..core.strategy_loader import StrategyLoader
from ..schemas.backtest import BacktestCreate, BacktestRun, BacktestStatus

logger = logging.getLogger(__name__)


class BacktestRunner:
    """Runs backtests and streams progress via WebSocket."""

    def __init__(self):
        self.engine = TradingEngineWrapper()
        self.data_manager = MarketDataManager()
        self.strategy_loader = StrategyLoader()
        self._running: dict[str, asyncio.Task] = {}

    async def submit_backtest(self, data: BacktestCreate) -> dict:
        """Submit a new backtest run. Returns immediately with job ID."""
        db = await get_db()
        backtest_id = str(uuid4())
        now = datetime.now(timezone.utc)

        # Insert pending record
        await db.execute(
            """INSERT INTO backtest_runs (id, strategy_version_hash, trading_pair, exchange,
               start_date, end_date, bar_type, status, parameters, started_at)
               VALUES (?, ?, ?, 'BINANCE', ?, ?, ?, 'PENDING', ?, ?)""",
            (
                backtest_id,
                data.strategy_version_hash,
                data.trading_pair,
                data.start_date,
                data.end_date,
                data.bar_type,
                json.dumps(data.parameters) if data.parameters else "{}",
                now.isoformat(),
            ),
        )
        await db.commit()

        # Start execution in background
        task = asyncio.create_task(self._run_backtest(backtest_id, data))
        self._running[backtest_id] = task

        return {
            "id": backtest_id,
            "status": "PENDING",
            "ws_url": f"/ws/backtest/{backtest_id}",
        }

    async def get_backtest(self, backtest_id: str) -> dict | None:
        """Get backtest run details."""
        db = await get_db()
        result = await db.execute(
            "SELECT * FROM backtest_runs WHERE id = ?", (backtest_id,)
        )
        row = await result.fetchone()
        if not row:
            return None

        return {
            "id": row["id"],
            "strategy_version_hash": row["strategy_version_hash"],
            "trading_pair": row["trading_pair"],
            "exchange": row["exchange"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "bar_type": row["bar_type"],
            "status": row["status"],
            "progress_pct": row["progress_pct"],
            "metrics": json.loads(row["metrics"]) if row["metrics"] else None,
            "trade_log": json.loads(row["trade_log"]) if row["trade_log"] else None,
            "equity_curve": json.loads(row["equity_curve"]) if row["equity_curve"] else None,
            "parameters": json.loads(row["parameters"]) if row["parameters"] else None,
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "error_message": row["error_message"],
        }

    async def cancel_backtest(self, backtest_id: str) -> bool:
        """Cancel a running backtest."""
        task = self._running.get(backtest_id)
        if task and not task.done():
            task.cancel()
            db = await get_db()
            await db.execute(
                "UPDATE backtest_runs SET status = 'CANCELLED' WHERE id = ?",
                (backtest_id,),
            )
            await db.commit()
            return True
        return False

    async def _run_backtest(self, backtest_id: str, data: BacktestCreate) -> None:
        """Execute backtest and stream progress."""
        db = await get_db()
        topic = f"backtest:{backtest_id}"

        try:
            # Update status to RUNNING
            await db.execute(
                "UPDATE backtest_runs SET status = 'RUNNING' WHERE id = ?",
                (backtest_id,),
            )
            await db.commit()

            # Emit progress: started
            await ws_manager.send_event(topic, {
                "type": "backtest.progress",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "backtest_id": backtest_id,
                    "progress_pct": 0.0,
                    "current_date": data.start_date,
                    "trades_so_far": 0,
                    "current_pnl": "0",
                },
            })

            # Fetch/cache data
            await self.data_manager.fetch_and_cache(
                data.trading_pair, data.bar_type, data.start_date, data.end_date
            )

            # Load strategy
            strategy = self.strategy_loader.load_by_hash(data.strategy_version_hash)
            if not strategy:
                raise ValueError(f"Strategy {data.strategy_version_hash} not found")

            # Run backtest
            instrument_id = f"{data.trading_pair}.BINANCE"
            data_path = str(
                self.data_manager.get_data_path(data.trading_pair, data.bar_type) or ""
            )

            result = await self.engine.run_backtest(
                strategy_source=strategy.source_code,
                strategy_params=data.parameters or {},
                instrument_id=instrument_id,
                data_path=data_path,
                bar_type=data.bar_type,
            )

            # Update DB with results
            await db.execute(
                """UPDATE backtest_runs
                   SET status = 'COMPLETED', progress_pct = 100.0,
                       metrics = ?, trade_log = ?, equity_curve = ?,
                       completed_at = ?
                   WHERE id = ?""",
                (
                    json.dumps(result["metrics"]),
                    json.dumps(result["trade_log"]),
                    json.dumps(result["equity_curve"]),
                    datetime.now(timezone.utc).isoformat(),
                    backtest_id,
                ),
            )
            await db.commit()

            # Emit completed event
            await ws_manager.send_event(topic, {
                "type": "backtest.completed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "backtest_id": backtest_id,
                    "metrics": result["metrics"],
                },
            })

            logger.info(f"Backtest {backtest_id} completed")

        except asyncio.CancelledError:
            logger.info(f"Backtest {backtest_id} cancelled")
        except Exception as e:
            logger.error(f"Backtest {backtest_id} failed: {e}")
            await db.execute(
                """UPDATE backtest_runs SET status = 'FAILED', error_message = ?,
                   completed_at = ? WHERE id = ?""",
                (str(e), datetime.now(timezone.utc).isoformat(), backtest_id),
            )
            await db.commit()

            await ws_manager.send_event(topic, {
                "type": "backtest.failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "backtest_id": backtest_id,
                    "error": "BACKTEST_ERROR",
                    "message": str(e),
                },
            })
        finally:
            self._running.pop(backtest_id, None)


# Global singleton
backtest_runner = BacktestRunner()
