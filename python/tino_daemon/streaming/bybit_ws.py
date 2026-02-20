from __future__ import annotations

import json
import logging

import websockets

from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/spot"

_EVENT_TYPE_MAP = {
    "trade": "publicTrade",
    "bar": "kline.1",
    "quote": "tickers",
}


class BybitWSClient(BaseWSClient):
    def __init__(self) -> None:
        super().__init__(url=_BYBIT_WS_URL)
        self._ws: websockets.ClientConnection | None = None
        self._req_id = 0

    def _next_id(self) -> str:
        self._req_id += 1
        return str(self._req_id)

    async def _ws_connect(self) -> None:
        self._ws = await websockets.connect(self._url)

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
        topic = self._build_topic(instrument, event_type)
        msg = json.dumps(
            {
                "op": "subscribe",
                "req_id": self._next_id(),
                "args": [topic],
            }
        )
        await self._ws_send(msg)

    async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
        topic = self._build_topic(instrument, event_type)
        msg = json.dumps(
            {
                "op": "unsubscribe",
                "req_id": self._next_id(),
                "args": [topic],
            }
        )
        await self._ws_send(msg)

    @staticmethod
    def _build_topic(instrument: str, event_type: str) -> str:
        prefix = _EVENT_TYPE_MAP.get(event_type, "publicTrade")
        return f"{prefix}.{instrument.upper()}"
