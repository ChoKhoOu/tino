"""RSI + volume momentum strategy template for NautilusTrader."""

# pyright: basic, reportMissingImports=false
from __future__ import annotations
from decimal import Decimal
from nautilus_trader.indicators import AverageTrueRange
from nautilus_trader.indicators import RelativeStrengthIndex
from nautilus_trader.model.data import Bar
from nautilus_trader.model.data import BarType
from nautilus_trader.model.enums import OrderSide
from nautilus_trader.model.identifiers import InstrumentId
from nautilus_trader.trading.strategy import Strategy


class MomentumStrategy(Strategy):
    """Buy when RSI and volume surge together, then manage with ATR exits."""

    rsi_period: int = 14
    rsi_entry: float = 60.0
    volume_sma_period: int = 20
    volume_multiplier: float = 1.5
    stop_atr_multiple: float = 2.0
    take_profit_atr_multiple: float = 3.0
    risk_per_trade_bps: int = 100
    trade_size: float = 1.0

    def __init__(self, config) -> None:
        super().__init__(config)
        self.instrument_id: InstrumentId = config.instrument_id
        self.bar_type: BarType = config.bar_type
        self.rsi_period = int(getattr(config, "rsi_period", self.rsi_period))
        self.rsi_entry = float(getattr(config, "rsi_entry", self.rsi_entry))
        self.volume_sma_period = int(
            getattr(config, "volume_sma_period", self.volume_sma_period)
        )
        self.volume_multiplier = float(
            getattr(config, "volume_multiplier", self.volume_multiplier)
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
        self.rsi = RelativeStrengthIndex(self.rsi_period)
        self.atr = AverageTrueRange(14)
        self._volume_window: list[float] = []
        self._stop_price: float | None = None
        self._take_profit_price: float | None = None

    def on_start(self) -> None:
        self.instrument = self.cache.instrument(self.instrument_id)
        if self.instrument is None:
            self.log.error(f"Instrument not found: {self.instrument_id}")
            self.stop()
            return
        self.register_indicator_for_bars(self.bar_type, self.rsi)
        self.register_indicator_for_bars(self.bar_type, self.atr)
        self.subscribe_bars(self.bar_type)

    def on_bar(self, bar: Bar) -> None:
        if not self.indicators_initialized():
            return
        close_price = float(bar.close)
        volume = float(getattr(bar, "volume", 0.0) or 0.0)
        self._volume_window.append(volume)
        if len(self._volume_window) > self.volume_sma_period:
            self._volume_window.pop(0)
        if len(self._volume_window) < self.volume_sma_period:
            return

        volume_sma = sum(self._volume_window) / len(self._volume_window)
        rsi_value = float(self.rsi.value)
        if not self.portfolio.is_flat(self.instrument_id):
            stop_hit = self._stop_price is not None and close_price <= self._stop_price
            target_hit = (
                self._take_profit_price is not None
                and close_price >= self._take_profit_price
            )
            if stop_hit or target_hit or rsi_value < 50.0:
                self._exit_position()
            return

        if rsi_value > self.rsi_entry and volume > volume_sma * self.volume_multiplier:
            self._enter_long(close_price)

    def on_stop(self) -> None:
        self.cancel_all_orders(self.instrument_id)
        self.close_all_positions(self.instrument_id)
        self.unsubscribe_bars(self.bar_type)

    def _enter_long(self, entry_price: float) -> None:
        if self.instrument is None or self.atr.value <= 0:
            return
        risk_scale = max(self.risk_per_trade_bps, 1) / 10_000.0
        qty = self.instrument.make_qty(
            Decimal(str(max(self.trade_size * risk_scale, 0.0001)))
        )
        order = self.order_factory.market(
            instrument_id=self.instrument_id, order_side=OrderSide.BUY, quantity=qty
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
