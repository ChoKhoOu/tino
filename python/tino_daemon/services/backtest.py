"""BacktestService gRPC implementation."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, AsyncIterator
from uuid import uuid4

import grpc

from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.nautilus.engine import BacktestEngineWrapper
from tino_daemon.proto.tino.backtest.v1 import backtest_pb2, backtest_pb2_grpc

logger = logging.getLogger(__name__)


class BacktestServiceServicer(backtest_pb2_grpc.BacktestServiceServicer):
    """Implements BacktestService RPCs."""

    def __init__(self, catalog: DataCatalogWrapper, backtests_dir: str = "backtests"):
        self._catalog = catalog
        self._backtests_dir = Path(backtests_dir)
        self._backtests_dir.mkdir(parents=True, exist_ok=True)
        self._engine = BacktestEngineWrapper(
            catalog_path=str(self._catalog.path),
            backtests_dir=str(self._backtests_dir),
        )
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
            self._engine.run_backtest(
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
