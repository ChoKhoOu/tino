"""Strategy CRUD API routes."""

import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query

from ...core.database import get_db
from ...core.strategy_loader import StrategyLoader, compute_version_hash
from ...schemas.strategy import (
    StrategyCreate,
    StrategyCreateResponse,
    StrategyListItem,
    StrategyListResponse,
    StrategyResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategies", tags=["strategies"])

_loader = StrategyLoader()


@router.post("", response_model=StrategyCreateResponse, status_code=201)
async def create_strategy(data: StrategyCreate):
    """Save a new strategy version."""
    db = await get_db()
    version_hash = compute_version_hash(data.source_code)

    # Check if this exact version already exists
    existing = await db.execute(
        "SELECT id, version_hash, name, created_at FROM strategies WHERE version_hash = ?",
        (version_hash,),
    )
    row = await existing.fetchone()
    if row:
        return StrategyCreateResponse(
            id=row["id"],
            version_hash=row["version_hash"],
            name=row["name"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    # Save to filesystem
    strategy = _loader.save_strategy(data)

    # Save to database
    await db.execute(
        """INSERT INTO strategies (id, version_hash, name, description, source_code,
           parameters, created_at, created_by_session, parent_version_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            str(strategy.id),
            strategy.version_hash,
            strategy.name,
            strategy.description,
            strategy.source_code,
            json.dumps(strategy.parameters),
            strategy.created_at.isoformat(),
            strategy.created_by_session,
            strategy.parent_version_hash,
        ),
    )
    await db.commit()

    logger.info(f"Strategy created: {strategy.name} ({strategy.version_hash})")

    return StrategyCreateResponse(
        id=strategy.id,
        version_hash=strategy.version_hash,
        name=strategy.name,
        created_at=strategy.created_at,
    )


@router.get("", response_model=StrategyListResponse)
async def list_strategies(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List all strategies with backtest counts."""
    db = await get_db()

    # Get total count
    count_result = await db.execute("SELECT COUNT(*) as cnt FROM strategies")
    count_row = await count_result.fetchone()
    total = count_row["cnt"]

    # Get paginated strategies with backtest and live session counts
    result = await db.execute(
        """SELECT s.id, s.version_hash, s.name, s.created_at,
           COALESCE(b.backtest_count, 0) as backtest_count,
           COALESCE(l.live_count, 0) as live_session_count
           FROM strategies s
           LEFT JOIN (
               SELECT strategy_version_hash, COUNT(*) as backtest_count
               FROM backtest_runs GROUP BY strategy_version_hash
           ) b ON s.version_hash = b.strategy_version_hash
           LEFT JOIN (
               SELECT strategy_version_hash, COUNT(*) as live_count
               FROM live_sessions GROUP BY strategy_version_hash
           ) l ON s.version_hash = l.strategy_version_hash
           ORDER BY s.created_at DESC
           LIMIT ? OFFSET ?""",
        (limit, offset),
    )
    rows = await result.fetchall()

    items = [
        StrategyListItem(
            id=row["id"],
            version_hash=row["version_hash"],
            name=row["name"],
            created_at=datetime.fromisoformat(row["created_at"]),
            backtest_count=row["backtest_count"],
            live_session_count=row["live_session_count"],
        )
        for row in rows
    ]

    return StrategyListResponse(items=items, total=total)


@router.get("/{version_hash}", response_model=StrategyResponse)
async def get_strategy(version_hash: str):
    """Get a strategy by its version hash, including source code."""
    db = await get_db()

    result = await db.execute(
        "SELECT * FROM strategies WHERE version_hash = ?",
        (version_hash,),
    )
    row = await result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail={
            "error": "STRATEGY_NOT_FOUND",
            "message": f"Strategy with hash {version_hash} not found",
        })

    return StrategyResponse(
        id=row["id"],
        version_hash=row["version_hash"],
        name=row["name"],
        description=row["description"],
        source_code=row["source_code"],
        parameters=json.loads(row["parameters"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        created_by_session=row["created_by_session"],
        parent_version_hash=row["parent_version_hash"],
    )
