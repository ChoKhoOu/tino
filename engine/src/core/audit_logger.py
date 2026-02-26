"""Audit logging: record all significant actions with timestamps."""

import json
import logging
from datetime import datetime, timezone

from .database import get_db

logger = logging.getLogger(__name__)


class AuditAction:
    STRATEGY_SAVED = "strategy.saved"
    BACKTEST_STARTED = "backtest.started"
    BACKTEST_COMPLETED = "backtest.completed"
    BACKTEST_FAILED = "backtest.failed"
    LIVE_DEPLOYED = "live.deployed"
    LIVE_PAUSED = "live.paused"
    LIVE_RESUMED = "live.resumed"
    LIVE_STOPPED = "live.stopped"
    KILL_SWITCH = "kill_switch.activated"
    RISK_CHANGED = "risk.profile_changed"


async def log_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict | None = None,
    session_id: str | None = None,
) -> None:
    """Log an audit event to the database."""
    try:
        db = await get_db()
        # Create audit_log table if not exists
        await db.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                details TEXT,
                session_id TEXT
            )
        """)
        await db.execute(
            """INSERT INTO audit_log (timestamp, action, entity_type, entity_id, details, session_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                datetime.now(timezone.utc).isoformat(),
                action,
                entity_type,
                entity_id,
                json.dumps(details) if details else None,
                session_id,
            ),
        )
        await db.commit()
        logger.info(f"AUDIT: {action} on {entity_type}/{entity_id}")
    except Exception as e:
        # Audit logging should never break the main flow
        logger.error(f"Failed to write audit log: {e}")


async def get_audit_log(
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Retrieve audit log entries."""
    db = await get_db()
    conditions = []
    params = []
    if entity_type:
        conditions.append("entity_type = ?")
        params.append(entity_type)
    if entity_id:
        conditions.append("entity_id = ?")
        params.append(entity_id)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    result = await db.execute(
        f"SELECT * FROM audit_log {where} ORDER BY timestamp DESC LIMIT ?",
        (*params, limit),
    )
    rows = await result.fetchall()
    return [
        {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "action": row["action"],
            "entity_type": row["entity_type"],
            "entity_id": row["entity_id"],
            "details": json.loads(row["details"]) if row["details"] else None,
            "session_id": row["session_id"],
        }
        for row in rows
    ]
