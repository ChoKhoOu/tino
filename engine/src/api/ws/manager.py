"""WebSocket connection manager for broadcasting events."""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections with topic-based subscriptions."""

    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = {}
        self._heartbeat_interval: float = 30.0
        self._heartbeat_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, topic: str) -> None:
        """Accept a WebSocket connection and subscribe to a topic."""
        await websocket.accept()
        if topic not in self._connections:
            self._connections[topic] = set()
        self._connections[topic].add(websocket)
        logger.info(f"Client connected to topic: {topic}")

    def disconnect(self, websocket: WebSocket, topic: str) -> None:
        """Remove a WebSocket connection from a topic."""
        if topic in self._connections:
            self._connections[topic].discard(websocket)
            if not self._connections[topic]:
                del self._connections[topic]
        logger.info(f"Client disconnected from topic: {topic}")

    async def send_event(self, topic: str, event: dict) -> None:
        """Send an event to all connections subscribed to a topic."""
        if topic not in self._connections:
            return
        message = json.dumps(event, default=str)
        disconnected = set()
        for ws in self._connections[topic]:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.add(ws)
        for ws in disconnected:
            self._connections[topic].discard(ws)

    async def broadcast(self, event: dict) -> None:
        """Broadcast an event to all connected clients across all topics."""
        message = json.dumps(event, default=str)
        disconnected_pairs: list[tuple[str, WebSocket]] = []
        for topic, connections in self._connections.items():
            for ws in connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected_pairs.append((topic, ws))
        for topic, ws in disconnected_pairs:
            self._connections[topic].discard(ws)

    async def start_heartbeat(self) -> None:
        """Start sending periodic heartbeat pings."""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop_heartbeat(self) -> None:
        """Stop the heartbeat task."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

    async def _heartbeat_loop(self) -> None:
        """Send ping events periodically."""
        while True:
            await asyncio.sleep(self._heartbeat_interval)
            ping = {"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()}
            await self.broadcast(ping)

    async def connect_multi(self, websocket: WebSocket, topics: list[str]) -> None:
        """Subscribe a single WebSocket to multiple topics."""
        await websocket.accept()
        for topic in topics:
            if topic not in self._connections:
                self._connections[topic] = set()
            self._connections[topic].add(websocket)

    def disconnect_all(self, websocket: WebSocket) -> None:
        """Remove a WebSocket from all topics."""
        for topic in list(self._connections.keys()):
            self._connections[topic].discard(websocket)
            if not self._connections[topic]:
                del self._connections[topic]

    def get_topic_counts(self) -> dict[str, int]:
        """Get subscriber counts per topic."""
        return {topic: len(conns) for topic, conns in self._connections.items()}

    @property
    def active_connections_count(self) -> int:
        """Total number of active connections across all topics."""
        return sum(len(conns) for conns in self._connections.values())


# Global singleton
ws_manager = ConnectionManager()
