"""Classic dual EMA crossover strategy template for NautilusTrader."""

# pyright: basic, reportMissingImports=false

from __future__ import annotations

from decimal import Decimal

from nautilus_trader.indicators import AverageTrueRange
from nautilus_trader.indicators import ExponentialMovingAverage
from nautilus_trader.model.data import Bar
from nautilus_trader.model.data import BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading.strategy import Strategy


class EmaCrossoverStrategy(Strategy):
    """Dual EMA crossover strategy with ATR-based stop loss/take profit."""

    fast_period: int = 10
    slow_period: int = 30
    risk_per_trade_bps: int = 100
    stop_atr_multiple: float = 2.0
    take_profit_atr_multiple: float = 3.0
    trade_size: float = 1.0

    def __init__(self, config) -> None:
        super().__init__(config)
        self.instrument_id: InstrumentId = config.instrument_id
        self.bar_type: BarType = config.bar_type
        self.fast_period = int(getattr(config, "fast_period", self.fast_period))
        self.slow_period = int(getattr(config, "slow_period", self.slow_period))
        self.risk_per_trade_bps = int(
            getattr(config, "risk_per_trade_bps", self.risk_per_trade_bps)
        )
        self.stop_atr_multiple = float(
            getattr(config, "stop_atr_multiple", self.stop_atr_multiple)
        )
        self.take_profit_atr_multiple = float(
            getattr(config, "take_profit_atr_multiple", self.take_profit_atr_multiple)
        )
        self.trade_size = float(getattr(config, "trade_size", self.trade_size))

        self.instrument = None
        self.fast_ema = ExponentialMovingAverage(self.fast_period)
        self.slow_ema = ExponentialMovingAverage(self.slow_period)
        self.atr = AverageTrueRange(14)
        self._last_fast_above: bool | None = None
        self._stop_price: float | None = None
        self._take_profit_price: float | None = None

    def on_start(self) -> None:
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Instrument not found: {self.instrument_id}")
            self.stop()
            return
        self.register_indicator_for_bars(self.bar_type, self.fast_ema)
        self.register_indicator_for_bars(self.bar_type, self.slow_ema)
        self.register_indicator_for_bars(self.bar_type, self.atr)
        self.subscribe_bars(self.bar_type)

    def on_bar(self, bar: Bar) -> None:
        if not self.indicators_initialized():
            return

        close_price = float(bar.close)
        if self._stop_price is not None and close_price <= self._stop_price:
            self._exit_position()
            return
        if (
            self._take_profit_price is not None
            and close_price >= self._take_profit_price
        ):
            self._exit_position()
            return

        fast_above = self.fast_ema.value >= self.slow_ema.value
        if self._last_fast_above is None:
            self._last_fast_above = fast_above
            return

        crossed_up = not self._last_fast_above and fast_above
        crossed_down = self._last_fast_above and not fast_above
        self._last_fast_above = fast_above

        if crossed_down and self.portfolio.is_net_long(self.instrument_id):
            self._exit_position()
        elif crossed_up and self.portfolio.is_flat(self.instrument_id):
            self._enter_long(close_price)

    def on_stop(self) -> None:
        self.cancel_all_orders(self.instrument_id)
        self.close_all_positions(self.instrument_id)
        self.unsubscribe_bars(self.bar_type)

    def _enter_long(self, entry_price: float) -> None:
        if self.instrument is None or self.atr.value <= 0:
            return
        risk_scale = max(self.risk_per_trade_bps, 1) / 10_000.0
        scaled_size = max(self.trade_size * risk_scale, 0.0001)
        qty = self.instrument.make_qty(Decimal(str(scaled_size)))
        order = self.order_factory.market(
            instrument_id=self.instrument_id,
            order_side=OrderSide.BUY,
            quantity=qty,
        )
        self.submit_order(order)
        atr_distance = float(self.atr.value)
        self._stop_price = entry_price - atr_distance * self.stop_atr_multiple
        self._take_profit_price = (
            entry_price + atr_distance * self.take_profit_atr_multiple
        )

    def _exit_position(self) -> None:
        self.close_all_positions(self.instrument_id)
        self._stop_price = None
        self._take_profit_price = None
