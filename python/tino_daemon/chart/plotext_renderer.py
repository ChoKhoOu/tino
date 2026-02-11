from __future__ import annotations

from datetime import datetime
from typing import Any

import plotext as plt

MAX_OUTPUT_BYTES = 51200


def _iso_to_plotext_date(iso_date: str) -> str:
    dt = datetime.strptime(iso_date, "%Y-%m-%d")
    return dt.strftime("%d/%m/%Y")


def _truncate(output: str) -> str:
    if len(output.encode("utf-8")) > MAX_OUTPUT_BYTES:
        encoded = output.encode("utf-8")[:MAX_OUTPUT_BYTES]
        return encoded.decode("utf-8", errors="ignore")
    return output


def render_candlestick(
    dates: list[str],
    open_: list[float],
    close: list[float],
    high: list[float],
    low: list[float],
    width: int,
    height: int,
    title: str,
) -> str:
    plt.clear_figure()
    plt.theme("clear")
    plt.date_form("d/m/Y")
    plt.plot_size(width, height)
    if title:
        plt.title(title)

    plotext_dates = [_iso_to_plotext_date(d) for d in dates]
    data = {"Open": open_, "Close": close, "High": high, "Low": low}
    plt.candlestick(plotext_dates, data)

    return _truncate(plt.build())


def render_line_chart(
    labels: list[str],
    values: list[float],
    width: int,
    height: int,
    title: str,
    color: str,
) -> str:
    plt.clear_figure()
    plt.theme("clear")
    plt.plot_size(width, height)
    if title:
        plt.title(title)

    plt.plot(values, label=title, color=color or "green")
    plt.xticks(list(range(len(labels))), labels)

    return _truncate(plt.build())


def render_subplot(
    candlestick_data: dict[str, Any],
    volume: list[float],
    width: int,
    height: int,
) -> str:
    plt.clear_figure()
    plt.theme("clear")
    plt.plot_size(width, height)
    plt.subplots(2, 1)

    plt.subplot(1, 1)
    plt.date_form("d/m/Y")
    dates = [_iso_to_plotext_date(d) for d in candlestick_data["dates"]]
    data = {
        "Open": candlestick_data["open"],
        "Close": candlestick_data["close"],
        "High": candlestick_data["high"],
        "Low": candlestick_data["low"],
    }
    plt.candlestick(dates, data)

    plt.subplot(2, 1)
    plt.bar(list(range(len(volume))), volume, color="blue")
    plt.title("Volume")

    return _truncate(plt.build())
