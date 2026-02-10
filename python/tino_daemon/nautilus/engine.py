"""Async-friendly wrapper around NautilusTrader BacktestEngine."""

from __future__ import annotations

import asyncio
import importlib.util
import inspect
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType
from typing import Any, Callable
from uuid import uuid4

try:
    from nautilus_trader.backtest.engine import (  # type: ignore[import-not-found]
        BacktestEngine as NTBacktestEngine,
    )
    from nautilus_trader.persistence.catalog import (  # type: ignore[import-not-found]
        ParquetDataCatalog as NTParquetDataCatalog,
    )
    from nautilus_trader.trading.strategy import (  # type: ignore[import-not-found]
        Strategy as NTStrategy,
    )
except ImportError:  # pragma: no cover - dependency required by runtime
    NTBacktestEngine = None
    NTParquetDataCatalog = None
    NTStrategy = object

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
        strategy_cls, _ = self._load_strategy_class(strategy_path)
        config = self._parse_config(config_json)
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

        result_cls = getattr(backtest_pb2, "BacktestResult")
        result = result_cls(
            id=result_id,
            total_return=self._to_float(metrics.get("total_return", 0.0)),
            sharpe_ratio=self._to_float(metrics.get("sharpe_ratio", 0.0)),
            max_drawdown=self._to_float(metrics.get("max_drawdown", 0.0)),
            sortino_ratio=self._to_float(metrics.get("sortino_ratio", 0.0)),
            total_trades=self._to_int(metrics.get("total_trades", 0)),
            winning_trades=self._to_int(metrics.get("winning_trades", 0)),
            win_rate=self._to_float(metrics.get("win_rate", 0.0)),
            profit_factor=self._to_float(metrics.get("profit_factor", 0.0)),
            equity_curve_json=json.dumps(metrics.get("equity_curve", [])),
            trades_json=json.dumps(metrics.get("trades", [])),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._persist_result(result)
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
            # Sprint 0 finding: always dispose the engine for sequential runs.
            engine.dispose()

    def _extract_metrics(self, engine: object, instrument: str) -> dict[str, object]:
        """Best-effort extraction of common summary metrics."""
        del instrument
        results = getattr(engine, "results", None)
        if isinstance(results, dict):
            return dict(results)

        return {
            "total_return": 0.0,
            "sharpe_ratio": 0.0,
            "max_drawdown": 0.0,
            "sortino_ratio": 0.0,
            "total_trades": 0,
            "winning_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "equity_curve": [],
            "trades": [],
        }

    def _persist_result(self, result: Any) -> None:
        path = self._backtests_dir / f"{result.id}.json"
        payload = {
            "id": result.id,
            "total_return": result.total_return,
            "sharpe_ratio": result.sharpe_ratio,
            "max_drawdown": result.max_drawdown,
            "sortino_ratio": result.sortino_ratio,
            "total_trades": result.total_trades,
            "winning_trades": result.winning_trades,
            "win_rate": result.win_rate,
            "profit_factor": result.profit_factor,
            "equity_curve_json": result.equity_curve_json,
            "trades_json": result.trades_json,
            "created_at": result.created_at,
        }
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _parse_config(self, config_json: str) -> dict[str, object]:
        if not config_json:
            return {}
        parsed = json.loads(config_json)
        if not isinstance(parsed, dict):
            raise ValueError("config_json must deserialize to a JSON object")
        return parsed

    def _load_strategy_class(self, strategy_path: str) -> tuple[type, ModuleType]:
        strategy_file = self._resolve_strategy_path(strategy_path)
        spec = importlib.util.spec_from_file_location(
            f"strategy_{strategy_file.stem}", strategy_file
        )
        if spec is None or spec.loader is None:
            raise ValueError(f"Failed to load strategy module from: {strategy_file}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        for _, value in inspect.getmembers(module, inspect.isclass):
            if issubclass(value, NTStrategy) and value is not NTStrategy:
                return value, module

        raise ValueError(f"No Strategy subclass found in: {strategy_file}")

    def _resolve_strategy_path(self, strategy_path: str) -> Path:
        path = Path(strategy_path)
        if not path.is_absolute():
            path = self._strategies_dir / path
        resolved = path.resolve()
        try:
            resolved.relative_to(self._strategies_dir)
        except ValueError as exc:
            raise ValueError(
                "Strategy path must be inside strategies/ directory"
            ) from exc

        if not resolved.exists() or not resolved.is_file():
            raise FileNotFoundError(f"Strategy file not found: {resolved}")

        return resolved

    def _to_float(self, value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def _to_int(self, value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0
