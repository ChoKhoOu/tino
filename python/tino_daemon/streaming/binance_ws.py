from __future__ import annotations

import json
import logging

import websockets

from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_BINANCE_WS_URL = "wss://stream.binance.com:9443/ws"


class BinanceWSClient(BaseWSClient):
    def __init__(self) -> None:
        super().__init__(url=_BINANCE_WS_URL)
        self._ws: websockets.ClientConnection | None = None
        self._sub_id = 0

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

    def _next_id(self) -> int:
        self._sub_id += 1
        return self._sub_id

    async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
        stream = self._build_stream_name(instrument, event_type)
        msg = json.dumps(
            {
                "method": "SUBSCRIBE",
                "params": [stream],
                "id": self._next_id(),
            }
        )
        await self._ws_send(msg)

    async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
        stream = self._build_stream_name(instrument, event_type)
        msg = json.dumps(
            {
                "method": "UNSUBSCRIBE",
                "params": [stream],
                "id": self._next_id(),
            }
        )
        await self._ws_send(msg)

    @staticmethod
    def _build_stream_name(instrument: str, event_type: str) -> str:
        symbol = instrument.lower()
        if event_type == "trade":
            return f"{symbol}@trade"
        if event_type == "bar":
            return f"{symbol}@kline_1m"
        return f"{symbol}@ticker"
