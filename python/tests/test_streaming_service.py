# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tino_daemon.proto.tino.streaming.v1 import streaming_pb2
from tino_daemon.streaming.subscription_registry import SubscriptionRegistry

from conftest import FakeContext


@pytest.mark.asyncio
async def test_subscribe_receives_messages():
    from tino_daemon.services.streaming import StreamingServiceServicer

    registry = SubscriptionRegistry()
    servicer = StreamingServiceServicer(registry=registry)

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="polygon",
        event_type="trade",
    )

    ctx = FakeContext()
    events: list[Any] = []

    async def _collect():
        async for event in servicer.Subscribe(request, ctx):
            events.append(event)
            if len(events) >= 3:
                ctx.cancel()

    with patch.object(servicer, "_create_ws_client") as mock_factory:
        fake_client = AsyncMock()
        fake_client.connect = AsyncMock()
        fake_client.disconnect = AsyncMock()
        fake_client.subscribe = AsyncMock()
        fake_client.start_receiving = MagicMock()
        fake_client.connected = True

        q: asyncio.Queue = asyncio.Queue()
        await q.put(json.dumps({"price": 150.0, "size": 100}))
        await q.put(json.dumps({"price": 151.0, "size": 200}))
        fake_client.message_queue = q

        mock_factory.return_value = fake_client
        await _collect()

    assert len(events) >= 3
    assert events[0].type == streaming_pb2.SubscribeResponse.EVENT_TYPE_STATUS
    assert events[1].instrument == "AAPL"
    assert events[1].source == "polygon"
    assert events[1].type == streaming_pb2.SubscribeResponse.EVENT_TYPE_TRADE


@pytest.mark.asyncio
async def test_multi_instrument_subscription():
    registry = SubscriptionRegistry()

    assert registry.add("AAPL", "polygon", "trade") is True
    assert registry.add("MSFT", "polygon", "quote") is True
    assert registry.add("BTCUSDT", "binance", "trade") is True
    assert len(registry.list_all()) == 3


@pytest.mark.asyncio
async def test_reconnection_on_disconnect():
    from tino_daemon.streaming.ws_client import BaseWSClient

    class TestClient(BaseWSClient):
        def __init__(self) -> None:
            super().__init__(url="wss://test.example.com", max_retries=3)
            self.connect_attempts = 0

        async def _ws_connect(self) -> None:
            self.connect_attempts += 1
            if self.connect_attempts < 3:
                raise ConnectionError("simulated disconnect")

        async def _ws_send(self, data: str) -> None:
            pass

        async def _ws_recv(self) -> str:
            await asyncio.sleep(10)
            return "{}"

        async def _ws_close(self) -> None:
            pass

        async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

        async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

    client = TestClient()
    await client.connect()
    assert client.connect_attempts == 3


@pytest.mark.asyncio
async def test_backpressure_drops_oldest():
    from tino_daemon.streaming.ws_client import BaseWSClient

    class TestClient(BaseWSClient):
        def __init__(self) -> None:
            super().__init__(url="wss://test.example.com", queue_maxsize=3)

        async def _ws_connect(self) -> None:
            pass

        async def _ws_send(self, data: str) -> None:
            pass

        async def _ws_recv(self) -> str:
            return "{}"

        async def _ws_close(self) -> None:
            pass

        async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

        async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

    client = TestClient()
    for i in range(5):
        await client.enqueue_message(json.dumps({"seq": i}))

    assert client.message_queue.qsize() == 3
    msgs = []
    while not client.message_queue.empty():
        msgs.append(json.loads(await client.message_queue.get()))
    assert [m["seq"] for m in msgs] == [2, 3, 4]


@pytest.mark.asyncio
async def test_unsubscribe_stops_messages():
    from tino_daemon.services.streaming import StreamingServiceServicer

    registry = SubscriptionRegistry()
    registry.add("AAPL", "polygon", "trade")
    servicer = StreamingServiceServicer(registry=registry)

    request = streaming_pb2.UnsubscribeRequest(
        instrument="AAPL",
        source="polygon",
    )

    response = await servicer.Unsubscribe(request, FakeContext())
    assert response.success is True
    assert len(registry.list_all()) == 0


@pytest.mark.asyncio
async def test_max_5_subscriptions_enforced():
    registry = SubscriptionRegistry()

    for inst in ["AAPL", "MSFT", "GOOG", "AMZN", "TSLA"]:
        assert registry.add(inst, "polygon", "trade") is True

    assert len(registry.list_all()) == 5
    assert registry.add("META", "polygon", "trade") is False
    assert len(registry.list_all()) == 5


@pytest.mark.asyncio
async def test_deduplication_same_instrument_source():
    registry = SubscriptionRegistry()

    assert registry.add("AAPL", "polygon", "trade") is True
    assert registry.add("AAPL", "polygon", "quote") is True
    assert len(registry.list_all()) == 1


@pytest.mark.asyncio
async def test_list_subscriptions_returns_all():
    from tino_daemon.services.streaming import StreamingServiceServicer

    registry = SubscriptionRegistry()
    registry.add("AAPL", "polygon", "trade")
    registry.add("BTCUSDT", "binance", "trade")
    servicer = StreamingServiceServicer(registry=registry)

    request = streaming_pb2.ListSubscriptionsRequest()
    response = await servicer.ListSubscriptions(request, FakeContext())
    assert len(response.subscriptions) == 2

    instruments = {s.instrument for s in response.subscriptions}
    assert instruments == {"AAPL", "BTCUSDT"}
