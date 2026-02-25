"""ExchangeService gRPC implementation — unified exchange adapter interface."""

# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

import logging
from typing import Any

import grpc

from tino_daemon.exchanges import get_connector
from tino_daemon.exchanges.base_connector import MarginType
from tino_daemon.proto.tino.exchange.v1 import exchange_pb2, exchange_pb2_grpc

logger = logging.getLogger(__name__)


class ExchangeServiceServicer(exchange_pb2_grpc.ExchangeServiceServicer):
    """gRPC ExchangeService that delegates to the appropriate exchange connector."""

    async def GetTicker(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            ticker = await connector.get_ticker(request.symbol)
            return exchange_pb2.GetTickerResponse(
                symbol=ticker.symbol,
                last_price=ticker.last_price,
                bid_price=ticker.bid_price,
                ask_price=ticker.ask_price,
                volume_24h=ticker.volume_24h,
                high_24h=ticker.high_24h,
                low_24h=ticker.low_24h,
                timestamp=ticker.timestamp,
            )
        except Exception as exc:
            logger.exception("GetTicker failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetTickerResponse()

    async def GetKlines(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            klines = await connector.get_klines(
                symbol=request.symbol,
                interval=request.interval or "1h",
                limit=request.limit or 100,
                start_time=request.start_time or None,
                end_time=request.end_time or None,
            )
            return exchange_pb2.GetKlinesResponse(
                klines=[
                    exchange_pb2.Kline(
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
        except Exception as exc:
            logger.exception("GetKlines failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetKlinesResponse()

    async def GetFundingRate(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            fr = await connector.get_funding_rate(request.symbol)
            return exchange_pb2.GetFundingRateResponse(
                symbol=fr.symbol,
                funding_rate=fr.funding_rate,
                next_funding_time=fr.next_funding_time,
                timestamp=fr.timestamp,
            )
        except Exception as exc:
            logger.exception("GetFundingRate failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetFundingRateResponse()

    async def GetOrderbook(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            ob = await connector.get_orderbook(
                symbol=request.symbol,
                limit=request.limit or 20,
            )
            return exchange_pb2.GetOrderbookResponse(
                bids=[
                    exchange_pb2.OrderbookLevel(price=b.price, quantity=b.quantity)
                    for b in ob.bids
                ],
                asks=[
                    exchange_pb2.OrderbookLevel(price=a.price, quantity=a.quantity)
                    for a in ob.asks
                ],
                timestamp=ob.timestamp,
            )
        except Exception as exc:
            logger.exception("GetOrderbook failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetOrderbookResponse()

    async def GetAccountBalance(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            balances = await connector.get_account_balance()
            return exchange_pb2.GetAccountBalanceResponse(
                balances=[
                    exchange_pb2.BalanceEntry(
                        asset=b.asset,
                        free=b.free,
                        locked=b.locked,
                        total=b.total,
                    )
                    for b in balances
                ]
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.GetAccountBalanceResponse()
        except Exception as exc:
            logger.exception("GetAccountBalance failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetAccountBalanceResponse()

    async def GetExchangePositions(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            positions = await connector.get_positions(
                symbol=request.symbol or None,
            )
            return exchange_pb2.GetExchangePositionsResponse(
                positions=[
                    exchange_pb2.ExchangePosition(
                        symbol=p.symbol,
                        side=p.side,
                        quantity=p.quantity,
                        entry_price=p.entry_price,
                        unrealized_pnl=p.unrealized_pnl,
                        leverage=p.leverage,
                        mark_price=p.mark_price,
                        liquidation_price=p.liquidation_price,
                        margin_type=p.margin_type.value,
                    )
                    for p in positions
                ]
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.GetExchangePositionsResponse()
        except Exception as exc:
            logger.exception("GetExchangePositions failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetExchangePositionsResponse()

    async def PlaceOrder(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            result = await connector.place_order(
                symbol=request.symbol,
                side=request.side,
                order_type=request.order_type,
                quantity=request.quantity,
                price=request.price if request.price else None,
            )
            return exchange_pb2.PlaceOrderResponse(
                order_id=result.order_id,
                success=result.success,
                message=result.message,
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.PlaceOrderResponse(success=False, message=str(exc))
        except Exception as exc:
            logger.exception("PlaceOrder failed")
            return exchange_pb2.PlaceOrderResponse(
                success=False, message=str(exc)
            )

    async def CancelExchangeOrder(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            result = await connector.cancel_order(
                symbol=request.symbol,
                order_id=request.order_id,
            )
            return exchange_pb2.CancelExchangeOrderResponse(
                success=result.success,
                message=result.message,
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.CancelExchangeOrderResponse(
                success=False, message=str(exc)
            )
        except Exception as exc:
            logger.exception("CancelExchangeOrder failed")
            return exchange_pb2.CancelExchangeOrderResponse(
                success=False, message=str(exc)
            )

    async def SetLeverage(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            success = await connector.set_leverage(request.symbol, request.leverage)
            return exchange_pb2.SetLeverageResponse(
                success=success,
                current_leverage=request.leverage if success else 0,
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.SetLeverageResponse(success=False)
        except Exception as exc:
            logger.exception("SetLeverage failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.SetLeverageResponse(success=False)

    async def SetMarginType(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            margin_type = (
                MarginType.ISOLATED
                if request.margin_type.lower() == "isolated"
                else MarginType.CROSS
            )
            success = await connector.set_margin_type(request.symbol, margin_type)
            return exchange_pb2.SetMarginTypeResponse(success=success)
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.SetMarginTypeResponse(success=False)
        except Exception as exc:
            logger.exception("SetMarginType failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.SetMarginTypeResponse(success=False)

    async def GetMarkPrice(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            info = await connector.get_mark_price(request.symbol)
            return exchange_pb2.GetMarkPriceResponse(
                mark_price=info.mark_price,
                index_price=info.index_price,
                timestamp=info.timestamp,
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.GetMarkPriceResponse()
        except Exception as exc:
            logger.exception("GetMarkPrice failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetMarkPriceResponse()

    async def GetFundingRateHistory(
        self,
        request: Any,
        context: grpc.aio.ServicerContext,
    ) -> Any:
        try:
            connector = get_connector(request.exchange)
            history = await connector.get_funding_rate_history(
                symbol=request.symbol,
                limit=request.limit or 100,
            )
            return exchange_pb2.GetFundingRateHistoryResponse(
                records=[
                    exchange_pb2.FundingRateRecord(
                        symbol=r.symbol,
                        funding_rate=r.funding_rate,
                        timestamp=r.timestamp,
                    )
                    for r in history
                ]
            )
        except NotImplementedError as exc:
            context.set_code(grpc.StatusCode.UNIMPLEMENTED)
            context.set_details(str(exc))
            return exchange_pb2.GetFundingRateHistoryResponse()
        except Exception as exc:
            logger.exception("GetFundingRateHistory failed")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(exc))
            return exchange_pb2.GetFundingRateHistoryResponse()
