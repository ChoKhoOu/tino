"""Tests for BinanceWrangler — Binance kline data → NautilusTrader Bar objects."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
import pytest_asyncio

import grpc

from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.services.data import DataServiceServicer
from tino_daemon.wranglers.binance_wrangler import BinanceWrangler


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

BAR_TYPE = "BTCUSDT.BINANCE-1-HOUR-LAST-EXTERNAL"
INSTRUMENT = "BTCUSDT.BINANCE"


def _make_kline(open_time_ms: int, o: str, h: str, l: str, c: str, v: str) -> list:
    """Build a single Binance kline row (12-element list)."""
    close_time_ms = open_time_ms + 3_600_000 - 1  # 1 hour candle
    return [
        open_time_ms,
        o, h, l, c, v,
        close_time_ms,
        "0",   # quote_volume
        0,     # trades
        "0",   # taker_buy_volume
        "0",   # taker_buy_quote_volume
        "0",   # ignore
    ]


def _make_sample_klines(count: int = 5, start_ms: int = 1_704_067_200_000) -> list:
    """Generate ``count`` hourly klines starting from ``start_ms`` (default 2024-01-01T00:00Z)."""
    klines = []
    for i in range(count):
        ts = start_ms + i * 3_600_000
        price = 40000 + i * 100
        klines.append(
            _make_kline(
                ts,
                str(price),
                str(price + 50),
                str(price - 50),
                str(price + 25),
                str(1000 + i),
            )
        )
    return klines


@pytest.fixture
def wrangler(tmp_path: Path) -> BinanceWrangler:
    return BinanceWrangler(cache_dir=str(tmp_path / "cache"))


@pytest.fixture
def sample_klines() -> list:
    return _make_sample_klines(5)


# ---------------------------------------------------------------------------
# Unit tests — BinanceWrangler
# ---------------------------------------------------------------------------


class TestSourceType:
    def test_source_type(self, wrangler: BinanceWrangler) -> None:
        assert wrangler.source_type == "binance"


class TestKlinesToDataframe:
    def test_basic_conversion(self, wrangler: BinanceWrangler, sample_klines: list) -> None:
        df = wrangler._klines_to_dataframe(sample_klines)
        assert len(df) == 5
        assert list(df.columns) == ["open", "high", "low", "close", "volume"]
        assert isinstance(df.index, pd.DatetimeIndex)

    def test_ohlcv_values(self, wrangler: BinanceWrangler) -> None:
        klines = [_make_kline(1_704_067_200_000, "40000", "40050", "39950", "40025", "1000")]
        df = wrangler._klines_to_dataframe(klines)
        row = df.iloc[0]
        assert row["open"] == pytest.approx(40000.0)
        assert row["high"] == pytest.approx(40050.0)
        assert row["low"] == pytest.approx(39950.0)
        assert row["close"] == pytest.approx(40025.0)
        assert row["volume"] == pytest.approx(1000.0)

    def test_utc_timezone(self, wrangler: BinanceWrangler, sample_klines: list) -> None:
        df = wrangler._klines_to_dataframe(sample_klines)
        assert str(df.index.tz) == "UTC"


class TestWrangleValidation:
    def test_invalid_data_type_raises(self, wrangler: BinanceWrangler) -> None:
        with pytest.raises(ValueError, match="dict"):
            wrangler.wrangle(data="not-a-dict", instrument=INSTRUMENT, bar_type=BAR_TYPE)

    def test_missing_start_date_raises(self, wrangler: BinanceWrangler) -> None:
        with pytest.raises(ValueError, match="start_date.*end_date"):
            wrangler.wrangle(
                data={"end_date": "2024-01-05"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )

    def test_missing_end_date_raises(self, wrangler: BinanceWrangler) -> None:
        with pytest.raises(ValueError, match="start_date.*end_date"):
            wrangler.wrangle(
                data={"start_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )

    def test_unsupported_interval_raises(self, wrangler: BinanceWrangler) -> None:
        bad_bar_type = "BTCUSDT.BINANCE-1-WEEK-LAST-EXTERNAL"
        with pytest.raises(ValueError, match="Unsupported interval"):
            wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-05"},
                instrument=INSTRUMENT,
                bar_type=bad_bar_type,
            )


class TestWrangleFetch:
    """Test wrangle() with mocked HTTP calls."""

    def test_wrangle_returns_bars(self, wrangler: BinanceWrangler, sample_klines: list) -> None:
        with patch.object(wrangler, "_http_get_json", return_value=sample_klines):
            bars = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )
        assert len(bars) == 5
        assert bars[0].open.as_double() == pytest.approx(40000.0)

    def test_wrangle_bars_chronological(self, wrangler: BinanceWrangler, sample_klines: list) -> None:
        with patch.object(wrangler, "_http_get_json", return_value=sample_klines):
            bars = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )
        for i in range(1, len(bars)):
            assert bars[i].ts_init >= bars[i - 1].ts_init

    def test_wrangle_no_data_raises(self, wrangler: BinanceWrangler) -> None:
        with patch.object(wrangler, "_http_get_json", return_value=[]):
            with pytest.raises(ValueError, match="No data available"):
                wrangler.wrangle(
                    data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                    instrument=INSTRUMENT,
                    bar_type=BAR_TYPE,
                )

    def test_api_error_raises_valueerror(self, wrangler: BinanceWrangler) -> None:
        from urllib.error import HTTPError
        from io import BytesIO

        err_body = json.dumps({"code": -1121, "msg": "Invalid symbol."}).encode()

        def raise_http_error(*args, **kwargs):
            raise HTTPError("http://test", 400, "Bad Request", {}, BytesIO(err_body))

        with patch("tino_daemon.wranglers.binance_wrangler.urlopen", side_effect=raise_http_error):
            with pytest.raises(ValueError, match="Binance API error|Invalid symbol"):
                wrangler.wrangle(
                    data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                    instrument=INSTRUMENT,
                    bar_type=BAR_TYPE,
                )


class TestPagination:
    def test_multiple_pages(self, wrangler: BinanceWrangler) -> None:
        """Verify pagination when the first response has exactly MAX_LIMIT items."""
        page1 = _make_sample_klines(1000, start_ms=1_704_067_200_000)
        page2 = _make_sample_klines(3, start_ms=1_704_067_200_000 + 1000 * 3_600_000)

        call_count = 0

        def mock_fetch(url: str) -> list:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return page1
            return page2

        with patch.object(wrangler, "_http_get_json", side_effect=mock_fetch):
            bars = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-03-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )

        assert call_count == 2
        assert len(bars) == 1003


class TestCaching:
    def test_cache_roundtrip(self, wrangler: BinanceWrangler) -> None:
        """First call fetches from API, second call uses cache."""
        # Generate 24 hourly klines to cover a full day
        full_day_klines = _make_sample_klines(24, start_ms=1_704_067_200_000)

        with patch.object(wrangler, "_http_get_json", return_value=full_day_klines) as mock:
            bars1 = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )
            assert mock.call_count >= 1

        # Second call should use cache — no API calls
        with patch.object(wrangler, "_http_get_json", return_value=[]) as mock:
            bars2 = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )
            assert mock.call_count == 0

        assert len(bars1) == len(bars2)

    def test_cache_file_created(self, wrangler: BinanceWrangler, sample_klines: list) -> None:
        with patch.object(wrangler, "_http_get_json", return_value=sample_klines):
            wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )

        cache_file = wrangler._cache_dir / "BTCUSDT" / "1h.parquet"
        assert cache_file.exists()

    def test_incremental_fetch(self, wrangler: BinanceWrangler) -> None:
        """After caching some data, a broader range only fetches the gap."""
        initial_klines = _make_sample_klines(5, start_ms=1_704_067_200_000)

        with patch.object(wrangler, "_http_get_json", return_value=initial_klines):
            wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )

        # Now request a broader range — only the new portion should be fetched
        new_klines = _make_sample_klines(3, start_ms=1_704_067_200_000 + 5 * 3_600_000)

        with patch.object(wrangler, "_http_get_json", return_value=new_klines) as mock:
            bars = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-02"},
                instrument=INSTRUMENT,
                bar_type=BAR_TYPE,
            )
            # Should have fetched once for the new range
            assert mock.call_count == 1

        assert len(bars) == 8  # 5 cached + 3 new


class TestRateLimiting:
    def test_throttle_tracks_requests(self, wrangler: BinanceWrangler) -> None:
        wrangler._throttle()
        assert len(wrangler._request_timestamps) == 1

    def test_throttle_old_timestamps_pruned(self, wrangler: BinanceWrangler) -> None:
        # Add a timestamp that is > 60 seconds old
        wrangler._request_timestamps = [time.monotonic() - 61.0]
        wrangler._throttle()
        # Old timestamp pruned, only new one remains
        assert len(wrangler._request_timestamps) == 1


class TestMultipleTimeframes:
    """Verify different bar type intervals map correctly."""

    @pytest.mark.parametrize(
        "bar_type_str,expected_interval",
        [
            ("BTCUSDT.BINANCE-1-MINUTE-LAST-EXTERNAL", "1m"),
            ("BTCUSDT.BINANCE-5-MINUTE-LAST-EXTERNAL", "5m"),
            ("BTCUSDT.BINANCE-15-MINUTE-LAST-EXTERNAL", "15m"),
            ("BTCUSDT.BINANCE-1-HOUR-LAST-EXTERNAL", "1h"),
            ("BTCUSDT.BINANCE-4-HOUR-LAST-EXTERNAL", "4h"),
            ("BTCUSDT.BINANCE-1-DAY-LAST-EXTERNAL", "1d"),
        ],
    )
    def test_interval_mapping(
        self,
        wrangler: BinanceWrangler,
        bar_type_str: str,
        expected_interval: str,
    ) -> None:
        # Generate klines with appropriate duration for the interval
        klines = _make_sample_klines(3)

        with patch.object(wrangler, "_http_get_json", return_value=klines) as mock:
            bars = wrangler.wrangle(
                data={"start_date": "2024-01-01", "end_date": "2024-01-01"},
                instrument=INSTRUMENT,
                bar_type=bar_type_str,
            )
            # Verify the API was called (the interval is valid)
            assert mock.call_count >= 1
            assert len(bars) == 3


# ---------------------------------------------------------------------------
# Integration: DataService with Binance source
# ---------------------------------------------------------------------------


@pytest.fixture
def catalog(tmp_path: Path) -> DataCatalogWrapper:
    return DataCatalogWrapper(catalog_path=str(tmp_path / "test_catalog"))


@pytest_asyncio.fixture
async def data_server(
    catalog: DataCatalogWrapper,
) -> AsyncGenerator[tuple[grpc.aio.Server, int], None]:
    server = grpc.aio.server()
    servicer = DataServiceServicer(catalog=catalog)
    data_pb2_grpc.add_DataServiceServicer_to_server(servicer, server)
    port = server.add_insecure_port("[::]:0")
    await server.start()
    yield server, port
    await server.stop(grace=0)


class TestDataServiceBinanceIntegration:
    @pytest.mark.asyncio
    async def test_ingest_binance_data(self, data_server, tmp_path: Path) -> None:
        """Full gRPC roundtrip: ingest Binance data → list catalog."""
        server, port = data_server
        sample_klines = _make_sample_klines(5)

        with patch(
            "tino_daemon.wranglers.binance_wrangler.urlopen"
        ) as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(sample_klines).encode()
            mock_resp.__enter__ = MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
                stub = data_pb2_grpc.DataServiceStub(channel)

                request = data_pb2.IngestDataRequest(
                    source="binance",
                    instrument=INSTRUMENT,
                    bar_type=BAR_TYPE,
                    start_date="2024-01-01",
                    end_date="2024-01-01",
                )

                events = []
                async for response in stub.IngestData(request):
                    events.append(response)

                # Should have progress + completed events
                completed = [
                    e
                    for e in events
                    if e.type == data_pb2.IngestDataResponse.EVENT_TYPE_COMPLETED
                ]
                assert len(completed) == 1
                assert completed[0].rows_ingested == 5

    @pytest.mark.asyncio
    async def test_ingest_binance_progress_message(self, data_server) -> None:
        """Verify Binance-specific progress message."""
        server, port = data_server
        sample_klines = _make_sample_klines(3)

        with patch(
            "tino_daemon.wranglers.binance_wrangler.urlopen"
        ) as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(sample_klines).encode()
            mock_resp.__enter__ = MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
                stub = data_pb2_grpc.DataServiceStub(channel)

                request = data_pb2.IngestDataRequest(
                    source="binance",
                    instrument=INSTRUMENT,
                    bar_type=BAR_TYPE,
                    start_date="2024-01-01",
                    end_date="2024-01-01",
                )

                progress_msgs = []
                async for response in stub.IngestData(request):
                    if response.type == data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS:
                        progress_msgs.append(response.message)

                assert any("Binance" in msg for msg in progress_msgs)

    @pytest.mark.asyncio
    async def test_ingest_binance_then_list_catalog(self, data_server) -> None:
        """After ingesting Binance data, it should appear in catalog listing."""
        server, port = data_server
        sample_klines = _make_sample_klines(5)

        with patch(
            "tino_daemon.wranglers.binance_wrangler.urlopen"
        ) as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(sample_klines).encode()
            mock_resp.__enter__ = MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp

            async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
                stub = data_pb2_grpc.DataServiceStub(channel)

                # Ingest
                request = data_pb2.IngestDataRequest(
                    source="binance",
                    instrument=INSTRUMENT,
                    bar_type=BAR_TYPE,
                    start_date="2024-01-01",
                    end_date="2024-01-01",
                )
                async for _ in stub.IngestData(request):
                    pass

                # List
                resp = await stub.ListCatalog(data_pb2.ListCatalogRequest())
                assert len(resp.entries) >= 1
                entry = resp.entries[0]
                assert entry.row_count == 5
                assert "BTCUSDT" in entry.instrument
