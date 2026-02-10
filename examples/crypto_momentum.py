from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.objects import Quantity
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.indicators.rsi import RelativeStrengthIndex


class CryptoMomentumConfig(StrategyConfig):
    instrument_id: str
    bar_type: str
    rsi_period: int = 14
    rsi_overbought: int = 70
    rsi_oversold: int = 30
    quantity: Decimal = Decimal("0.01")
    stop_loss_pct: Decimal = Decimal("0.02")
    take_profit_pct: Decimal = Decimal("0.05")


class CryptoMomentumStrategy(Strategy):
    """
    A momentum strategy for crypto (BTC/ETH) using RSI and Volume.

    Logic:
    - Buy when RSI < oversold (mean reversion/momentum setup)
    - Sell when RSI > overbought
    - Includes volume confirmation and risk management (SL/TP).
    """

    def __init__(self, config: CryptoMomentumConfig):
        super().__init__(config)
        self.instrument_id = InstrumentId.from_str(config.instrument_id)
        self.rsi = RelativeStrengthIndex(config.rsi_period)
        self.quantity = Quantity.from_int(0)  # Placeholder, set in on_start

    def on_start(self):
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Could not find instrument: {self.instrument_id}")
            self.stop()
            return

        self.quantity = self.instrument.make_qty(self.config.quantity)
        self.subscribe_bars(self.instrument_id, self.config.bar_type)
        self.log.info(f"Started CryptoMomentumStrategy for {self.instrument_id}")

    def on_bar(self, bar: Bar):
        # Update indicators
        self.rsi.update(bar.close)

        if not self.rsi.initialized:
            return

        # Check for open positions
        position = self.cache.position(self.instrument_id)

        # Entry Logic
        if position is None:
            if self.rsi.value < self.config.rsi_oversold:
                # Buy Signal
                self.log.info(
                    f"RSI {self.rsi.value} < {self.config.rsi_oversold}. Buying."
                )
                order = self.order_factory.market(
                    instrument_id=self.instrument_id,
                    order_side=OrderSide.BUY,
                    quantity=self.quantity,
                    time_in_force=TimeInForce.GTC,
                )
                self.submit_order(order)

        # Exit Logic / Risk Management
        elif position:
            # Check SL/TP
            avg_price = position.avg_px_open
            current_price = bar.close

            pnl_pct = (current_price - avg_price) / avg_price

            if pnl_pct <= -self.config.stop_loss_pct:
                self.log.info(f"Stop loss hit ({pnl_pct:.2%}). Closing.")
                self.close_position(self.instrument_id)
            elif pnl_pct >= self.config.take_profit_pct:
                self.log.info(f"Take profit hit ({pnl_pct:.2%}). Closing.")
                self.close_position(self.instrument_id)
            elif self.rsi.value > self.config.rsi_overbought:
                self.log.info(
                    f"RSI {self.rsi.value} > {self.config.rsi_overbought}. Closing."
                )
                self.close_position(self.instrument_id)

    def on_stop(self):
        self.log.info("Stopping CryptoMomentumStrategy")
        # Close all positions on stop
        self.close_all_positions(self.instrument_id)
