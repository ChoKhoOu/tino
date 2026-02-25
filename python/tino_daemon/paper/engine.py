"""PaperTradingEngine — orchestrates simulated trading with real-time market data.

Runs an async event loop that:
1. Polls exchange connectors for real-time prices
2. Matches pending orders against current prices
3. Updates positions and PnL in real time
4. Settles funding rates every 8 hours
5. Monitors memory usage for leak detection
"""

from __future__ import annotations

import asyncio
import logging
import tracemalloc
from datetime import datetime, timezone
from typing import Any, Callable

from tino_daemon.paper.funding import FundingScheduler
from tino_daemon.paper.orderbook_sim import OrderbookSimulator, PaperOrder
from tino_daemon.paper.position_manager import PositionManager

logger = logging.getLogger(__name__)

# Price polling interval in seconds
DEFAULT_POLL_INTERVAL = 2.0
# Memory trim interval (every N ticks)
TRIM_INTERVAL_TICKS = 5000
# Memory snapshot interval (every N ticks)
MEMORY_SNAPSHOT_INTERVAL = 1000
# Max memory growth per day threshold (MB)
MAX_MEMORY_GROWTH_MB_PER_DAY = 10.0


class PaperTradingEngine:
    """Self-contained paper trading engine with real-time price feeds.

    Uses exchange connectors to get live prices and simulates order execution,
    position management, PnL calculation, and funding rate settlement.
    Designed for 7x24 stable, long-running operation.
    """

    def __init__(
        self,
        *,
        instruments: list[str],
        exchange: str = "binance",
        initial_balance: float = 100_000.0,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        taker_fee: float = 0.0004,
        maker_fee: float = 0.0002,
        on_event: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self._instruments = instruments
        self._exchange_name = exchange
        self._poll_interval = poll_interval
        self._on_event = on_event
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._tick_count = 0
        self._started_at: str = ""
        self._last_prices: dict[str, float] = {}
        self._memory_baseline: int = 0

        # Core components
        self._position_manager = PositionManager(initial_balance=initial_balance)
        self._orderbook_sim = OrderbookSimulator(
            taker_fee=taker_fee,
            maker_fee=maker_fee,
            on_fill=self._handle_fill,
        )
        self._funding_scheduler = FundingScheduler(
            on_funding_applied=self._handle_funding,
        )

        # Connector created lazily
        self._connector: Any = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def position_manager(self) -> PositionManager:
        return self._position_manager

    @property
    def orderbook_sim(self) -> OrderbookSimulator:
        return self._orderbook_sim

    @property
    def funding_scheduler(self) -> FundingScheduler:
        return self._funding_scheduler

    @property
    def last_prices(self) -> dict[str, float]:
        return dict(self._last_prices)

    async def start(self) -> None:
        """Start the paper trading engine."""
        if self._running:
            raise RuntimeError("Paper trading engine is already running")

        # Start memory tracking
        if not tracemalloc.is_tracing():
            tracemalloc.start()
        self._memory_baseline = tracemalloc.get_traced_memory()[0]

        self._running = True
        self._started_at = datetime.now(timezone.utc).isoformat()
        self._task = asyncio.create_task(self._run_loop())

        self._emit_event("started", f"Paper trading started for {self._instruments}")
        logger.info(
            "Paper trading engine started: instruments=%s exchange=%s",
            self._instruments,
            self._exchange_name,
        )

    async def stop(self) -> None:
        """Stop the paper trading engine gracefully."""
        if not self._running:
            return

        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        # Close connector
        if self._connector is not None:
            try:
                await self._connector.close()
            except Exception:
                pass
            self._connector = None

        self._emit_event("stopped", "Paper trading stopped")
        logger.info("Paper trading engine stopped")

    def submit_order(
        self,
        *,
        instrument: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float = 0.0,
    ) -> PaperOrder:
        """Submit a simulated order."""
        current_price = self._last_prices.get(instrument)
        order = self._orderbook_sim.submit_order(
            instrument=instrument,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            current_price=current_price,
        )
        return order

    def cancel_order(self, order_id: str) -> bool:
        """Cancel a pending order."""
        return self._orderbook_sim.cancel_order(order_id)

    def get_status(self) -> dict[str, Any]:
        """Return current engine status for gRPC queries."""
        current, peak = tracemalloc.get_traced_memory() if tracemalloc.is_tracing() else (0, 0)
        return {
            "running": self._running,
            "started_at": self._started_at,
            "tick_count": self._tick_count,
            "instruments": self._instruments,
            "exchange": self._exchange_name,
            "last_prices": self._last_prices,
            "open_orders": len(self._orderbook_sim.open_orders),
            "positions": {
                k: v.to_dict() for k, v in self._position_manager.positions.items()
            },
            "balance": self._position_manager.balance.to_dict(),
            "account_summary": self._position_manager.get_account_summary(),
            "next_funding": self._funding_scheduler.next_funding.isoformat(),
            "memory_current_mb": current / (1024 * 1024),
            "memory_peak_mb": peak / (1024 * 1024),
            "memory_growth_mb": (current - self._memory_baseline) / (1024 * 1024),
        }

    async def _get_connector(self) -> Any:
        """Lazily create exchange connector."""
        if self._connector is None:
            from tino_daemon.exchanges import get_connector
            self._connector = get_connector(self._exchange_name)
        return self._connector

    async def _run_loop(self) -> None:
        """Main event loop: poll prices, match orders, settle funding."""
        while self._running:
            try:
                await self._tick()
                self._tick_count += 1

                # Periodic memory management
                if self._tick_count % TRIM_INTERVAL_TICKS == 0:
                    self._trim_histories()

                if self._tick_count % MEMORY_SNAPSHOT_INTERVAL == 0:
                    self._check_memory()

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Paper trading tick error: %s", exc, exc_info=True)
                self._emit_event("error", f"Tick error: {exc}")
                # Continue running despite errors for stability

            await asyncio.sleep(self._poll_interval)

    async def _tick(self) -> None:
        """Single tick: fetch prices, match orders, update PnL, check funding."""
        connector = await self._get_connector()

        for instrument in self._instruments:
            try:
                ticker = await connector.get_ticker(instrument)
                price = ticker.last_price
                self._last_prices[instrument] = price

                # Match pending orders
                filled = self._orderbook_sim.on_price_update(instrument, price)
                for order in filled:
                    self._emit_event(
                        "order_filled",
                        f"Order {order.id} filled: {order.side.value} {order.quantity} {instrument} @ {order.filled_price:.6f}",
                        data=order.to_dict(),
                    )

                # Update unrealized PnL
                upnl = self._position_manager.update_unrealized_pnl(instrument, price)
                if self._position_manager.positions.get(instrument):
                    self._emit_event(
                        "pnl_update",
                        f"PnL update: {instrument} unrealized={upnl:.4f}",
                        data={
                            "instrument": instrument,
                            "price": price,
                            "unrealized_pnl": upnl,
                            "balance": self._position_manager.balance.to_dict(),
                        },
                    )

            except Exception as exc:
                logger.warning("Failed to fetch price for %s: %s", instrument, exc)

        # Check funding settlement
        await self._check_funding(connector)

    async def _check_funding(self, connector: Any) -> None:
        """Check and apply funding rate settlement if due."""
        if not self._funding_scheduler.should_settle():
            return

        for instrument in self._instruments:
            pos = self._position_manager.positions.get(instrument)
            if pos is None or pos.quantity <= 0:
                continue

            try:
                fr = await connector.get_funding_rate(instrument)
                rate = fr.funding_rate
                payment = self._position_manager.apply_funding(instrument, rate)
                self._funding_scheduler.record_settlement(instrument, rate, payment)

                self._emit_event(
                    "pnl_update",
                    f"Funding settled: {instrument} rate={rate:.6f} payment={payment:.4f}",
                    data={
                        "type": "funding_settlement",
                        "instrument": instrument,
                        "funding_rate": rate,
                        "payment": payment,
                    },
                )

            except Exception as exc:
                logger.warning("Failed to fetch funding rate for %s: %s", instrument, exc)

    def _handle_fill(self, order: PaperOrder) -> None:
        """Callback when an order is filled — update positions."""
        self._position_manager.apply_fill(order)

        pos = self._position_manager.positions.get(order.instrument)
        if pos:
            self._emit_event(
                "position_changed",
                f"Position update: {pos.side} {pos.quantity} {order.instrument} @ avg {pos.avg_price:.6f}",
                data=pos.to_dict(),
            )

    def _handle_funding(self, instrument: str, rate: float, payment: float) -> None:
        """Callback after funding is applied."""
        logger.debug("Funding applied: %s rate=%.6f payment=%.4f", instrument, rate, payment)

    def _emit_event(
        self,
        event_type: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Emit an event to the callback (e.g., gRPC stream)."""
        if self._on_event is None:
            return
        payload = {
            "type": event_type,
            "message": message,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            self._on_event(payload)
        except Exception:
            pass  # Never crash on event emission

    def _trim_histories(self) -> None:
        """Trim all internal histories to prevent unbounded memory growth."""
        self._orderbook_sim.trim_history(max_filled=10000)
        self._position_manager.trim_history(max_closed=1000)
        self._funding_scheduler.trim_history(max_entries=1000)
        logger.debug("Paper trading histories trimmed at tick %d", self._tick_count)

    def _check_memory(self) -> None:
        """Check memory usage and log warnings if growth is excessive."""
        if not tracemalloc.is_tracing():
            return

        current, peak = tracemalloc.get_traced_memory()
        growth = current - self._memory_baseline
        growth_mb = growth / (1024 * 1024)

        logger.debug(
            "Paper trading memory: current=%.2fMB peak=%.2fMB growth=%.2fMB",
            current / (1024 * 1024),
            peak / (1024 * 1024),
            growth_mb,
        )

        if growth_mb > MAX_MEMORY_GROWTH_MB_PER_DAY:
            logger.warning(
                "Paper trading memory growth %.2fMB exceeds threshold %.2fMB",
                growth_mb,
                MAX_MEMORY_GROWTH_MB_PER_DAY,
            )
