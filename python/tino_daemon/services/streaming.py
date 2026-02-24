# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from tino_daemon.proto.tino.streaming.v1 import streaming_pb2, streaming_pb2_grpc
from tino_daemon.streaming.binance_ws import BinanceWSClient
from tino_daemon.streaming.bybit_ws import BybitWSClient
from tino_daemon.streaming.okx_ws import OKXWSClient
from tino_daemon.streaming.polygon_ws import PolygonWSClient
from tino_daemon.streaming.subscription_registry import SubscriptionRegistry
from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_EVENT_TYPE_MAP = {
    "quote": streaming_pb2.SubscribeResponse.EVENT_TYPE_QUOTE,
    "trade": streaming_pb2.SubscribeResponse.EVENT_TYPE_TRADE,
    "bar": streaming_pb2.SubscribeResponse.EVENT_TYPE_BAR,
}

_VALID_SOURCES = frozenset({"binance", "okx", "bybit", "polygon"})
_VALID_EVENT_TYPES = frozenset({"trade", "quote", "bar"})
_MAX_INSTRUMENT_LEN = 64
_MAX_MESSAGE_SIZE = 65536  # 64KB
_INSTRUMENT_RE = re.compile(r'^[A-Za-z0-9._/-]+$')


class StreamingServiceServicer(streaming_pb2_grpc.StreamingServiceServicer):
    def __init__(self, registry: SubscriptionRegistry | None = None) -> None:
        self._registry = registry or SubscriptionRegistry()
        self._clients: dict[str, BaseWSClient] = {}

    def _create_ws_client(self, source: str) -> BaseWSClient:
        if source not in _VALID_SOURCES:
            raise ValueError(f"unsupported source: {source!r}")
        if source == "binance":
            return BinanceWSClient()
        if source == "okx":
            return OKXWSClient()
        if source == "bybit":
            return BybitWSClient()
        return PolygonWSClient()

    async def Subscribe(
        self,
        request: Any,
        context: Any,
    ) -> AsyncIterator[Any]:
        instrument = request.instrument
        source = request.source
        event_type = request.event_type or "trade"

        if (
            not instrument
            or len(instrument) > _MAX_INSTRUMENT_LEN
            or not _INSTRUMENT_RE.match(instrument)
        ):
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "invalid instrument"}),
                timestamp=_now_iso(),
            )
            return

        if source not in _VALID_SOURCES:
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "unsupported source"}),
                timestamp=_now_iso(),
            )
            return

        if event_type not in _VALID_EVENT_TYPES:
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "invalid event type"}),
                timestamp=_now_iso(),
            )
            return

        if not self._registry.add(instrument, source, event_type):
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "max subscriptions reached"}),
                timestamp=_now_iso(),
            )
            return

        client = self._create_ws_client(source)
        client_key = f"{instrument}:{source}"
        self._clients[client_key] = client

        try:
            await client.connect()
        except Exception as exc:
            logger.error("WS connect failed for %s/%s: %s", instrument, source, exc)
            self._registry.remove(instrument, source)
            self._clients.pop(client_key, None)
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "connection failed"}),
                timestamp=_now_iso(),
            )
            return

        try:
            await client.subscribe(instrument, event_type)
        except Exception as exc:
            logger.error("WS subscribe failed for %s/%s: %s", instrument, source, exc)
            await client.disconnect()
            self._registry.remove(instrument, source)
            self._clients.pop(client_key, None)
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": "subscribe failed"}),
                timestamp=_now_iso(),
            )
            return

        client.start_receiving(instrument, event_type)

        yield streaming_pb2.SubscribeResponse(
            type=streaming_pb2.SubscribeResponse.EVENT_TYPE_STATUS,
            instrument=instrument,
            source=source,
            data_json=json.dumps({"status": "subscribed"}),
            timestamp=_now_iso(),
        )

        proto_event_type = _EVENT_TYPE_MAP.get(
            event_type, streaming_pb2.SubscribeResponse.EVENT_TYPE_TRADE
        )

        try:
            while not context.cancelled() and client.connected:
                try:
                    msg = await asyncio.wait_for(client.message_queue.get(), timeout=0.5)
                except (TimeoutError, asyncio.TimeoutError):
                    continue

                if len(msg) > _MAX_MESSAGE_SIZE:
                    logger.warning("Oversized WS message dropped (%d bytes)", len(msg))
                    continue
                try:
                    json.loads(msg)  # validate JSON
                except (json.JSONDecodeError, ValueError):
                    logger.warning("Non-JSON WS message dropped")
                    continue

                yield streaming_pb2.SubscribeResponse(
                    type=proto_event_type,
                    instrument=instrument,
                    source=source,
                    data_json=msg,
                    timestamp=_now_iso(),
                )
        finally:
            await client.disconnect()
            self._registry.remove(instrument, source)
            self._clients.pop(client_key, None)

    async def Unsubscribe(self, request: Any, context: Any) -> Any:
        del context
        instrument = request.instrument
        source = request.source

        if (
            not instrument
            or len(instrument) > _MAX_INSTRUMENT_LEN
            or not _INSTRUMENT_RE.match(instrument)
            or source not in _VALID_SOURCES
        ):
            return streaming_pb2.UnsubscribeResponse(success=False)

        client_key = f"{instrument}:{source}"
        client = self._clients.pop(client_key, None)
        if client:
            await client.disconnect()

        removed = self._registry.remove(instrument, source)
        return streaming_pb2.UnsubscribeResponse(success=removed)

    async def ListSubscriptions(self, request: Any, context: Any) -> Any:
        del request, context
        subs = self._registry.list_all()
        return streaming_pb2.ListSubscriptionsResponse(
            subscriptions=[
                streaming_pb2.Subscription(
                    instrument=s.instrument,
                    source=s.source,
                    event_type=s.event_type,
                )
                for s in subs
            ]
        )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
