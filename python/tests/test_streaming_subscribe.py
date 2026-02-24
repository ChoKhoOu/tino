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


class FakeContext:
    """Simulates a gRPC context that cancels after a set number of checks."""

    def __init__(self, cancel_after: int = 0) -> None:
        self._check_count = 0
        self._cancel_after = cancel_after
        self._cancelled = False

    def cancelled(self) -> bool:
        if self._cancelled:
            return True
        self._check_count += 1
        if self._cancel_after > 0 and self._check_count > self._cancel_after:
            self._cancelled = True
        return self._cancelled

    def cancel(self) -> None:
        self._cancelled = True


def _make_fake_client(
    messages: list[str] | None = None,
) -> AsyncMock:
    """Create a mock WS client with a pre-loaded message queue."""
    client = AsyncMock()
    client.connect = AsyncMock()
    client.disconnect = AsyncMock()
    client.subscribe = AsyncMock()
    client.unsubscribe = AsyncMock()
    client.start_receiving = MagicMock()
    client.stop_receiving = AsyncMock()

    q: asyncio.Queue[str] = asyncio.Queue()
    if messages:
        for msg in messages:
            q.put_nowait(msg)
    client.message_queue = q

    return client


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
    assert "subscription failed" in error_data.get("error", "")

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
