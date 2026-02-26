"""WebSocket endpoint for dashboard broadcast stream."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/dashboard")
async def dashboard_stream(websocket: WebSocket):
    """Dashboard WebSocket: aggregate feed of all backtest and live events.

    Connected dashboards receive events from all active sessions.
    """
    topic = "dashboard"
    await ws_manager.connect(websocket, topic)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "pong":
                    pass  # Heartbeat response
            except json.JSONDecodeError:
                logger.warning(f"Invalid dashboard WS message: {data}")
    except WebSocketDisconnect:
        logger.info("Dashboard client disconnected")
    finally:
        ws_manager.disconnect(websocket, topic)
