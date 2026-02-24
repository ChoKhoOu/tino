"""BacktestService gRPC implementation.

Calls NautilusTrader BacktestEngine directly without an intermediary wrapper.
"""

# pyright: reportAttributeAccessIssue=false

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
from typing import Any, AsyncIterator, Callable
from uuid import uuid4

import grpc

from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.persistence.backtest_db import BacktestDB
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc

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

logger = logging.getLogger(__name__)


class BacktestServiceServicer(backtest_pb2_grpc.BacktestServiceServicer):
    """Implements BacktestService RPCs, calling NautilusTrader directly."""

    def __init__(
        self,
        catalog: DataCatalogWrapper,
        backtests_dir: str = "backtests",
        strategies_dir: str = "strategies",
    ):
        self._catalog = catalog
        self._catalog_path = catalog.path
        self._backtests_dir = Path(backtests_dir)
        self._strategies_dir = Path(strategies_dir).resolve()
        self._backtests_dir.mkdir(parents=True, exist_ok=True)
        Path(".tino").mkdir(parents=True, exist_ok=True)
        self._backtest_db = BacktestDB()
        self._results: dict[str, Any] = {}
        self._active_backtests: dict[str, asyncio.Event] = {}
        self._load_results_from_disk()

    async def RunBacktest(
        self,
        request: Any,
        context,
    ) -> AsyncIterator[Any]:
        """Run backtest and stream progress/completion/error events."""
        del context

        backtest_id = str(uuid4())
        cancel_event = asyncio.Event()
        self._active_backtests[backtest_id] = cancel_event

        loop = asyncio.get_running_loop()
        progress_queue: asyncio.Queue[tuple[float, str]] = asyncio.Queue()

        def on_progress(progress_pct: float, message: str) -> None:
            loop.call_soon_threadsafe(
                progress_queue.put_nowait, (progress_pct, message)
            )

        yield backtest_pb2.RunBacktestResponse(
            type=backtest_pb2.RunBacktestResponse.EVENT_TYPE_PROGRESS,
            message=f"Backtest started: {backtest_id}",
            progress_pct=0.0,
        )

        task = asyncio.create_task(
            self.run_backtest(
                strategy_path=request.strategy_path,
                instrument=request.instrument,
                bar_type=request.bar_type,
                start_date=request.start_date,
                end_date=request.end_date,
                config_json=request.config_json,
                on_progress=on_progress,
                cancel_event=cancel_event,
                backtest_id=backtest_id,
            )
        )

        try:
            while not task.done() or not progress_queue.empty():
                try:
                    progress_pct, message = await asyncio.wait_for(
                        progress_queue.get(),
                        timeout=0.5,
                    )
                    yield backtest_pb2.RunBacktestResponse(
                        type=backtest_pb2.RunBacktestResponse.EVENT_TYPE_PROGRESS,
                        message=message,
                        progress_pct=progress_pct,
                    )
                except TimeoutError:
                    continue

            result = await task
            self._results[result.id] = result
            yield backtest_pb2.RunBacktestResponse(
                type=backtest_pb2.RunBacktestResponse.EVENT_TYPE_COMPLETED,
                message=f"Backtest completed: {result.id}",
                progress_pct=100.0,
                result=result,
            )
        except asyncio.CancelledError:
            yield backtest_pb2.RunBacktestResponse(
                type=backtest_pb2.RunBacktestResponse.EVENT_TYPE_ERROR,
                message=f"Backtest cancelled: {backtest_id}",
            )
        except Exception as exc:
            logger.exception("RunBacktest failed")
            yield backtest_pb2.RunBacktestResponse(
                type=backtest_pb2.RunBacktestResponse.EVENT_TYPE_ERROR,
                message=f"Backtest failed: {exc}",
            )
        finally:
            self._active_backtests.pop(backtest_id, None)

    async def CancelBacktest(
        self,
        request: Any,
        context,
    ) -> Any:
        """Request cancellation of a running backtest."""
        del context
        cancel_event = self._active_backtests.get(request.id)
        if cancel_event is None:
            return backtest_pb2.CancelBacktestResponse(success=False)
        cancel_event.set()
        return backtest_pb2.CancelBacktestResponse(success=True)

    async def GetResult(
        self,
        request: Any,
        context,
    ) -> Any:
        """Return stored backtest result by ID."""
        result = self._results.get(request.id)
        if result is None:
            await context.abort(
                grpc.StatusCode.NOT_FOUND, f"Result not found: {request.id}"
            )
        return backtest_pb2.GetResultResponse(result=result)

    async def ListResults(
        self,
        request: Any,
        context,
    ) -> Any:
        """Return all stored backtest results."""
        del request
        del context
        results = sorted(
            self._results.values(), key=lambda r: r.created_at, reverse=True
        )
        return backtest_pb2.ListResultsResponse(results=results)

    def _load_results_from_disk(self) -> None:
        for path in sorted(self._backtests_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue

            result = backtest_pb2.BacktestResult(
                id=str(payload.get("id", "")),
                total_return=float(payload.get("total_return", 0.0)),
                sharpe_ratio=float(payload.get("sharpe_ratio", 0.0)),
                max_drawdown=float(payload.get("max_drawdown", 0.0)),
                sortino_ratio=float(payload.get("sortino_ratio", 0.0)),
                total_trades=int(payload.get("total_trades", 0)),
                winning_trades=int(payload.get("winning_trades", 0)),
                win_rate=float(payload.get("win_rate", 0.0)),
                profit_factor=float(payload.get("profit_factor", 0.0)),
                equity_curve_json=str(payload.get("equity_curve_json", "[]")),
                trades_json=str(payload.get("trades_json", "[]")),
                created_at=str(payload.get("created_at", "")),
            )
            if result.id:
                self._results[result.id] = result

    # ------------------------------------------------------------------
    # Backtest execution (formerly BacktestEngineWrapper)
    # ------------------------------------------------------------------

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
            # Sprint 0 finding: always dispose the engine for sequential runs.
            engine.dispose()

    def _extract_metrics(self, engine: object, instrument: str) -> dict[str, object]:
        """Extract summary metrics from NautilusTrader BacktestEngine via PortfolioAnalyzer."""
        import math

        analyzer = engine.portfolio.analyzer  # type: ignore[union-attr]
        cache = engine.cache  # type: ignore[union-attr]

        # --- return-based stats ---
        stats_returns = analyzer.get_performance_stats_returns()
        sharpe = stats_returns.get("Sharpe Ratio (252 days)", 0.0)
        sortino = stats_returns.get("Sortino Ratio (252 days)", 0.0)
        profit_factor = stats_returns.get("Profit Factor", 0.0)

        # --- PnL-based stats ---
        stats_pnls = analyzer.get_performance_stats_pnls()
        total_return = stats_pnls.get("PnL% (total)", 0.0)
        win_rate = stats_pnls.get("Win Rate", 0.0)

        # --- trade counts from closed positions (filtered by instrument) ---
        closed_positions = self._get_closed_positions(cache, instrument)
        total_trades = len(closed_positions)
        winning_trades = sum(
            1 for p in closed_positions if float(p.realized_pnl) > 0
        )

        # --- max drawdown from returns series ---
        max_drawdown = 0.0
        equity_curve: list[float] = []
        try:
            returns_series = analyzer.returns()
            if len(returns_series) > 0:
                cumulative = (1 + returns_series).cumprod()
                peak = cumulative.cummax()
                drawdown = (cumulative - peak) / peak
                max_drawdown = abs(float(drawdown.min()))
                equity_curve = [self._sanitize(v) for v in cumulative.tolist()]
        except Exception:
            logger.warning("Could not compute equity curve / max drawdown", exc_info=True)

        # --- trades list ---
        trades: list[dict[str, object]] = []
        for pos in closed_positions:
            trades.append(
                {
                    "instrument": str(pos.instrument_id),
                    "side": str(pos.entry),
                    "pnl": float(pos.realized_pnl),
                    "return": float(pos.realized_return),
                }
            )

        return {
            "total_return": self._sanitize(total_return),
            "sharpe_ratio": self._sanitize(sharpe),
            "max_drawdown": self._sanitize(max_drawdown),
            "sortino_ratio": self._sanitize(sortino),
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "win_rate": self._sanitize(win_rate),
            "profit_factor": self._sanitize(profit_factor),
            "equity_curve": equity_curve,
            "trades": trades,
        }

    @staticmethod
    def _get_closed_positions(cache: object, instrument: str) -> list:
        """Return closed positions, filtered by instrument when possible."""
        try:
            from nautilus_trader.model.identifiers import (  # type: ignore[import-not-found]
                InstrumentId,
            )

            nt_id = InstrumentId.from_str(instrument)
            return list(cache.positions_closed(instrument_id=nt_id))  # type: ignore[union-attr]
        except Exception:
            return list(cache.positions_closed(instrument_id=None))  # type: ignore[union-attr]

    @staticmethod
    def _sanitize(value: object) -> float:
        """Convert value to float, replacing NaN/Inf with 0.0."""
        import math

        try:
            f = float(value)  # type: ignore[arg-type]
            return 0.0 if (math.isnan(f) or math.isinf(f)) else f
        except (TypeError, ValueError):
            return 0.0

    def _persist_result(
        self,
        result: Any,
        *,
        strategy_path: str = "",
        instrument: str = "",
        bar_type: str = "",
        start_date: str = "",
        end_date: str = "",
        config_json: str = "{}",
    ) -> None:
        payload = {
            "id": result.id,
            "strategy_path": strategy_path,
            "instrument": instrument,
            "bar_type": bar_type,
            "start_date": start_date,
            "end_date": end_date,
            "total_return": result.total_return,
            "sharpe_ratio": result.sharpe_ratio,
            "max_drawdown": result.max_drawdown,
            "sortino_ratio": result.sortino_ratio,
            "total_trades": result.total_trades,
            "winning_trades": result.winning_trades,
            "win_rate": result.win_rate,
            "profit_factor": result.profit_factor,
            "config_json": config_json,
            "equity_curve_json": result.equity_curve_json,
            "trades_json": result.trades_json,
            "created_at": result.created_at,
        }
        # JSON file write (existing behaviour)
        path = self._backtests_dir / f"{result.id}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        # SQLite dual-write (TDR-005)
        try:
            self._backtest_db.record_backtest(payload)
        except Exception:
            logger.warning("SQLite dual-write failed for %s", result.id, exc_info=True)

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
