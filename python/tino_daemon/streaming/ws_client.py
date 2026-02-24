from __future__ import annotations

import abc
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAX_RETRIES = 10
_DEFAULT_MAX_BACKOFF = 30.0
_DEFAULT_QUEUE_MAXSIZE = 1000
_MAX_LOOP_RECONNECTS = 5


class BaseWSClient(abc.ABC):
    def __init__(
        self,
        url: str,
        max_retries: int = _DEFAULT_MAX_RETRIES,
        max_backoff: float = _DEFAULT_MAX_BACKOFF,
        queue_maxsize: int = _DEFAULT_QUEUE_MAXSIZE,
    ) -> None:
        self._url = url
        self._max_retries = max_retries
        self._max_backoff = max_backoff
        self._connected = False
        self.message_queue: asyncio.Queue[str] = asyncio.Queue(maxsize=queue_maxsize)
        self._queue_maxsize = queue_maxsize
        self._recv_task: asyncio.Task[None] | None = None
        self._current_instrument: str = ""
        self._current_event_type: str = "trade"

    @abc.abstractmethod
    async def _ws_connect(self) -> None: ...

    @abc.abstractmethod
    async def _ws_send(self, data: str) -> None: ...

    @abc.abstractmethod
    async def _ws_recv(self) -> str: ...

    @abc.abstractmethod
    async def _ws_close(self) -> None: ...

    @abc.abstractmethod
    async def subscribe(self, instrument: str, event_type: str = "trade") -> None: ...

    @abc.abstractmethod
    async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None: ...

    async def connect(self) -> None:
        backoff = 1.0
        for attempt in range(1, self._max_retries + 1):
            try:
                await self._ws_connect()
                self._connected = True
                logger.info("WS connected to %s (attempt %d)", self._url, attempt)
                return
            except Exception as exc:
                logger.warning(
                    "WS connect attempt %d/%d failed: %s",
                    attempt,
                    self._max_retries,
                    exc,
                )
                if attempt == self._max_retries:
                    raise
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, self._max_backoff)

    async def disconnect(self) -> None:
        self._connected = False
        await self.stop_receiving()
        try:
            await self._ws_close()
        except Exception as exc:
            logger.warning("WS close error: %s", exc)

    async def reconnect(self) -> None:
        """Reconnect after connection loss without clearing the message queue."""
        self._connected = False
        try:
            await self._ws_close()
        except Exception:
            pass
        await self.connect()

    def start_receiving(self, instrument: str, event_type: str = "trade") -> None:
        """Start background task to receive WS messages and enqueue them."""
        if self._recv_task and not self._recv_task.done():
            raise RuntimeError("Receive loop already running; call stop_receiving() first")
        self._current_instrument = instrument
        self._current_event_type = event_type
        self._recv_task = asyncio.create_task(self._receive_loop())

    async def stop_receiving(self) -> None:
        """Cancel the background receive task."""
        if self._recv_task and not self._recv_task.done():
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
            self._recv_task = None

    async def _receive_loop(self) -> None:
        reconnect_count = 0
        while self._connected:
            try:
                msg = await self._ws_recv()
                await self.enqueue_message(msg)
                reconnect_count = 0  # reset on successful receive
            except asyncio.CancelledError:
                break
            except Exception as exc:
                if not self._connected:
                    break
                reconnect_count += 1
                if reconnect_count > _MAX_LOOP_RECONNECTS:
                    logger.error("Max reconnects (%d) exceeded, stopping receive loop", _MAX_LOOP_RECONNECTS)
                    self._connected = False
                    break
                logger.warning("WS receive error: %s, reconnecting (%d/%d)...", exc, reconnect_count, _MAX_LOOP_RECONNECTS)
                try:
                    await self.reconnect()
                    await self.subscribe(
                        self._current_instrument, self._current_event_type
                    )
                except Exception as re_exc:
                    logger.error("WS reconnect failed: %s", re_exc)
                    self._connected = False
                    break

    async def enqueue_message(self, message: str) -> None:
        if self.message_queue.full():
            try:
                self.message_queue.get_nowait()
                logger.debug("Queue full, dropped oldest message")
            except asyncio.QueueEmpty:
                pass
        self.message_queue.put_nowait(message)

    @property
    def connected(self) -> bool:
        return self._connected
