# pyright: reportAttributeAccessIssue=false

from __future__ import annotations

from typing import Any

from tino_daemon.persistence.portfolio_db import PortfolioDB
from tino_daemon.proto.tino.portfolio.v1 import portfolio_pb2, portfolio_pb2_grpc


class PortfolioServiceServicer(portfolio_pb2_grpc.PortfolioServiceServicer):
    def __init__(self, db: PortfolioDB) -> None:
        self._db = db

    async def RecordTrade(self, request: Any, context: Any) -> Any:
        del context
        try:
            self._db.record_trade(
                trade_id=request.id,
                instrument=request.instrument,
                side=request.side,
                quantity=request.quantity,
                price=request.price,
                fee=request.fee,
                venue=request.venue,
                timestamp=request.timestamp,
                order_id=request.order_id,
                strategy=request.strategy,
            )
            return portfolio_pb2.RecordTradeResponse(success=True, trade_id=request.id)
        except Exception:
            return portfolio_pb2.RecordTradeResponse(success=False, trade_id="")

    async def GetPositions(self, request: Any, context: Any) -> Any:
        del context
        rows = self._db.get_positions(instrument=request.instrument)
        return portfolio_pb2.GetPositionsResponse(
            positions=[
                portfolio_pb2.PortfolioPosition(
                    instrument=str(r["instrument"]),
                    quantity=float(r["quantity"]),
                    avg_price=float(r["avg_price"]),
                    unrealized_pnl=float(r.get("unrealized_pnl", 0)),
                    realized_pnl=float(r.get("realized_pnl", 0)),
                    updated_at=str(r.get("updated_at", "")),
                )
                for r in rows
            ]
        )

    async def GetTrades(self, request: Any, context: Any) -> Any:
        del context
        rows = self._db.get_trades(
            instrument=request.instrument,
            start_date=request.start_date,
            end_date=request.end_date,
            limit=request.limit if request.limit > 0 else 100,
        )
        return portfolio_pb2.GetTradesResponse(
            trades=[
                portfolio_pb2.Trade(
                    id=str(r["id"]),
                    instrument=str(r["instrument"]),
                    side=str(r["side"]),
                    quantity=float(r["quantity"]),
                    price=float(r["price"]),
                    fee=float(r.get("fee", 0)),
                    venue=str(r["venue"]),
                    timestamp=str(r["timestamp"]),
                    order_id=str(r.get("order_id", "")),
                    strategy=str(r.get("strategy", "")),
                )
                for r in rows
            ]
        )

    async def GetPnLHistory(self, request: Any, context: Any) -> Any:
        del context
        rows = self._db.get_pnl_history(
            instrument=request.instrument,
            start_date=request.start_date,
            end_date=request.end_date,
        )
        return portfolio_pb2.GetPnLHistoryResponse(
            entries=[
                portfolio_pb2.DailyPnL(
                    date=str(r["date"]),
                    instrument=str(r.get("instrument", "")),
                    total_pnl=float(r["total_pnl"]),
                    realized_pnl=float(r["realized_pnl"]),
                    unrealized_pnl=float(r["unrealized_pnl"]),
                )
                for r in rows
            ]
        )

    async def GetSummary(self, request: Any, context: Any) -> Any:
        del request, context
        s = self._db.get_summary()
        return portfolio_pb2.GetSummaryResponse(
            total_trades=s["total_trades"],
            open_positions=s["open_positions"],
            total_realized_pnl=s["total_realized_pnl"],
            total_unrealized_pnl=s["total_unrealized_pnl"],
            total_fees=s["total_fees"],
        )
