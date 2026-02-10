"""Bollinger + RSI mean reversion strategy template for NautilusTrader."""

# pyright: basic, reportMissingImports=false
from __future__ import annotations
from decimal import Decimal

from nautilus_trader.indicators import AverageTrueRange
from nautilus_trader.indicators import BollingerBands
from nautilus_trader.indicators import RelativeStrengthIndex
from nautilus_trader.model.data import Bar
from nautilus_trader.model.data import BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading.strategy import Strategy


class MeanReversionStrategy(Strategy):
    """Buy lower band + oversold RSI, exit near upper band or risk limits."""

    bb_period: int = 20
    bb_std: float = 2.0
    rsi_period: int = 14
    rsi_oversold: float = 30.0
    rsi_overbought: float = 70.0
    stop_atr_multiple: float = 1.5
    take_profit_atr_multiple: float = 2.5
    risk_per_trade_bps: int = 100
    trade_size: float = 1.0

    def __init__(self, config) -> None:
        super().__init__(config)
        self.instrument_id: InstrumentId = config.instrument_id
        self.bar_type: BarType = config.bar_type
        self.bb_period = int(getattr(config, "bb_period", self.bb_period))
        self.bb_std = float(getattr(config, "bb_std", self.bb_std))
        self.rsi_period = int(getattr(config, "rsi_period", self.rsi_period))
        self.rsi_oversold = float(getattr(config, "rsi_oversold", self.rsi_oversold))
        self.rsi_overbought = float(
            getattr(config, "rsi_overbought", self.rsi_overbought)
        )
        self.stop_atr_multiple = float(
            getattr(config, "stop_atr_multiple", self.stop_atr_multiple)
        )
        self.take_profit_atr_multiple = float(
            getattr(config, "take_profit_atr_multiple", self.take_profit_atr_multiple)
        )
        self.risk_per_trade_bps = int(
            getattr(config, "risk_per_trade_bps", self.risk_per_trade_bps)
        )
        self.trade_size = float(getattr(config, "trade_size", self.trade_size))

        self.instrument = None
        self.bb = BollingerBands(self.bb_period, self.bb_std)
        self.rsi = RelativeStrengthIndex(self.rsi_period)
        self.atr = AverageTrueRange(14)
        self._stop_price: float | None = None
        self._take_profit_price: float | None = None

    def on_start(self) -> None:
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Instrument not found: {self.instrument_id}")
            self.stop()
            return
        self.register_indicator_for_bars(self.bar_type, self.bb)
        self.register_indicator_for_bars(self.bar_type, self.rsi)
        self.register_indicator_for_bars(self.bar_type, self.atr)
        self.subscribe_bars(self.bar_type)

    def on_bar(self, bar: Bar) -> None:
        if not self.indicators_initialized():
            return
        close_price = float(bar.close)
        upper = float(getattr(self.bb, "upper", close_price))
        lower = float(getattr(self.bb, "lower", close_price))
        middle = float(getattr(self.bb, "middle", close_price))
        rsi_value = float(self.rsi.value)

        if not self.portfolio.is_flat(self.instrument_id):
            stop_hit = self._stop_price is not None and close_price <= self._stop_price
            target_hit = (
                self._take_profit_price is not None
                and close_price >= self._take_profit_price
            )
            mean_reverted = close_price >= middle
            overbought_exit = close_price >= upper and rsi_value > self.rsi_overbought
            if stop_hit or target_hit or mean_reverted or overbought_exit:
                self._exit_position()
            return

        if close_price <= lower and rsi_value < self.rsi_oversold:
            self._enter_long(close_price)

    def on_stop(self) -> None:
        self.cancel_all_orders(self.instrument_id)
        self.close_all_positions(self.instrument_id)
        self.unsubscribe_bars(self.bar_type)

    def _enter_long(self, entry_price: float) -> None:
        if self.instrument is None or self.atr.value <= 0:
            return
        risk_scale = max(self.risk_per_trade_bps, 1) / 10_000.0
        size = max(self.trade_size * risk_scale, 0.0001)
        qty = self.instrument.make_qty(Decimal(str(size)))
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
