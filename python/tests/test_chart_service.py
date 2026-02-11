# pyright: reportMissingImports=false, reportAttributeAccessIssue=false

from __future__ import annotations

from typing import AsyncGenerator

import grpc
import pytest
import pytest_asyncio

from tino_daemon.chart.plotext_renderer import (
    render_candlestick,
    render_line_chart,
    render_subplot,
)
from tino_daemon.proto.tino.chart.v1 import chart_pb2, chart_pb2_grpc
from tino_daemon.services.chart import ChartServiceServicer

DATES = ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-08"]
OPEN = [100.0, 105.0, 103.0, 107.0, 110.0]
CLOSE = [105.0, 102.0, 107.0, 110.0, 108.0]
HIGH = [110.0, 108.0, 109.0, 112.0, 113.0]
LOW = [98.0, 100.0, 101.0, 105.0, 106.0]
VOLUME = [1_000_000.0, 1_200_000.0, 900_000.0, 1_100_000.0, 1_050_000.0]

WIDTH = 80
HEIGHT = 20


@pytest_asyncio.fixture
async def chart_server() -> AsyncGenerator[tuple[grpc.aio.Server, int], None]:
    servicer = ChartServiceServicer()
    server = grpc.aio.server()
    chart_pb2_grpc.add_ChartServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port
    await server.stop(grace=0)


def test_candlestick_returns_nonempty_ansi() -> None:
    result = render_candlestick(DATES, OPEN, CLOSE, HIGH, LOW, WIDTH, HEIGHT, "AAPL")
    assert isinstance(result, str)
    assert len(result) > 0


def test_candlestick_contains_ansi_escape_codes() -> None:
    result = render_candlestick(DATES, OPEN, CLOSE, HIGH, LOW, WIDTH, HEIGHT, "AAPL")
    assert "\x1b[" in result, "Expected ANSI escape sequences in output"


def test_candlestick_output_under_50kb() -> None:
    result = render_candlestick(DATES, OPEN, CLOSE, HIGH, LOW, WIDTH, HEIGHT, "AAPL")
    assert len(result.encode("utf-8")) < 51200, (
        f"Output size {len(result.encode('utf-8'))} exceeds 50KB limit"
    )


def test_candlestick_respects_explicit_dimensions() -> None:
    result = render_candlestick(DATES, OPEN, CLOSE, HIGH, LOW, WIDTH, HEIGHT, "AAPL")
    line_count = result.count("\n")
    # plotext adds +1 for x-axis; tolerance for axis decorations
    assert HEIGHT - 2 <= line_count <= HEIGHT + 5, (
        f"Expected ~{HEIGHT} lines, got {line_count}"
    )


def test_line_chart_returns_ansi_string() -> None:
    labels = ["Jan", "Feb", "Mar", "Apr", "May"]
    values = [10.0, 25.0, 18.0, 30.0, 22.0]
    result = render_line_chart(labels, values, WIDTH, HEIGHT, "Revenue", "green")
    assert isinstance(result, str)
    assert len(result) > 0
    assert "\x1b[" in result


def test_subplot_contains_both_panels() -> None:
    candle_data = {
        "dates": DATES,
        "open": OPEN,
        "close": CLOSE,
        "high": HIGH,
        "low": LOW,
    }
    result = render_subplot(candle_data, VOLUME, WIDTH, HEIGHT * 2)
    assert isinstance(result, str)
    assert len(result) > 0
    assert result.count("\n") > HEIGHT


@pytest.mark.asyncio
async def test_grpc_render_candlestick(
    chart_server: tuple[grpc.aio.Server, int],
) -> None:
    _server, port = chart_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = chart_pb2_grpc.ChartServiceStub(channel)
        resp = await stub.RenderCandlestick(
            chart_pb2.RenderCandlestickRequest(
                dates=DATES,
                open=OPEN,
                close=CLOSE,
                high=HIGH,
                low=LOW,
                width=WIDTH,
                height=HEIGHT,
                title="AAPL Candlestick",
            )
        )
        assert len(resp.ansi_chart) > 0
        assert "\x1b[" in resp.ansi_chart


@pytest.mark.asyncio
async def test_grpc_render_line_chart(
    chart_server: tuple[grpc.aio.Server, int],
) -> None:
    _server, port = chart_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = chart_pb2_grpc.ChartServiceStub(channel)
        resp = await stub.RenderLineChart(
            chart_pb2.RenderLineChartRequest(
                labels=["Jan", "Feb", "Mar"],
                values=[10.0, 20.0, 15.0],
                width=WIDTH,
                height=HEIGHT,
                title="Test Line",
                color="blue",
            )
        )
        assert len(resp.ansi_chart) > 0


@pytest.mark.asyncio
async def test_grpc_empty_data_returns_empty_chart(
    chart_server: tuple[grpc.aio.Server, int],
) -> None:
    _server, port = chart_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = chart_pb2_grpc.ChartServiceStub(channel)
        resp = await stub.RenderCandlestick(
            chart_pb2.RenderCandlestickRequest(
                dates=[],
                open=[],
                close=[],
                high=[],
                low=[],
                width=WIDTH,
                height=HEIGHT,
                title="Empty",
            )
        )
        assert isinstance(resp.ansi_chart, str)
