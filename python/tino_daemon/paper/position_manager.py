"""PositionManager — virtual position and balance tracking for paper trading."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from tino_daemon.paper.orderbook_sim import OrderSide, PaperOrder

logger = logging.getLogger(__name__)

# Default initial balance in USDT
DEFAULT_INITIAL_BALANCE = 100_000.0


@dataclass
class PaperPosition:
    """A simulated position in the paper trading engine."""

    instrument: str
    side: str  # "LONG" or "SHORT"
    quantity: float
    avg_price: float
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    total_fees: float = 0.0
    opened_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "instrument": self.instrument,
            "side": self.side,
            "quantity": self.quantity,
            "avg_price": self.avg_price,
            "unrealized_pnl": self.unrealized_pnl,
            "realized_pnl": self.realized_pnl,
            "total_fees": self.total_fees,
            "opened_at": self.opened_at,
            "updated_at": self.updated_at,
        }


@dataclass
class PaperBalance:
    """Virtual balance tracking."""

    total: float = DEFAULT_INITIAL_BALANCE
    available: float = DEFAULT_INITIAL_BALANCE
    locked: float = 0.0
    realized_pnl: float = 0.0
    total_fees: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "total": self.total,
            "available": self.available,
            "locked": self.locked,
            "realized_pnl": self.realized_pnl,
            "total_fees": self.total_fees,
        }


class PositionManager:
    """Manages virtual positions, balance, and PnL for paper trading.

    Supports both LONG and SHORT positions per instrument.
    Tracks average entry price, realized/unrealized PnL, and fees.
    """

    def __init__(self, initial_balance: float = DEFAULT_INITIAL_BALANCE) -> None:
        self._positions: dict[str, PaperPosition] = {}
        self._balance = PaperBalance(
            total=initial_balance,
            available=initial_balance,
        )
        self._closed_positions: list[PaperPosition] = []

    @property
    def balance(self) -> PaperBalance:
        return self._balance

    @property
    def positions(self) -> dict[str, PaperPosition]:
        return dict(self._positions)

    @property
    def open_positions(self) -> list[PaperPosition]:
        return [p for p in self._positions.values() if p.quantity > 0]

    def apply_fill(self, order: PaperOrder) -> None:
        """Update positions and balance after an order fill."""
        instrument = order.instrument
        now = datetime.now(timezone.utc).isoformat()

        # Deduct fee from available balance
        self._balance.available -= order.fee
        self._balance.total -= order.fee
        self._balance.total_fees += order.fee

        pos = self._positions.get(instrument)

        if pos is None:
            # Open new position
            side = "LONG" if order.side == OrderSide.BUY else "SHORT"
            self._positions[instrument] = PaperPosition(
                instrument=instrument,
                side=side,
                quantity=order.filled_quantity,
                avg_price=order.filled_price,
                total_fees=order.fee,
                opened_at=now,
                updated_at=now,
            )
            logger.info(
                "Paper: opened %s %s %.4f @ %.6f",
                side,
                instrument,
                order.filled_quantity,
                order.filled_price,
            )
            return

        # Existing position logic
        is_same_direction = (
            (pos.side == "LONG" and order.side == OrderSide.BUY)
            or (pos.side == "SHORT" and order.side == OrderSide.SELL)
        )

        if is_same_direction:
            # Increase position — average the entry price
            total_cost = pos.avg_price * pos.quantity + order.filled_price * order.filled_quantity
            pos.quantity += order.filled_quantity
            pos.avg_price = total_cost / pos.quantity if pos.quantity > 0 else 0
            pos.total_fees += order.fee
            pos.updated_at = now
            logger.info(
                "Paper: increased %s %s to %.4f @ avg %.6f",
                pos.side,
                instrument,
                pos.quantity,
                pos.avg_price,
            )
        else:
            # Reduce or flip position
            pos.total_fees += order.fee
            close_qty = min(order.filled_quantity, pos.quantity)
            remaining_qty = order.filled_quantity - close_qty

            # Calculate realized PnL for the closed portion
            if pos.side == "LONG":
                rpnl = (order.filled_price - pos.avg_price) * close_qty
            else:
                rpnl = (pos.avg_price - order.filled_price) * close_qty

            pos.realized_pnl += rpnl
            self._balance.realized_pnl += rpnl
            self._balance.total += rpnl
            self._balance.available += rpnl
            pos.quantity -= close_qty
            pos.updated_at = now

            logger.info(
                "Paper: reduced %s %s by %.4f, realized PnL=%.4f",
                pos.side,
                instrument,
                close_qty,
                rpnl,
            )

            if pos.quantity <= 1e-12:
                # Position fully closed
                self._closed_positions.append(pos)
                del self._positions[instrument]

                if remaining_qty > 1e-12:
                    # Flip: open opposite position
                    new_side = "LONG" if order.side == OrderSide.BUY else "SHORT"
                    self._positions[instrument] = PaperPosition(
                        instrument=instrument,
                        side=new_side,
                        quantity=remaining_qty,
                        avg_price=order.filled_price,
                        opened_at=now,
                        updated_at=now,
                    )
                    logger.info(
                        "Paper: flipped to %s %s %.4f @ %.6f",
                        new_side,
                        instrument,
                        remaining_qty,
                        order.filled_price,
                    )

    def update_unrealized_pnl(self, instrument: str, current_price: float) -> float:
        """Update unrealized PnL for an instrument based on current price.

        Returns the unrealized PnL value.
        """
        pos = self._positions.get(instrument)
        if pos is None or pos.quantity <= 0:
            return 0.0

        if pos.side == "LONG":
            upnl = (current_price - pos.avg_price) * pos.quantity
        else:
            upnl = (pos.avg_price - current_price) * pos.quantity

        pos.unrealized_pnl = upnl
        return upnl

    def apply_funding(self, instrument: str, funding_rate: float) -> float:
        """Apply funding rate settlement to a position.

        For LONG positions: pay funding_rate * notional if rate > 0
        For SHORT positions: receive funding_rate * notional if rate > 0
        Returns the funding payment (negative = paid, positive = received).
        """
        pos = self._positions.get(instrument)
        if pos is None or pos.quantity <= 0:
            return 0.0

        notional = pos.avg_price * pos.quantity

        if pos.side == "LONG":
            # Longs pay when funding rate is positive
            payment = -funding_rate * notional
        else:
            # Shorts receive when funding rate is positive
            payment = funding_rate * notional

        pos.realized_pnl += payment
        self._balance.realized_pnl += payment
        self._balance.total += payment
        self._balance.available += payment

        logger.info(
            "Paper funding: %s %s rate=%.6f notional=%.2f payment=%.4f",
            pos.side,
            instrument,
            funding_rate,
            notional,
            payment,
        )
        return payment

    def get_total_equity(self) -> float:
        """Calculate total equity = balance + sum of unrealized PnL."""
        total_upnl = sum(p.unrealized_pnl for p in self._positions.values())
        return self._balance.total + total_upnl

    def get_account_summary(self) -> dict[str, Any]:
        """Return account summary for gRPC queries."""
        positions = self.open_positions
        total_value = sum(abs(p.quantity * p.avg_price) for p in positions)
        total_upnl = sum(p.unrealized_pnl for p in positions)
        return {
            "total_position_value": total_value,
            "daily_pnl": self._balance.realized_pnl + total_upnl,
            "margin_used": total_value * 0.1,  # Simplified 10x leverage margin
            "available_balance": self._balance.available,
            "open_position_count": len(positions),
            "total_equity": self.get_total_equity(),
        }

    def trim_history(self, max_closed: int = 1000) -> None:
        """Trim closed position history to prevent unbounded memory growth."""
        if len(self._closed_positions) > max_closed:
            self._closed_positions = self._closed_positions[-max_closed:]
