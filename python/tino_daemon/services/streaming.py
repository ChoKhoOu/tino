# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from tino_daemon.proto.tino.streaming.v1 import streaming_pb2, streaming_pb2_grpc
from tino_daemon.streaming.binance_ws import BinanceWSClient
from tino_daemon.streaming.polygon_ws import PolygonWSClient
from tino_daemon.streaming.subscription_registry import SubscriptionRegistry
from tino_daemon.streaming.ws_client import BaseWSClient

logger = logging.getLogger(__name__)

_EVENT_TYPE_MAP = {
    "quote": streaming_pb2.SubscribeResponse.EVENT_TYPE_QUOTE,
    "trade": streaming_pb2.SubscribeResponse.EVENT_TYPE_TRADE,
    "bar": streaming_pb2.SubscribeResponse.EVENT_TYPE_BAR,
}


class StreamingServiceServicer(streaming_pb2_grpc.StreamingServiceServicer):
    def __init__(self, registry: SubscriptionRegistry | None = None) -> None:
        self._registry = registry or SubscriptionRegistry()
        self._clients: dict[str, BaseWSClient] = {}

    def _create_ws_client(self, source: str) -> BaseWSClient:
        if source == "binance":
            return BinanceWSClient()
        return PolygonWSClient()

    async def Subscribe(
        self,
        request: Any,
        context: Any,
    ) -> AsyncIterator[Any]:
        instrument = request.instrument
        source = request.source
        event_type = request.event_type or "trade"

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
            self._registry.remove(instrument, source)
            yield streaming_pb2.SubscribeResponse(
                type=streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR,
                instrument=instrument,
                source=source,
                data_json=json.dumps({"error": str(exc)}),
                timestamp=_now_iso(),
            )
            return

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

        while not context.cancelled():
            try:
                msg = await asyncio.wait_for(client.message_queue.get(), timeout=0.5)
            except (TimeoutError, asyncio.TimeoutError):
                continue

            yield streaming_pb2.SubscribeResponse(
                type=proto_event_type,
                instrument=instrument,
                source=source,
                data_json=msg,
                timestamp=_now_iso(),
            )

        await client.disconnect()
        self._registry.remove(instrument, source)
        self._clients.pop(client_key, None)

    async def Unsubscribe(self, request: Any, context: Any) -> Any:
        del context
        instrument = request.instrument
        source = request.source

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
