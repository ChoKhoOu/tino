from __future__ import annotations

import json
import logging
import os

import websockets

from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_POLYGON_WS_URL = "wss://socket.polygon.io/stocks"

_EVENT_TYPE_MAP = {
    "trade": "T",
    "quote": "Q",
    "bar": "AM",
}


class PolygonWSClient(BaseWSClient):
    def __init__(self, api_key: str | None = None) -> None:
        super().__init__(url=_POLYGON_WS_URL)
        self._api_key = api_key or os.environ.get("POLYGON_API_KEY", "")
        self._ws: websockets.ClientConnection | None = None

    async def _ws_connect(self) -> None:
        self._ws = await websockets.connect(self._url)
        auth_msg = json.dumps({"action": "auth", "params": self._api_key})
        await self._ws.send(auth_msg)
        await self._ws.recv()

    async def _ws_send(self, data: str) -> None:
        if self._ws:
            await self._ws.send(data)

    async def _ws_recv(self) -> str:
        if self._ws is None:
            raise ConnectionError("not connected")
        return str(await self._ws.recv())

    async def _ws_close(self) -> None:
        if self._ws:
            await self._ws.close()
            self._ws = None

    async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
        prefix = _EVENT_TYPE_MAP.get(event_type, "T")
        params = f"{prefix}.{instrument}"
        msg = json.dumps({"action": "subscribe", "params": params})
        await self._ws_send(msg)

    async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
        prefix = _EVENT_TYPE_MAP.get(event_type, "T")
        params = f"{prefix}.{instrument}"
        msg = json.dumps({"action": "unsubscribe", "params": params})
        await self._ws_send(msg)
