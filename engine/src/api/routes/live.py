"""Live trading API routes including kill-switch."""

import logging

from fastapi import APIRouter, HTTPException

from ...core.live_manager import live_manager
from ...schemas.live_session import LiveDeploy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live", tags=["live"])


@router.post("/deploy", status_code=202)
async def deploy_live(data: LiveDeploy):
    """Deploy a strategy to live trading."""
    try:
        result = await live_manager.deploy(
            strategy_version_hash=data.strategy_version_hash,
            trading_pair=data.trading_pair,
            parameters=data.parameters,
            risk_profile_id=str(data.risk_profile_id),
            confirmed_by=data.confirmed_by_session,
        )
        return result
    except ValueError as e:
        error_code = "STRATEGY_NOT_BACKTESTED" if "backtest" in str(e).lower() else "DEPLOYMENT_ERROR"
        raise HTTPException(status_code=409, detail={
            "error": error_code,
            "message": str(e),
        })


@router.post("/{session_id}/pause")
async def pause_live(session_id: str):
    try:
        await live_manager.pause(session_id)
        return {"status": "paused"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": "SESSION_NOT_FOUND", "message": str(e)})


@router.post("/{session_id}/resume")
async def resume_live(session_id: str):
    try:
        await live_manager.resume(session_id)
        return {"status": "running"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": "SESSION_NOT_FOUND", "message": str(e)})


@router.post("/{session_id}/stop")
async def stop_live(session_id: str):
    try:
        await live_manager.stop(session_id)
        return {"status": "stopped"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": "SESSION_NOT_FOUND", "message": str(e)})


@router.get("")
async def list_live_sessions():
    return await live_manager.list_sessions()


@router.get("/{session_id}")
async def get_live_session(session_id: str):
    result = await live_manager.get_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail={"error": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"})
    return result


# Kill-switch is at /api/kill-switch (not under /live prefix)
kill_switch_router = APIRouter(tags=["live"])


@kill_switch_router.post("/kill-switch")
async def kill_switch():
    """Emergency kill-switch: cancel all orders, flatten all positions."""
    result = await live_manager.kill_switch()
    return result
