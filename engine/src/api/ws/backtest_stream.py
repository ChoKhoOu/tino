"""WebSocket endpoint for backtest progress streaming."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/backtest/{backtest_id}")
async def backtest_stream(websocket: WebSocket, backtest_id: str):
    """WebSocket endpoint for streaming backtest progress.

    Clients connect after submitting a backtest via POST /api/backtest.
    Server streams progress, completed, or failed events.
    """
    topic = f"backtest:{backtest_id}"
    await ws_manager.connect(websocket, topic)

    try:
        while True:
            # Listen for client messages (e.g., cancel)
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "backtest.cancel":
                    from ...core.backtest_runner import backtest_runner
                    await backtest_runner.cancel_backtest(backtest_id)
                elif message.get("type") == "pong":
                    pass  # Heartbeat response, ignore
            except json.JSONDecodeError:
                logger.warning(f"Invalid WebSocket message: {data}")

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from backtest {backtest_id}")
    finally:
        ws_manager.disconnect(websocket, topic)
