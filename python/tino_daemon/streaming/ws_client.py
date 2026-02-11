from __future__ import annotations

import abc
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_MAX_RETRIES = 10
_DEFAULT_MAX_BACKOFF = 30.0
_DEFAULT_QUEUE_MAXSIZE = 1000


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

    @abc.abstractmethod
    async def _ws_connect(self) -> None: ...

    @abc.abstractmethod
    async def _ws_send(self, data: str) -> None: ...

    @abc.abstractmethod
    async def _ws_recv(self) -> str: ...

    @abc.abstractmethod
    async def _ws_close(self) -> None: ...

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
        try:
            await self._ws_close()
        except Exception as exc:
            logger.warning("WS close error: %s", exc)

    async def enqueue_message(self, message: str) -> None:
        if self.message_queue.full():
            try:
                self.message_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        self.message_queue.put_nowait(message)

    @property
    def connected(self) -> bool:
        return self._connected
