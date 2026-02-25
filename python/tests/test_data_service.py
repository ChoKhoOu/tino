"""Tests for DataService gRPC implementation."""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, patch

import grpc
import pytest
import pytest_asyncio

from tino_daemon.exchanges.base_connector import Kline, Ticker
from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.services.data import DataServiceServicer


@pytest.fixture
def catalog_path(tmp_path: Path) -> str:
    return str(tmp_path / "test_catalog")


@pytest.fixture
def catalog(catalog_path: str) -> DataCatalogWrapper:
    return DataCatalogWrapper(catalog_path=catalog_path)


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    csv_content = """date,open,high,low,close,volume
2024-01-02,100.0,105.0,99.0,104.0,1000000
2024-01-03,104.0,106.0,103.0,105.5,1200000
2024-01-04,105.5,108.0,104.0,107.0,1100000
"""
    csv_file = tmp_path / "test_ohlcv.csv"
    csv_file.write_text(csv_content)
    return csv_file


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


BAR_TYPE = "AAPL.XNAS-1-DAY-LAST-EXTERNAL"


class FakeContext:
    """Minimal gRPC context mock."""

    def __init__(self) -> None:
        self._code = grpc.StatusCode.OK
        self._details = ""

    def set_code(self, code: grpc.StatusCode) -> None:
        self._code = code

    def set_details(self, details: str) -> None:
        self._details = details


@pytest.mark.asyncio
async def test_list_catalog_empty(data_server):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)
        resp = await stub.ListCatalog(data_pb2.ListCatalogRequest())
        assert len(resp.entries) == 0


@pytest.mark.asyncio
async def test_ingest_csv_data(data_server, sample_csv: Path):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        request = data_pb2.IngestDataRequest(
            source="csv",
            instrument=str(sample_csv),
            bar_type=BAR_TYPE,
            start_date="2024-01-02",
            end_date="2024-01-04",
        )

        events = []
        async for response in stub.IngestData(request):
            events.append(response)

        assert len(events) >= 2

        completed_events = [
            e
            for e in events
            if e.type == data_pb2.IngestDataResponse.EVENT_TYPE_COMPLETED
        ]
        assert len(completed_events) == 1
        assert completed_events[0].rows_ingested == 3
        assert completed_events[0].progress_pct == 100.0


@pytest.mark.asyncio
async def test_ingest_then_list(data_server, sample_csv: Path):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        request = data_pb2.IngestDataRequest(
            source="csv",
            instrument=str(sample_csv),
            bar_type=BAR_TYPE,
        )
        async for _ in stub.IngestData(request):
            pass

        resp = await stub.ListCatalog(data_pb2.ListCatalogRequest())
        assert len(resp.entries) >= 1

        entry = resp.entries[0]
        assert entry.row_count == 3
        assert entry.start_date == "2024-01-02"
        assert entry.end_date == "2024-01-04"


@pytest.mark.asyncio
async def test_ingest_invalid_source(data_server):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        request = data_pb2.IngestDataRequest(
            source="nonexistent_source",
            instrument="AAPL.XNAS",
            bar_type=BAR_TYPE,
        )

        events = []
        async for response in stub.IngestData(request):
            events.append(response)

        error_events = [
            e for e in events if e.type == data_pb2.IngestDataResponse.EVENT_TYPE_ERROR
        ]
        assert len(error_events) >= 1


@pytest.mark.asyncio
async def test_ingest_csv_file_not_found(data_server):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        request = data_pb2.IngestDataRequest(
            source="csv",
            instrument="/nonexistent/file.csv",
            bar_type=BAR_TYPE,
        )

        events = []
        async for response in stub.IngestData(request):
            events.append(response)

        error_events = [
            e for e in events if e.type == data_pb2.IngestDataResponse.EVENT_TYPE_ERROR
        ]
        assert len(error_events) >= 1
        assert "not found" in error_events[0].message.lower()


@pytest.mark.asyncio
async def test_delete_catalog_no_data(data_server):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)
        resp = await stub.DeleteCatalog(
            data_pb2.DeleteCatalogRequest(
                instrument="AAPL.XNAS",
                bar_type=BAR_TYPE,
            )
        )
        assert resp.success is False


@pytest.mark.asyncio
async def test_ingest_progress_events(data_server, sample_csv: Path):
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        request = data_pb2.IngestDataRequest(
            source="csv",
            instrument=str(sample_csv),
            bar_type=BAR_TYPE,
        )

        progress_events = []
        async for response in stub.IngestData(request):
            if response.type == data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS:
                progress_events.append(response)

        assert len(progress_events) >= 3
        pcts = [e.progress_pct for e in progress_events]
        assert pcts == sorted(pcts)


