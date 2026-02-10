from decimal import Decimal
from nautilus_trader.config import StrategyConfig
from nautilus_trader.model.data import Bar
from nautilus_trader.model.enums import OrderSide, TimeInForce
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.model.objects import Quantity
from nautilus_trader.trading.strategy import Strategy
from nautilus_trader.indicators.average.sma import SimpleMovingAverage
from nautilus_trader.indicators.statistics.std_dev import StandardDeviation


class PairsTradingConfig(StrategyConfig):
    instrument_id_1: str
    instrument_id_2: str
    bar_type: str
    lookback_period: int = 20
    entry_z_score: float = 2.0
    exit_z_score: float = 0.5
    quantity_1: Decimal = Decimal("10")
    quantity_2: Decimal = Decimal(
        "10"
    )  # Simplified: assuming 1:1 ratio or pre-calculated hedge ratio


class PairsTradingStrategy(Strategy):
    """
    Statistical Arbitrage (Pairs Trading) Strategy.

    Logic:
    - Calculate spread = Price1 - Price2
    - Calculate Z-Score of spread = (Spread - SMA(Spread)) / StdDev(Spread)
    - If Z-Score > entry_threshold: Short Spread (Short Inst1, Long Inst2)
    - If Z-Score < -entry_threshold: Long Spread (Long Inst1, Short Inst2)
    - Exit when Z-Score reverts to exit_threshold (near 0)
    """

    def __init__(self, config: PairsTradingConfig):
        super().__init__(config)
        self.instrument_id_1 = InstrumentId.from_str(config.instrument_id_1)
        self.instrument_id_2 = InstrumentId.from_str(config.instrument_id_2)

        self.sma = SimpleMovingAverage(config.lookback_period)
        self.std_dev = StandardDeviation(config.lookback_period)

        self.spread_history = []

    def on_start(self):
        self.subscribe_bars(self.instrument_id_1, self.config.bar_type)
        self.subscribe_bars(self.instrument_id_2, self.config.bar_type)
        self.log.info(
            f"Started PairsTradingStrategy for {self.instrument_id_1} and {self.instrument_id_2}"
        )

    def on_bar(self, bar: Bar):
        # Note: In a real strategy, we need to ensure bars are aligned (same timestamp)
        # This is a simplified example assuming synchronous data arrival or using the latest available prices

        price1 = self.cache.bar(self.instrument_id_1, self.config.bar_type)
        price2 = self.cache.bar(self.instrument_id_2, self.config.bar_type)

        if price1 is None or price2 is None:
            return

        # Calculate Spread
        spread = price1.close - price2.close

        # Update Indicators
        self.sma.update(spread)
        self.std_dev.update(spread)

        if not self.sma.initialized or not self.std_dev.initialized:
            return

        # Calculate Z-Score
        if self.std_dev.value == 0:
            return

        z_score = (spread - self.sma.value) / self.std_dev.value

        # Trading Logic
        position1 = self.cache.position(self.instrument_id_1)

        if position1 is None:
            # Entry
            if z_score > self.config.entry_z_score:
                # Spread is too high -> Short Spread (Short 1, Long 2)
                self.log.info(
                    f"Z-Score {z_score:.2f} > {self.config.entry_z_score}. Shorting Spread."
                )
                self.submit_order(
                    self.order_factory.market(
                        instrument_id=self.instrument_id_1,
                        order_side=OrderSide.SELL,
                        quantity=self.instrument(self.instrument_id_1).make_qty(
                            self.config.quantity_1
                        ),
                    )
                )
                self.submit_order(
                    self.order_factory.market(
                        instrument_id=self.instrument_id_2,
                        order_side=OrderSide.BUY,
                        quantity=self.instrument(self.instrument_id_2).make_qty(
                            self.config.quantity_2
                        ),
                    )
                )

            elif z_score < -self.config.entry_z_score:
                # Spread is too low -> Long Spread (Long 1, Short 2)
                self.log.info(
                    f"Z-Score {z_score:.2f} < -{self.config.entry_z_score}. Longing Spread."
                )
                self.submit_order(
                    self.order_factory.market(
                        instrument_id=self.instrument_id_1,
                        order_side=OrderSide.BUY,
                        quantity=self.instrument(self.instrument_id_1).make_qty(
                            self.config.quantity_1
                        ),
                    )
                )
                self.submit_order(
                    self.order_factory.market(
                        instrument_id=self.instrument_id_2,
                        order_side=OrderSide.SELL,
                        quantity=self.instrument(self.instrument_id_2).make_qty(
                            self.config.quantity_2
                        ),
                    )
                )

        else:
            # Exit (Mean Reversion)
            if abs(z_score) < self.config.exit_z_score:
                self.log.info(
                    f"Z-Score {z_score:.2f} reverted to mean. Closing positions."
                )
                self.close_all_positions(self.instrument_id_1)
                self.close_all_positions(self.instrument_id_2)

    def on_stop(self):
        self.close_all_positions(self.instrument_id_1)
        self.close_all_positions(self.instrument_id_2)
