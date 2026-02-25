"""DataService — ETL pipeline for market data ingestion and catalog management.

Inherits from the proto-generated DataServiceServicer base class and implements:
  - IngestData: server-streaming RPC for data ingestion pipeline
  - ListCatalog: list available instruments and date ranges
  - DeleteCatalog: remove specific data from catalog
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

import grpc

from tino_daemon.exchanges import get_connector, list_exchanges
from tino_daemon.nautilus.catalog import DataCatalogWrapper
from tino_daemon.proto.tino.data.v1 import data_pb2, data_pb2_grpc
from tino_daemon.wranglers.base import BaseWrangler
from tino_daemon.wranglers.binance_wrangler import BinanceWrangler
from tino_daemon.wranglers.csv_wrangler import CsvWrangler

logger = logging.getLogger(__name__)

_WRANGLERS: dict[str, BaseWrangler] = {}


def _get_wrangler(source_type: str) -> BaseWrangler:
    """Get or create a wrangler for the given source type."""
    if source_type not in _WRANGLERS:
        if source_type == "csv":
            _WRANGLERS[source_type] = CsvWrangler()
        elif source_type == "binance":
            _WRANGLERS[source_type] = BinanceWrangler()
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
    return _WRANGLERS[source_type]


class DataServiceServicer(data_pb2_grpc.DataServiceServicer):
    """gRPC DataService implementation using proto-generated servicer base.

    Manages data ingestion pipeline: download → transform → catalog write.
    """

    def __init__(self, catalog: DataCatalogWrapper) -> None:
        self._catalog = catalog

    @staticmethod
    def _set_error(
        context: grpc.aio.ServicerContext,
        code: grpc.StatusCode,
        details: str,
    ) -> None:
        context.set_code(code)
        context.set_details(details)

    @staticmethod
    def _to_market_quote(exchange: str, ticker: object) -> data_pb2.MarketQuote:
        return data_pb2.MarketQuote(
            exchange=exchange,
            symbol=getattr(ticker, "symbol"),
            last_price=getattr(ticker, "last_price"),
            bid_price=getattr(ticker, "bid_price"),
            ask_price=getattr(ticker, "ask_price"),
            volume_24h=getattr(ticker, "volume_24h"),
            high_24h=getattr(ticker, "high_24h"),
            low_24h=getattr(ticker, "low_24h"),
            timestamp=getattr(ticker, "timestamp"),
        )

    async def IngestData(
        self,
        request: data_pb2.IngestDataRequest,
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[data_pb2.IngestDataResponse]:
        """Ingest data from a source into the ParquetDataCatalog.

        Server-streaming RPC that yields progress events:
          1. PROGRESS: downloading / transforming / writing
          2. COMPLETED: final status with row count
          3. ERROR: if anything fails
        """
        source = request.source
        instrument = request.instrument
        bar_type = request.bar_type

        logger.info(
            "IngestData: source=%s instrument=%s bar_type=%s range=%s..%s",
            source,
            instrument,
            bar_type,
            request.start_date,
            request.end_date,
        )

        try:
            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS,
                message=f"Initializing {source} wrangler",
                progress_pct=0.0,
            )

            wrangler = _get_wrangler(source)

            if source == "binance":
                fetch_msg = f"Fetching kline data from Binance for {instrument}"
            else:
                fetch_msg = f"Transforming data for {instrument}"

            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS,
                message=fetch_msg,
                progress_pct=30.0,
            )

            if source == "csv":
                data_input = instrument
            elif source == "binance":
                data_input = {
                    "start_date": request.start_date,
                    "end_date": request.end_date,
                }
            else:
                data_input = instrument

            bars = wrangler.wrangle(
                data=data_input,
                instrument=instrument,
                bar_type=bar_type,
            )

            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS,
                message=f"Transformed {len(bars)} bars",
                progress_pct=60.0,
            )

            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_PROGRESS,
                message="Writing to ParquetDataCatalog",
                progress_pct=80.0,
            )

            row_count = self._catalog.write_data(bars)

            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_COMPLETED,
                message=f"Ingested {row_count} bars for {bar_type}",
                progress_pct=100.0,
                rows_ingested=row_count,
            )

        except FileNotFoundError as exc:
            logger.error("IngestData file not found: %s", exc)
            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_ERROR,
                message=f"File not found: {exc}",
            )
        except ValueError as exc:
            logger.error("IngestData validation error: %s", exc)
            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_ERROR,
                message=f"Validation error: {exc}",
            )
        except Exception as exc:
            logger.exception("IngestData unexpected error")
            yield data_pb2.IngestDataResponse(
                type=data_pb2.IngestDataResponse.EVENT_TYPE_ERROR,
                message=f"Internal error: {exc}",
            )

    async def ListCatalog(
        self,
        request: data_pb2.ListCatalogRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.ListCatalogResponse:
        """List all available data in the catalog."""
        logger.info("ListCatalog requested")

        entries = self._catalog.list_data()

        proto_entries = [
            data_pb2.CatalogEntry(
                instrument=e.instrument,
                bar_type=e.bar_type,
                start_date=e.start_date,
                end_date=e.end_date,
                row_count=e.row_count,
            )
            for e in entries
        ]

        return data_pb2.ListCatalogResponse(entries=proto_entries)

    async def DeleteCatalog(
        self,
        request: data_pb2.DeleteCatalogRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.DeleteCatalogResponse:
        """Delete data for a specific instrument from the catalog."""
        instrument = request.instrument
        bar_type = request.bar_type or None

        logger.info("DeleteCatalog: instrument=%s bar_type=%s", instrument, bar_type)

        success = self._catalog.delete_data(instrument, bar_type)

        if not success:
            logger.warning("No data found to delete for %s", instrument)

        return data_pb2.DeleteCatalogResponse(success=success)

    async def GetMarketQuote(
        self,
        request: data_pb2.GetMarketQuoteRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.GetMarketQuoteResponse:
        exchange = request.exchange.strip().lower()
        symbol = request.symbol.strip().upper()

        if not exchange or not symbol:
            self._set_error(
                context,
                grpc.StatusCode.INVALID_ARGUMENT,
                "exchange and symbol are required",
            )
            return data_pb2.GetMarketQuoteResponse()

        try:
            connector = get_connector(exchange)
            ticker = await connector.get_ticker(symbol)
            return data_pb2.GetMarketQuoteResponse(
                quote=self._to_market_quote(exchange, ticker)
            )
        except ValueError as exc:
            logger.error("GetMarketQuote validation error: %s", exc)
            self._set_error(context, grpc.StatusCode.INVALID_ARGUMENT, str(exc))
            return data_pb2.GetMarketQuoteResponse()
        except NotImplementedError as exc:
            logger.error("GetMarketQuote not implemented: %s", exc)
            self._set_error(context, grpc.StatusCode.UNIMPLEMENTED, str(exc))
            return data_pb2.GetMarketQuoteResponse()
        except Exception as exc:
            logger.exception("GetMarketQuote failed")
            self._set_error(context, grpc.StatusCode.INTERNAL, str(exc))
            return data_pb2.GetMarketQuoteResponse()

    async def GetMarketKlines(
        self,
        request: data_pb2.GetMarketKlinesRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.GetMarketKlinesResponse:
        exchange = request.exchange.strip().lower()
        symbol = request.symbol.strip().upper()
        interval = request.interval.strip() or "1h"
        limit = request.limit or 100

        if not exchange or not symbol:
            self._set_error(
                context,
                grpc.StatusCode.INVALID_ARGUMENT,
                "exchange and symbol are required",
            )
            return data_pb2.GetMarketKlinesResponse()
        if limit <= 0:
            self._set_error(
                context,
                grpc.StatusCode.INVALID_ARGUMENT,
                "limit must be greater than 0",
            )
            return data_pb2.GetMarketKlinesResponse()

        try:
            connector = get_connector(exchange)
            klines = await connector.get_klines(
                symbol=symbol,
                interval=interval,
                limit=limit,
            )
            return data_pb2.GetMarketKlinesResponse(
                klines=[
                    data_pb2.MarketKline(
                        open_time=k.open_time,
                        open=k.open,
                        high=k.high,
                        low=k.low,
                        close=k.close,
                        volume=k.volume,
                        close_time=k.close_time,
                    )
                    for k in klines
                ]
            )
        except ValueError as exc:
            logger.error("GetMarketKlines validation error: %s", exc)
            self._set_error(context, grpc.StatusCode.INVALID_ARGUMENT, str(exc))
            return data_pb2.GetMarketKlinesResponse()
        except NotImplementedError as exc:
            logger.error("GetMarketKlines not implemented: %s", exc)
            self._set_error(context, grpc.StatusCode.UNIMPLEMENTED, str(exc))
            return data_pb2.GetMarketKlinesResponse()
        except Exception as exc:
            logger.exception("GetMarketKlines failed")
            self._set_error(context, grpc.StatusCode.INTERNAL, str(exc))
            return data_pb2.GetMarketKlinesResponse()

    async def GetMarketOverview(
        self,
        request: data_pb2.GetMarketOverviewRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.GetMarketOverviewResponse:
        exchange = request.exchange.strip().lower()
        symbols = [s.strip().upper() for s in request.symbols if s.strip()]

        if not exchange:
            self._set_error(
                context,
                grpc.StatusCode.INVALID_ARGUMENT,
                "exchange is required",
            )
            return data_pb2.GetMarketOverviewResponse()
        if not symbols:
            self._set_error(
                context,
                grpc.StatusCode.INVALID_ARGUMENT,
                "at least one symbol is required",
            )
            return data_pb2.GetMarketOverviewResponse()

        try:
            connector = get_connector(exchange)
            tickers = await asyncio.gather(
                *(connector.get_ticker(symbol) for symbol in symbols)
            )
            return data_pb2.GetMarketOverviewResponse(
                quotes=[self._to_market_quote(exchange, ticker) for ticker in tickers]
            )
        except ValueError as exc:
            logger.error("GetMarketOverview validation error: %s", exc)
            self._set_error(context, grpc.StatusCode.INVALID_ARGUMENT, str(exc))
            return data_pb2.GetMarketOverviewResponse()
        except NotImplementedError as exc:
            logger.error("GetMarketOverview not implemented: %s", exc)
            self._set_error(context, grpc.StatusCode.UNIMPLEMENTED, str(exc))
            return data_pb2.GetMarketOverviewResponse()
        except Exception as exc:
            logger.exception("GetMarketOverview failed")
            self._set_error(context, grpc.StatusCode.INTERNAL, str(exc))
            return data_pb2.GetMarketOverviewResponse()

    async def ListSupportedExchanges(
        self,
        request: data_pb2.ListSupportedExchangesRequest,
        context: grpc.aio.ServicerContext,
    ) -> data_pb2.ListSupportedExchangesResponse:
        _ = request
        try:
            return data_pb2.ListSupportedExchangesResponse(
                exchanges=list_exchanges()
            )
        except Exception as exc:
            logger.exception("ListSupportedExchanges failed")
            self._set_error(context, grpc.StatusCode.INTERNAL, str(exc))
            return data_pb2.ListSupportedExchangesResponse()
