from __future__ import annotations

import json
import logging

import websockets

from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_OKX_WS_URL = "wss://ws.okx.com:8443/ws/v5/public"

_EVENT_TYPE_MAP = {
    "trade": "trades",
    "bar": "candle1m",
    "quote": "tickers",
}


class OKXWSClient(BaseWSClient):
    def __init__(self) -> None:
        super().__init__(url=_OKX_WS_URL)
        self._ws: websockets.ClientConnection | None = None

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
        channel = _EVENT_TYPE_MAP.get(event_type, "trades")
        msg = json.dumps(
            {
                "op": "subscribe",
                "args": [{"channel": channel, "instId": instrument.upper()}],
            }
        )
        await self._ws_send(msg)

    async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
        channel = _EVENT_TYPE_MAP.get(event_type, "trades")
        msg = json.dumps(
            {
                "op": "unsubscribe",
                "args": [{"channel": channel, "instId": instrument.upper()}],
            }
        )
        await self._ws_send(msg)
