"""WebSocket endpoint for live trading event streaming."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/live/{session_id}")
async def live_stream(websocket: WebSocket, session_id: str):
    """WebSocket for live trading events. Streams state changes, positions, orders, risk alerts."""
    topic = f"live:{session_id}"
    await ws_manager.connect(websocket, topic)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "pong":
                    pass
            except json.JSONDecodeError:
                logger.warning(f"Invalid live WS message: {data}")
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from live session {session_id}")
    finally:
        ws_manager.disconnect(websocket, topic)
