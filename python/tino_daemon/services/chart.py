# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

from typing import Any

from tino_daemon.chart.plotext_renderer import (
    render_candlestick,
    render_line_chart,
    render_subplot,
)
from tino_daemon.proto.tino.chart.v1 import chart_pb2, chart_pb2_grpc


class ChartServiceServicer(chart_pb2_grpc.ChartServiceServicer):
    async def RenderCandlestick(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        try:
            ansi = render_candlestick(
                dates=list(request.dates),
                open_=list(request.open),
                close=list(request.close),
                high=list(request.high),
                low=list(request.low),
                width=request.width or 80,
                height=request.height or 20,
                title=request.title,
            )
        except Exception:
            ansi = ""
        return chart_pb2.RenderCandlestickResponse(ansi_chart=ansi)

    async def RenderLineChart(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        try:
            ansi = render_line_chart(
                labels=list(request.labels),
                values=list(request.values),
                width=request.width or 80,
                height=request.height or 20,
                title=request.title,
                color=request.color or "green",
            )
        except Exception:
            ansi = ""
        return chart_pb2.RenderLineChartResponse(ansi_chart=ansi)

    async def RenderSubplot(
        self,
        request: Any,
        context: Any,
    ) -> Any:
        try:
            candle_data = {
                "dates": list(request.dates),
                "open": list(request.open),
                "close": list(request.close),
                "high": list(request.high),
                "low": list(request.low),
            }
            ansi = render_subplot(
                candlestick_data=candle_data,
                volume=list(request.volume),
                width=request.width or 80,
                height=request.height or 40,
            )
        except Exception:
            ansi = ""
        return chart_pb2.RenderSubplotResponse(ansi_chart=ansi)
