# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

"""Tests for the Subscribe RPC ws_client.subscribe() and receive loop fix.

These tests verify the critical fix: after connect(), the Subscribe RPC must
call client.subscribe(instrument, event_type) and client.start_receiving()
to actually begin receiving data over the WebSocket.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from tino_daemon.proto.tino.streaming.v1 import streaming_pb2
from tino_daemon.streaming.subscription_registry import SubscriptionRegistry

from conftest import FakeContext, _make_fake_client


def _make_servicer(
    registry: SubscriptionRegistry | None = None,
) -> Any:
    from tino_daemon.services.streaming import StreamingServiceServicer

    return StreamingServiceServicer(registry=registry or SubscriptionRegistry())


@pytest.mark.asyncio
async def test_subscribe_calls_ws_client_subscribe():
    """After connect(), Subscribe RPC calls client.subscribe(instrument, event_type)."""
    servicer = _make_servicer()
    fake_client = _make_fake_client()

    request = streaming_pb2.SubscribeRequest(
        instrument="BTCUSDT",
        source="binance",
        event_type="trade",
    )

    # Cancel immediately after the status event so we exit the loop
    ctx = FakeContext(cancel_after=1)

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        events = []
        async for event in servicer.Subscribe(request, ctx):
            events.append(event)

    fake_client.connect.assert_awaited_once()
    fake_client.subscribe.assert_awaited_once_with("BTCUSDT", "trade")


@pytest.mark.asyncio
async def test_subscribe_starts_receive_loop():
    """After subscribe(), Subscribe RPC calls client.start_receiving()."""
    servicer = _make_servicer()
    fake_client = _make_fake_client()

    request = streaming_pb2.SubscribeRequest(
        instrument="ETHUSDT",
        source="bybit",
        event_type="quote",
    )

    ctx = FakeContext(cancel_after=1)

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        events = []
        async for event in servicer.Subscribe(request, ctx):
            events.append(event)

    fake_client.start_receiving.assert_called_once_with("ETHUSDT", "quote")


@pytest.mark.asyncio
async def test_subscribe_calls_in_correct_order():
    """connect -> subscribe -> start_receiving must happen in that order."""
    servicer = _make_servicer()
    fake_client = _make_fake_client()

    # Track call order
    call_order: list[str] = []
    fake_client.connect.side_effect = lambda: call_order.append("connect")
    fake_client.subscribe.side_effect = lambda *a, **kw: call_order.append("subscribe")
    fake_client.start_receiving.side_effect = lambda *a, **kw: call_order.append(
        "start_receiving"
    )

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="polygon",
        event_type="trade",
    )

    ctx = FakeContext(cancel_after=1)

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        async for _ in servicer.Subscribe(request, ctx):
            pass

    assert call_order == ["connect", "subscribe", "start_receiving"]


@pytest.mark.asyncio
async def test_subscribe_error_cleans_up():
    """If subscribe() raises, cleanup happens: disconnect, registry remove, error yielded."""
    registry = SubscriptionRegistry()
    servicer = _make_servicer(registry=registry)
    fake_client = _make_fake_client()
    fake_client.subscribe.side_effect = ConnectionError("subscription failed")

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="polygon",
        event_type="trade",
    )

    ctx = FakeContext()

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        events = []
        async for event in servicer.Subscribe(request, ctx):
            events.append(event)

    # Should yield an error response
    error_events = [
        e
        for e in events
        if e.type == streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR
    ]
    assert len(error_events) >= 1
    error_data = json.loads(error_events[0].data_json)
    assert error_data.get("error") == "subscribe failed"

    # Cleanup: disconnect called and registry entry removed
    fake_client.disconnect.assert_awaited()
    assert not registry.has("AAPL", "polygon")


@pytest.mark.asyncio
async def test_subscribe_yields_data_from_queue():
    """Messages placed in client.message_queue are yielded as SubscribeResponse."""
    servicer = _make_servicer()
    messages = [
        json.dumps({"price": 150.0, "size": 100}),
        json.dumps({"price": 151.0, "size": 200}),
    ]
    fake_client = _make_fake_client(messages=messages)

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="polygon",
        event_type="trade",
    )

    events: list[Any] = []

    # Cancel after collecting a few events (status + 2 data + loop timeout)
    ctx = FakeContext(cancel_after=10)

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):

        async def _collect():
            async for event in servicer.Subscribe(request, ctx):
                events.append(event)
                # After status + 2 data events, stop
                if len(events) >= 3:
                    ctx.cancel()

        await _collect()

    # First event is the status confirmation
    assert events[0].type == streaming_pb2.SubscribeResponse.EVENT_TYPE_STATUS

    # Subsequent events are trade data
    data_events = [
        e
        for e in events
        if e.type == streaming_pb2.SubscribeResponse.EVENT_TYPE_TRADE
    ]
    assert len(data_events) == 2
    assert data_events[0].instrument == "AAPL"
    assert data_events[0].source == "polygon"

    first_data = json.loads(data_events[0].data_json)
    assert first_data["price"] == 150.0
    assert first_data["size"] == 100


@pytest.mark.asyncio
async def test_unsubscribe_disconnects_client():
    """Unsubscribe RPC disconnects the WS client and removes registry entry."""
    registry = SubscriptionRegistry()
    registry.add("AAPL", "polygon", "trade")

    servicer = _make_servicer(registry=registry)
    fake_client = _make_fake_client()

    # Manually inject the client into servicer._clients
    servicer._clients["AAPL:polygon"] = fake_client

    request = streaming_pb2.UnsubscribeRequest(
        instrument="AAPL",
        source="polygon",
    )

    response = await servicer.Unsubscribe(request, FakeContext())

    assert response.success is True
    fake_client.disconnect.assert_awaited_once()
    assert not registry.has("AAPL", "polygon")
    assert "AAPL:polygon" not in servicer._clients


@pytest.mark.asyncio
async def test_subscribe_cleanup_on_context_cancel():
    """When gRPC context is cancelled, Subscribe cleans up client and registry."""
    registry = SubscriptionRegistry()
    servicer = _make_servicer(registry=registry)
    fake_client = _make_fake_client()

    request = streaming_pb2.SubscribeRequest(
        instrument="MSFT",
        source="polygon",
        event_type="quote",
    )

    # Cancel after 2 checks (status yield + 1 loop iteration)
    ctx = FakeContext(cancel_after=2)

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        async for _ in servicer.Subscribe(request, ctx):
            pass

    # After context cancellation, client should be disconnected
    fake_client.disconnect.assert_awaited()
    # Registry entry should be removed
    assert not registry.has("MSFT", "polygon")


@pytest.mark.asyncio
async def test_subscribe_max_subscriptions_yields_error():
    """When max subscriptions reached, Subscribe yields an error without connecting."""
    registry = SubscriptionRegistry()
    # Fill up all 5 slots
    for inst in ["A", "B", "C", "D", "E"]:
        registry.add(inst, "polygon", "trade")

    servicer = _make_servicer(registry=registry)
    fake_client = _make_fake_client()

    request = streaming_pb2.SubscribeRequest(
        instrument="F",
        source="polygon",
        event_type="trade",
    )

    ctx = FakeContext()

    with patch.object(servicer, "_create_ws_client", return_value=fake_client):
        events = []
        async for event in servicer.Subscribe(request, ctx):
            events.append(event)

    assert len(events) == 1
    assert events[0].type == streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR
    error_data = json.loads(events[0].data_json)
    assert "max subscriptions" in error_data["error"]

    # connect() should never have been called
    fake_client.connect.assert_not_awaited()


# ---------------------------------------------------------------------------
# New tests for receive-loop reconnect, connect-failure cleanup, and
# input-validation coverage.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_receive_loop_reconnect_and_resubscribe():
    """When _ws_recv() raises during operation, receive loop reconnects and resubscribes."""
    from tino_daemon.streaming.ws_client import BaseWSClient

    class ReconnectTestClient(BaseWSClient):
        def __init__(self) -> None:
            super().__init__(url="wss://test.example.com", max_retries=1)
            self.recv_calls = 0
            self.subscribe_calls: list[tuple[str, str]] = []
            self._mock_ws_connected = True

        async def _ws_connect(self) -> None:
            pass

        async def _ws_send(self, data: str) -> None:
            pass

        async def _ws_recv(self) -> str:
            self.recv_calls += 1
            if self.recv_calls == 1:
                raise ConnectionError("simulated disconnect")
            if self.recv_calls <= 3:
                return json.dumps({"data": self.recv_calls})
            # After 3 messages, stop by setting connected=False
            self._connected = False
            raise ConnectionError("done")

        async def _ws_close(self) -> None:
            pass

        async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
            self.subscribe_calls.append((instrument, event_type))

        async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

    client = ReconnectTestClient()
    await client.connect()
    client.start_receiving("BTCUSDT", "trade")

    # Wait for the loop to process
    await asyncio.sleep(0.5)

    # Should have called subscribe during reconnect
    assert len(client.subscribe_calls) >= 1
    assert client.subscribe_calls[0] == ("BTCUSDT", "trade")

    # Should have enqueued messages
    assert not client.message_queue.empty()

    await client.stop_receiving()


@pytest.mark.asyncio
async def test_receive_loop_reconnect_failure_stops_loop():
    """When reconnect fails inside receive loop, the loop terminates and _connected becomes False."""
    from tino_daemon.streaming.ws_client import BaseWSClient

    class FailReconnectClient(BaseWSClient):
        def __init__(self) -> None:
            super().__init__(url="wss://test.example.com", max_retries=1)
            self.connect_count = 0

        async def _ws_connect(self) -> None:
            self.connect_count += 1
            if self.connect_count > 1:
                raise ConnectionError("reconnect failed")

        async def _ws_send(self, data: str) -> None:
            pass

        async def _ws_recv(self) -> str:
            raise ConnectionError("connection lost")

        async def _ws_close(self) -> None:
            pass

        async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

        async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

    client = FailReconnectClient()
    await client.connect()
    assert client.connected is True

    client.start_receiving("AAPL", "trade")
    await asyncio.sleep(1.0)  # Give loop time to fail

    assert client.connected is False
    assert client._recv_task is not None
    assert client._recv_task.done()


@pytest.mark.asyncio
async def test_subscribe_connect_failure_cleans_up():
    """When connect() fails at the servicer level, an error response is yielded and cleanup happens."""
    from tino_daemon.services.streaming import StreamingServiceServicer

    registry = SubscriptionRegistry()
    servicer = StreamingServiceServicer(registry=registry)

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="binance",
        event_type="trade",
    )

    ctx = FakeContext()
    events: list[Any] = []

    with patch.object(servicer, "_create_ws_client") as mock_factory:
        fake_client = _make_fake_client()
        fake_client.connect = AsyncMock(side_effect=ConnectionError("refused"))
        mock_factory.return_value = fake_client

        async for event in servicer.Subscribe(request, ctx):
            events.append(event)

    assert len(events) == 1
    assert events[0].type == streaming_pb2.SubscribeResponse.EVENT_TYPE_ERROR
    error_data = json.loads(events[0].data_json)
    assert error_data["error"] == "connection failed"  # generic, no exception detail
    assert len(registry.list_all()) == 0


@pytest.mark.asyncio
async def test_subscribe_invalid_instrument_rejected():
    """Subscribe rejects instruments with invalid characters."""
    from tino_daemon.services.streaming import StreamingServiceServicer

    servicer = StreamingServiceServicer()

    # Test with invalid characters
    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL; DROP TABLE",
        source="binance",
        event_type="trade",
    )

    events: list[Any] = []
    async for event in servicer.Subscribe(request, FakeContext()):
        events.append(event)

    assert len(events) == 1
    error_data = json.loads(events[0].data_json)
    assert error_data["error"] == "invalid instrument"


@pytest.mark.asyncio
async def test_subscribe_invalid_source_rejected():
    """Subscribe rejects unknown data sources."""
    from tino_daemon.services.streaming import StreamingServiceServicer

    servicer = StreamingServiceServicer()

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="evil_exchange",
        event_type="trade",
    )

    events: list[Any] = []
    async for event in servicer.Subscribe(request, FakeContext()):
        events.append(event)

    assert len(events) == 1
    error_data = json.loads(events[0].data_json)
    assert error_data["error"] == "unsupported source"


@pytest.mark.asyncio
async def test_subscribe_invalid_event_type_rejected():
    """Subscribe rejects unknown event types."""
    from tino_daemon.services.streaming import StreamingServiceServicer

    servicer = StreamingServiceServicer()

    request = streaming_pb2.SubscribeRequest(
        instrument="AAPL",
        source="binance",
        event_type="malicious",
    )

    events: list[Any] = []
    async for event in servicer.Subscribe(request, FakeContext()):
        events.append(event)

    assert len(events) == 1
    error_data = json.loads(events[0].data_json)
    assert error_data["error"] == "invalid event type"


@pytest.mark.asyncio
async def test_receive_loop_max_reconnects_exceeded():
    """Receive loop stops after exceeding _MAX_LOOP_RECONNECTS consecutive failures."""
    from tino_daemon.streaming.ws_client import BaseWSClient

    class AlwaysFailRecvClient(BaseWSClient):
        def __init__(self) -> None:
            super().__init__(url="wss://test.example.com", max_retries=1)

        async def _ws_connect(self) -> None:
            pass

        async def _ws_send(self, data: str) -> None:
            pass

        async def _ws_recv(self) -> str:
            raise ConnectionError("always fails")

        async def _ws_close(self) -> None:
            pass

        async def subscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

        async def unsubscribe(self, instrument: str, event_type: str = "trade") -> None:
            pass

    client = AlwaysFailRecvClient()
    await client.connect()
    client.start_receiving("AAPL", "trade")

    await asyncio.sleep(2.0)  # Give time for retries

    assert client.connected is False
    assert client._recv_task is not None
    assert client._recv_task.done()
