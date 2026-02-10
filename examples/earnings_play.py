from decimal import Decimal
from datetime import datetime, timezone
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.objects import Quantity
from nautilus_trader.trading.strategy import Strategy


class EarningsPlayConfig(StrategyConfig):
    instrument_id: str
    bar_type: str
    earnings_date: str  # ISO format: YYYY-MM-DD
    quantity: Decimal = Decimal("10")
    stop_loss_pct: Decimal = Decimal("0.05")
    take_profit_pct: Decimal = Decimal("0.10")
    hold_duration_bars: int = 5  # How many bars to hold after entry


class EarningsPlayStrategy(Strategy):
    """
    Event-driven strategy for Earnings Announcements.

    Logic:
    - Wait for the specific earnings date (simplified: enters at start of that day/session).
    - In a real scenario, this would consume an 'EarningsEvent' from a data feed.
    - Enters a Long position (betting on beat) - purely for example.
    - Exits after 'hold_duration_bars' or if SL/TP is hit.
    """

    def __init__(self, config: EarningsPlayConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.earnings_date = datetime.fromisoformat(config.earnings_date).replace(
            tzinfo=timezone.utc
        )
        self.bars_held = 0
        self.entry_made = False

    def on_start(self):
        self.subscribe_bars(self.instrument_id, self.config.bar_type)
        self.log.info(
            f"Started EarningsPlayStrategy for {self.instrument_id} on {self.earnings_date}"
        )

    def on_bar(self, bar: Bar):
        # Check if we are at or past the earnings date
        current_time = datetime.fromtimestamp(bar.ts_event / 1e9, tz=timezone.utc)

        position = self.cache.position(self.instrument_id)

        # Entry Logic
        if not self.entry_made and current_time.date() >= self.earnings_date.date():
            self.log.info(f"Earnings date reached ({current_time}). Entering Long.")
            self.submit_order(
                self.order_factory.market(
                    instrument_id=self.instrument_id,
                    order_side=OrderSide.BUY,
                    quantity=self.instrument(self.instrument_id).make_qty(
                        self.config.quantity
                    ),
                )
            )
            self.entry_made = True

        # Exit Logic
        if position:
            self.bars_held += 1

            avg_price = position.avg_px_open
            current_price = bar.close
            pnl_pct = (current_price - avg_price) / avg_price

            if pnl_pct <= -self.config.stop_loss_pct:
                self.log.info(f"Stop loss hit ({pnl_pct:.2%}). Closing.")
                self.close_position(self.instrument_id)
            elif pnl_pct >= self.config.take_profit_pct:
                self.log.info(f"Take profit hit ({pnl_pct:.2%}). Closing.")
                self.close_position(self.instrument_id)
            elif self.bars_held >= self.config.hold_duration_bars:
                self.log.info(f"Held for {self.bars_held} bars. Closing post-earnings.")
                self.close_position(self.instrument_id)

    def on_stop(self):
        self.close_all_positions(self.instrument_id)