@pytest.mark.asyncio
async def test_delete_catalog_after_ingest(data_server, sample_csv: Path):
    """Ingest data then delete it — verifies catalog cache management."""
    server, port = data_server
    async with grpc.aio.insecure_channel(f"localhost:{port}") as channel:
        stub = data_pb2_grpc.DataServiceStub(channel)

        # Ingest first
        request = data_pb2.IngestDataRequest(
            source="csv",
            instrument=str(sample_csv),
            bar_type=BAR_TYPE,
        )
        async for _ in stub.IngestData(request):
            pass

        # Verify data exists
        catalog_resp = await stub.ListCatalog(data_pb2.ListCatalogRequest())
        assert len(catalog_resp.entries) >= 1

        # Delete
        del_resp = await stub.DeleteCatalog(
            data_pb2.DeleteCatalogRequest(
                instrument=catalog_resp.entries[0].instrument,
                bar_type=BAR_TYPE,
            )
        )
        assert del_resp.success is True

        # Verify deleted
        after_resp = await stub.ListCatalog(data_pb2.ListCatalogRequest())
        remaining = [e for e in after_resp.entries if e.bar_type == BAR_TYPE]
        assert len(remaining) == 0


@pytest.mark.asyncio
async def test_get_market_quote_success(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    mock_connector = AsyncMock()
    mock_connector.get_ticker = AsyncMock(
        return_value=Ticker(
            symbol="BTCUSDT",
            last_price=50000.0,
            bid_price=49999.0,
            ask_price=50001.0,
            volume_24h=12345.0,
            high_24h=51000.0,
            low_24h=49000.0,
            timestamp="1700000000000",
        )
    )

    with patch(
        "tino_daemon.services.data.get_connector",
        return_value=mock_connector,
    ):
        resp = await servicer.GetMarketQuote(
            data_pb2.GetMarketQuoteRequest(exchange="binance", symbol="BTCUSDT"),
            ctx,
        )

    assert resp.quote.symbol == "BTCUSDT"
    assert resp.quote.last_price == 50000.0
    assert ctx._code == grpc.StatusCode.OK


@pytest.mark.asyncio
async def test_get_market_quote_invalid_exchange(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    with patch(
        "tino_daemon.services.data.get_connector",
        side_effect=ValueError("Unsupported exchange: unknown"),
    ):
        resp = await servicer.GetMarketQuote(
            data_pb2.GetMarketQuoteRequest(exchange="unknown", symbol="BTCUSDT"),
            ctx,
        )

    assert resp.quote.symbol == ""
    assert ctx._code == grpc.StatusCode.INVALID_ARGUMENT


@pytest.mark.asyncio
async def test_get_market_klines_success(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    mock_connector = AsyncMock()
    mock_connector.get_klines = AsyncMock(
        return_value=[
            Kline(
                open_time=1700000000000,
                open=50000.0,
                high=51000.0,
                low=49000.0,
                close=50500.0,
                volume=100.0,
                close_time=1700003600000,
            ),
        ]
    )

    with patch(
        "tino_daemon.services.data.get_connector",
        return_value=mock_connector,
    ):
        resp = await servicer.GetMarketKlines(
            data_pb2.GetMarketKlinesRequest(
                exchange="binance",
                symbol="BTCUSDT",
                interval="1h",
                limit=1,
            ),
            ctx,
        )

    assert len(resp.klines) == 1
    assert resp.klines[0].close == 50500.0
    assert ctx._code == grpc.StatusCode.OK


@pytest.mark.asyncio
async def test_get_market_klines_invalid_limit(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    resp = await servicer.GetMarketKlines(
        data_pb2.GetMarketKlinesRequest(
            exchange="binance",
            symbol="BTCUSDT",
            interval="1h",
            limit=-1,
        ),
        ctx,
    )

    assert len(resp.klines) == 0
    assert ctx._code == grpc.StatusCode.INVALID_ARGUMENT


@pytest.mark.asyncio
async def test_get_market_overview_success(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    mock_connector = AsyncMock()
    mock_connector.get_ticker = AsyncMock(
        side_effect=[
            Ticker(
                symbol="BTCUSDT",
                last_price=50000.0,
                bid_price=49999.0,
                ask_price=50001.0,
                volume_24h=12345.0,
                high_24h=51000.0,
                low_24h=49000.0,
                timestamp="1700000000000",
            ),
            Ticker(
                symbol="ETHUSDT",
                last_price=3000.0,
                bid_price=2999.0,
                ask_price=3001.0,
                volume_24h=54321.0,
                high_24h=3200.0,
                low_24h=2800.0,
                timestamp="1700000000000",
            ),
        ]
    )

    with patch(
        "tino_daemon.services.data.get_connector",
        return_value=mock_connector,
    ):
        resp = await servicer.GetMarketOverview(
            data_pb2.GetMarketOverviewRequest(
                exchange="binance",
                symbols=["BTCUSDT", "ETHUSDT"],
            ),
            ctx,
        )

    assert len(resp.quotes) == 2
    assert resp.quotes[0].symbol == "BTCUSDT"
    assert resp.quotes[1].symbol == "ETHUSDT"
    assert ctx._code == grpc.StatusCode.OK


@pytest.mark.asyncio
async def test_list_supported_exchanges_success(catalog: DataCatalogWrapper):
    servicer = DataServiceServicer(catalog=catalog)
    ctx = FakeContext()

    with patch(
        "tino_daemon.services.data.list_exchanges",
        return_value=["binance", "bybit", "okx"],
    ):
        resp = await servicer.ListSupportedExchanges(
            data_pb2.ListSupportedExchangesRequest(),
            ctx,
        )

    assert resp.exchanges == ["binance", "bybit", "okx"]
    assert ctx._code == grpc.StatusCode.OK
