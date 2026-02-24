"""Async-friendly wrapper around NautilusTrader BacktestEngine."""

from __future__ import annotations

import asyncio
import json
import logging

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from tino_daemon.nautilus.nt_serializers import (
    load_strategy_class,
    parse_config_json,
    to_float,
    to_int,
)
from tino_daemon.persistence.backtest_db import BacktestDB

try:
    from nautilus_trader.backtest.engine import (  # type: ignore[import-not-found]
        BacktestEngine as NTBacktestEngine,
    )
    from nautilus_trader.persistence.catalog import (  # type: ignore[import-not-found]
        ParquetDataCatalog as NTParquetDataCatalog,
    )
except ImportError:  # pragma: no cover - dependency required by runtime
    NTBacktestEngine = None
    NTParquetDataCatalog = None

from tino_daemon.proto.tino.backtest.v1 import backtest_pb2

logger = logging.getLogger(__name__)


class BacktestEngineWrapper:
    """Async-friendly wrapper for NautilusTrader BacktestEngine."""

    def __init__(
        self,
        catalog_path: str = "data/catalog",
        backtests_dir: str = "backtests",
        strategies_dir: str = "strategies",
    ) -> None:
        self._catalog_path = Path(catalog_path)
        self._backtests_dir = Path(backtests_dir)
        self._strategies_dir = Path(strategies_dir).resolve()
        self._backtests_dir.mkdir(parents=True, exist_ok=True)
        self._backtest_db = BacktestDB()

    async def run_backtest(
        self,
        strategy_path: str,
        instrument: str,
        bar_type: str,
        start_date: str,
        end_date: str,
        config_json: str = "{}",
        on_progress: Callable[[float, str], None] | None = None,
        cancel_event: asyncio.Event | None = None,
        backtest_id: str | None = None,
    ) -> Any:
        """Run a backtest in a worker thread and return a proto result."""
        strategy_cls = load_strategy_class(
            strategy_path, strategies_dir=str(self._strategies_dir),
        )
        config = parse_config_json(config_json)
        result_id = backtest_id or str(uuid4())

        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = loop.run_in_executor(
                executor,
                self._run_backtest_sync,
                strategy_cls,
                instrument,
                bar_type,
                start_date,
                end_date,
                config,
            )

            while not future.done():
                if cancel_event is not None and cancel_event.is_set():
                    raise asyncio.CancelledError("Backtest cancelled")
                if on_progress is not None:
                    on_progress(0.0, "Backtest running")
                await asyncio.sleep(0.5)

            metrics = await future

        result = backtest_pb2.BacktestResult(
            id=result_id,
            total_return=to_float(metrics.get("total_return", 0.0)),
            sharpe_ratio=to_float(metrics.get("sharpe_ratio", 0.0)),
            max_drawdown=to_float(metrics.get("max_drawdown", 0.0)),
            sortino_ratio=to_float(metrics.get("sortino_ratio", 0.0)),
            total_trades=to_int(metrics.get("total_trades", 0)),
            winning_trades=to_int(metrics.get("winning_trades", 0)),
            win_rate=to_float(metrics.get("win_rate", 0.0)),
            profit_factor=to_float(metrics.get("profit_factor", 0.0)),
            equity_curve_json=json.dumps(metrics.get("equity_curve", [])),
            trades_json=json.dumps(metrics.get("trades", [])),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._persist_result(
            result,
            strategy_path=strategy_path,
            instrument=instrument,
            bar_type=bar_type,
            start_date=start_date,
            end_date=end_date,
            config_json=config_json,
        )
        return result

    def _run_backtest_sync(
        self,
        strategy_cls: type,
        instrument: str,
        bar_type: str,
        start_date: str,
        end_date: str,
        config: dict[str, object],
    ) -> dict[str, object]:
        """Run Nautilus backtest synchronously and extract summary metrics."""
        del start_date
        del end_date

        if NTBacktestEngine is None or NTParquetDataCatalog is None:
            raise RuntimeError("NautilusTrader is not installed. Install with: uv sync")

        engine = NTBacktestEngine()
        try:
            catalog = NTParquetDataCatalog(self._catalog_path)
            bars = catalog.bars(bar_types=[bar_type])
            if bars:
                engine.add_data(bars)

            strategy = strategy_cls(config)
            engine.add_strategy(strategy)
            engine.run()
            return self._extract_metrics(engine, instrument)
        finally:
            engine.dispose()

    def _extract_metrics(self, engine: NTBacktestEngine, instrument: str) -> dict[str, object]:  # type: ignore[type-arg]
        """Extract summary metrics from a completed backtest via NT API."""
        del instrument
        result = engine.get_result()
        pnl: dict[str, float] = {}
        for cs in result.stats_pnls.values():
            for k, v in cs.items():
                pnl[k] = pnl.get(k, 0.0) + v
        ret = result.stats_returns
        return {
            "total_return": pnl.get("PnL% (total)", 0.0),
            "sharpe_ratio": ret.get("Sharpe Ratio", 0.0),
            "max_drawdown": ret.get("Max Drawdown", 0.0),
            "sortino_ratio": ret.get("Sortino Ratio", 0.0),
            "total_trades": result.total_orders,
            "winning_trades": 0,
            "win_rate": ret.get("Win Rate", 0.0),
            "profit_factor": ret.get("Profit Factor", 0.0),
            "equity_curve": [], "trades": [],
        }

    def _persist_result(
        self, result: Any, *, strategy_path: str = "", instrument: str = "",
        bar_type: str = "", start_date: str = "", end_date: str = "",
        config_json: str = "{}",
    ) -> None:
        payload = {
            "id": result.id, "strategy_path": strategy_path,
            "instrument": instrument, "bar_type": bar_type,
            "start_date": start_date, "end_date": end_date,
            "total_return": result.total_return, "sharpe_ratio": result.sharpe_ratio,
            "max_drawdown": result.max_drawdown, "sortino_ratio": result.sortino_ratio,
            "total_trades": result.total_trades, "winning_trades": result.winning_trades,
            "win_rate": result.win_rate, "profit_factor": result.profit_factor,
            "config_json": config_json, "equity_curve_json": result.equity_curve_json,
            "trades_json": result.trades_json, "created_at": result.created_at,
        }
        path = self._backtests_dir / f"{result.id}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        try:
            self._backtest_db.record_backtest(payload)
        except Exception:
            logger.warning("SQLite dual-write failed for %s", result.id, exc_info=True)

