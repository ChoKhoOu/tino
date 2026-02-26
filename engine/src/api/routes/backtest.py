"""Backtest API routes."""

import logging

from fastapi import APIRouter, HTTPException, Query

from ...core.backtest_runner import backtest_runner
from ...core.database import get_db
from ...schemas.backtest import BacktestCreate, BacktestCreateResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post("", response_model=BacktestCreateResponse, status_code=202)
async def submit_backtest(data: BacktestCreate):
    """Submit a new backtest run. Returns immediately with job ID."""
    # Verify strategy exists
    db = await get_db()
    result = await db.execute(
        "SELECT id FROM strategies WHERE version_hash = ?",
        (data.strategy_version_hash,),
    )
    if not await result.fetchone():
        raise HTTPException(status_code=404, detail={
            "error": "STRATEGY_NOT_FOUND",
            "message": f"Strategy {data.strategy_version_hash} not found",
        })

    response = await backtest_runner.submit_backtest(data)
    return BacktestCreateResponse(**response)


@router.get("/{backtest_id}")
async def get_backtest(backtest_id: str):
    """Get backtest run details and results."""
    result = await backtest_runner.get_backtest(backtest_id)
    if not result:
        raise HTTPException(status_code=404, detail={
            "error": "BACKTEST_NOT_FOUND",
            "message": f"Backtest {backtest_id} not found",
        })
    return result


@router.get("")
async def list_backtests(
    strategy_hash: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List backtest runs with optional filters."""
    db = await get_db()
    conditions = []
    params = []

    if strategy_hash:
        conditions.append("strategy_version_hash = ?")
        params.append(strategy_hash)
    if status:
        conditions.append("status = ?")
        params.append(status)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params_tuple = tuple(params)

    count_result = await db.execute(
        f"SELECT COUNT(*) as cnt FROM backtest_runs {where}", params_tuple
    )
    count_row = await count_result.fetchone()
    total = count_row["cnt"]

    result = await db.execute(
        f"""SELECT id, strategy_version_hash, trading_pair, status, progress_pct,
            started_at, completed_at FROM backtest_runs {where}
            ORDER BY started_at DESC LIMIT ? OFFSET ?""",
        (*params, limit, offset),
    )
    rows = await result.fetchall()

    return {
        "items": [dict(row) for row in rows],
        "total": total,
    }
