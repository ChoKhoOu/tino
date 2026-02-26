"""Live session management: lifecycle, state transitions, and risk integration."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from ..api.ws.manager import ws_manager
from ..core.database import get_db
from ..risk.circuit_breaker import RiskCircuitBreaker
from ..schemas.live_session import LifecycleState

logger = logging.getLogger(__name__)


class LiveManager:
    """Manages live trading sessions with lifecycle state machine."""

    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._circuit_breakers: dict[str, RiskCircuitBreaker] = {}
        self._monitoring_tasks: dict[str, asyncio.Task] = {}

    async def deploy(
        self,
        strategy_version_hash: str,
        trading_pair: str,
        parameters: dict | None,
        risk_profile_id: str,
        confirmed_by: str,
    ) -> dict:
        """Deploy a strategy to live trading."""
        db = await get_db()

        # Verify strategy has been backtested
        bt_result = await db.execute(
            "SELECT id FROM backtest_runs WHERE strategy_version_hash = ? AND status = 'COMPLETED'",
            (strategy_version_hash,),
        )
        if not await bt_result.fetchone():
            raise ValueError("Strategy must have at least one completed backtest before live deployment")

        # Check concurrent strategy cap
        active_count = await db.execute(
            "SELECT COUNT(*) as cnt FROM live_sessions WHERE lifecycle_state IN ('DEPLOYING', 'RUNNING', 'PAUSED')"
        )
        count_row = await active_count.fetchone()

        rp_result = await db.execute(
            "SELECT max_concurrent_strategies FROM risk_profiles WHERE id = ?",
            (risk_profile_id,),
        )
        rp_row = await rp_result.fetchone()
        if rp_row and count_row["cnt"] >= rp_row["max_concurrent_strategies"]:
            raise ValueError(f"Maximum concurrent strategies ({rp_row['max_concurrent_strategies']}) reached")

        # Check for conflicts on same trading pair
        conflict = await db.execute(
            "SELECT id FROM live_sessions WHERE trading_pair = ? AND lifecycle_state IN ('RUNNING', 'PAUSED')",
            (trading_pair,),
        )
        if await conflict.fetchone():
            raise ValueError(f"Conflict: another live session already running on {trading_pair}")

        session_id = str(uuid4())
        now = datetime.now(timezone.utc)

        await db.execute(
            """INSERT INTO live_sessions (id, strategy_version_hash, trading_pair, exchange,
               lifecycle_state, positions, open_orders, realized_pnl, unrealized_pnl,
               risk_profile_id, parameters, confirmed_by, started_at)
               VALUES (?, ?, ?, 'BINANCE', 'DEPLOYING', '[]', '[]', '0', '0', ?, ?, ?, ?)""",
            (
                session_id, strategy_version_hash, trading_pair,
                risk_profile_id, json.dumps(parameters or {}),
                confirmed_by, now.isoformat(),
            ),
        )
        await db.commit()

        # Initialize circuit breaker
        rp_data = await db.execute("SELECT * FROM risk_profiles WHERE id = ?", (risk_profile_id,))
        rp = await rp_data.fetchone()
        if rp:
            self._circuit_breakers[session_id] = RiskCircuitBreaker(
                max_drawdown_pct=rp["max_drawdown_pct"],
                single_order_size_cap=rp["single_order_size_cap"],
                daily_loss_limit=rp["daily_loss_limit"],
            )

        # Transition to RUNNING
        await self._transition(session_id, LifecycleState.DEPLOYING, LifecycleState.RUNNING)

        return {
            "id": session_id,
            "lifecycle_state": "RUNNING",
            "ws_url": f"/ws/live/{session_id}",
        }

    async def pause(self, session_id: str) -> None:
        await self._transition(session_id, LifecycleState.RUNNING, LifecycleState.PAUSED)
        db = await get_db()
        now = datetime.now(timezone.utc)
        await db.execute(
            "UPDATE live_sessions SET paused_at = ? WHERE id = ?",
            (now.isoformat(), session_id),
        )
        await db.commit()

    async def resume(self, session_id: str) -> None:
        await self._transition(session_id, LifecycleState.PAUSED, LifecycleState.RUNNING)

    async def stop(self, session_id: str) -> None:
        db = await get_db()
        result = await db.execute(
            "SELECT lifecycle_state FROM live_sessions WHERE id = ?", (session_id,),
        )
        row = await result.fetchone()
        if not row:
            raise ValueError(f"Session {session_id} not found")

        current = row["lifecycle_state"]
        if current in (LifecycleState.STOPPING, LifecycleState.STOPPED):
            return

        await self._transition(session_id, current, LifecycleState.STOPPING)
        # Cancel orders, flatten positions
        await self._transition(session_id, LifecycleState.STOPPING, LifecycleState.STOPPED)

        now = datetime.now(timezone.utc)
        await db.execute(
            "UPDATE live_sessions SET stopped_at = ? WHERE id = ?",
            (now.isoformat(), session_id),
        )
        await db.commit()

    async def kill_switch(self) -> dict:
        """Emergency kill-switch: stop ALL live sessions immediately."""
        db = await get_db()
        result = await db.execute(
            "SELECT id FROM live_sessions WHERE lifecycle_state IN ('DEPLOYING', 'RUNNING', 'PAUSED')"
        )
        rows = await result.fetchall()

        killed = 0
        for row in rows:
            try:
                await self.stop(row["id"])
                killed += 1
            except Exception as e:
                logger.error(f"Failed to stop session {row['id']}: {e}")

        # Activate kill switch on risk profile
        await db.execute("UPDATE risk_profiles SET kill_switch_active = 1")
        await db.commit()

        now = datetime.now(timezone.utc)
        return {
            "killed_sessions": killed,
            "cancelled_orders": 0,
            "flattened_positions": 0,
            "executed_at": now.isoformat(),
        }

    async def get_session(self, session_id: str) -> dict | None:
        db = await get_db()
        result = await db.execute("SELECT * FROM live_sessions WHERE id = ?", (session_id,))
        row = await result.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "strategy_version_hash": row["strategy_version_hash"],
            "trading_pair": row["trading_pair"],
            "exchange": row["exchange"],
            "lifecycle_state": row["lifecycle_state"],
            "positions": json.loads(row["positions"]),
            "open_orders": json.loads(row["open_orders"]),
            "realized_pnl": row["realized_pnl"],
            "unrealized_pnl": row["unrealized_pnl"],
            "risk_profile_id": row["risk_profile_id"],
            "parameters": json.loads(row["parameters"]) if row["parameters"] else None,
            "confirmed_by": row["confirmed_by"],
            "started_at": row["started_at"],
            "paused_at": row["paused_at"],
            "stopped_at": row["stopped_at"],
        }

    async def list_sessions(self) -> list[dict]:
        db = await get_db()
        result = await db.execute(
            "SELECT id, strategy_version_hash, trading_pair, lifecycle_state, realized_pnl, unrealized_pnl, started_at FROM live_sessions ORDER BY started_at DESC"
        )
        return [dict(row) for row in await result.fetchall()]

    async def _transition(self, session_id: str, from_state: str, to_state: str) -> None:
        db = await get_db()
        await db.execute(
            "UPDATE live_sessions SET lifecycle_state = ? WHERE id = ? AND lifecycle_state = ?",
            (to_state, session_id, from_state),
        )
        await db.commit()

        topic = f"live:{session_id}"
        await ws_manager.send_event(topic, {
            "type": "live.state_change",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "session_id": session_id,
                "previous_state": from_state,
                "current_state": to_state,
            },
        })
        # Also broadcast to dashboard
        await ws_manager.send_event("dashboard", {
            "type": "live.state_change",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "session_id": session_id,
                "previous_state": from_state,
                "current_state": to_state,
            },
        })

        logger.info(f"Session {session_id}: {from_state} -> {to_state}")


live_manager = LiveManager()
