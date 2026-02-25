"""Funding Rate Arbitrage Strategy for NautilusTrader.

Implements a basis-driven trading strategy that captures funding rate alpha:
  - Estimates implied funding rate from price basis (fast EMA vs slow EMA spread)
  - Shorts perp when basis premium exceeds threshold (positive funding -> shorts collect)
  - Longs perp when basis discount exceeds threshold (negative funding -> longs collect)
  - Exits when basis normalizes below exit threshold
  - Includes stop-loss and take-profit risk controls

Parameters:
  perp_instrument_id: Perpetual futures instrument (default "BTC-PERP.BINANCE")
  funding_rate_threshold: Minimum annualized basis rate to enter (default 0.15)
  exit_threshold: Annualized rate below which to exit (default 0.05)
  position_size_pct: Fraction of equity per trade (default 0.10)
  rebalance_interval_bars: Check interval in bars, aligned to funding (default 8)
  stop_loss_pct: Maximum loss before forced exit (default 0.02)
  take_profit_pct: Profit target for exit (default 0.05)
  fast_ema_period: Fast EMA period for current price level (default 8)
  slow_ema_period: Slow EMA period as fair value proxy (default 72)
  funding_periods_per_day: Exchange funding frequency per day (default 3)
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from nautilus_trader.config import StrategyConfig  # type: ignore[import-not-found]
from nautilus_trader.model.data import Bar  # type: ignore[import-not-found]
from nautilus_trader.model.enums import OrderSide  # type: ignore[import-not-found]
from nautilus_trader.model.identifiers import InstrumentId  # type: ignore[import-not-found]
from nautilus_trader.trading.strategy import Strategy as NautilusStrategy  # type: ignore[import-not-found]

from tino_daemon.strategies.base import Direction, Signal, Strategy


class FundingRateArbConfig(StrategyConfig, frozen=True):
    """Configuration for funding rate arbitrage strategy."""

    perp_instrument_id: str = "BTC-PERP.BINANCE"

    # Signal thresholds (annualized rates)
    funding_rate_threshold: float = 0.15
    exit_threshold: float = 0.05

    # Position sizing
    position_size_pct: float = 0.10

    # Rebalance interval (in bars)
    rebalance_interval_bars: int = 8

    # Risk controls
    stop_loss_pct: float = 0.02
    take_profit_pct: float = 0.05

    # Basis estimation
    fast_ema_period: int = 8
    slow_ema_period: int = 72
    funding_periods_per_day: int = 3


class _EMA:
    """Exponential moving average tracker."""

    __slots__ = ("_period", "_multiplier", "_value", "_initialized", "_count")

    def __init__(self, period: int) -> None:
        self._period = period
        self._multiplier = 2.0 / (period + 1)
        self._value = 0.0
        self._initialized = False
        self._count = 0

    @property
    def value(self) -> float:
        return self._value

    @property
    def initialized(self) -> bool:
        return self._initialized

    def update(self, price: float) -> None:
        """Update EMA with new price. Uses SMA for warmup, then switches to EMA."""
        if not self._initialized:
            self._count += 1
            if self._count == 1:
                self._value = price
            else:
                # Running mean during warmup
                self._value += (price - self._value) / self._count
            if self._count >= self._period:
                self._initialized = True
        else:
            self._value = (price - self._value) * self._multiplier + self._value


class FundingRateArbStrategy(NautilusStrategy):
    """Basis-driven funding rate arbitrage strategy.

    Extends NautilusTrader's Strategy for backtest/live execution and conforms
    to the Tino Strategy interface via CONFIG_SCHEMA and class attributes.

    Estimates the implied funding rate from the price basis (spread between
    fast and slow EMAs) and trades mean-reversion of the premium/discount.

    When basis premium is elevated (positive funding), shorts the perp
    to collect funding payments. When basis discount is deep (negative
    funding), longs the perp. Exits when basis normalizes or risk limits
    are hit.
    """

    # -- Tino Strategy interface attributes --

    name: str = "funding_rate_arb"
    description: str = (
        "Basis-driven funding rate arbitrage that captures funding alpha "
        "by trading mean-reversion of the perp premium/discount."
    )
    market_regime: str = "ranging"

    CONFIG_SCHEMA: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "FundingRateArbStrategy Configuration",
        "description": (
            "Parameters for the funding rate arbitrage strategy. "
            "Trades mean-reversion of the perpetual futures basis "
            "(premium/discount relative to spot)."
        ),
        "type": "object",
        "properties": {
            "perp_instrument_id": {
                "type": "string",
                "default": "BTC-PERP.BINANCE",
                "description": "Perpetual futures instrument ID in NautilusTrader format (SYMBOL.VENUE).",
            },
            "funding_rate_threshold": {
                "type": "number",
                "default": 0.15,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": (
                    "Minimum annualized basis rate to trigger entry. "
                    "Higher values mean fewer but higher-conviction trades."
                ),
            },
            "exit_threshold": {
                "type": "number",
                "default": 0.05,
                "minimum": 0.0,
                "maximum": 1.0,
                "description": (
                    "Annualized rate below which to exit positions. "
                    "Must be less than funding_rate_threshold."
                ),
            },
            "position_size_pct": {
                "type": "number",
                "default": 0.10,
                "minimum": 0.01,
                "maximum": 1.0,
                "description": "Fraction of account equity to allocate per trade.",
            },
            "rebalance_interval_bars": {
                "type": "integer",
                "default": 8,
                "minimum": 1,
                "maximum": 100,
                "description": (
                    "Number of bars between signal evaluations. "
                    "Aligns with exchange funding intervals (e.g., 8h bars = 3x/day)."
                ),
            },
            "stop_loss_pct": {
                "type": "number",
                "default": 0.02,
                "minimum": 0.001,
                "maximum": 0.5,
                "description": "Maximum loss as fraction of entry price before forced exit.",
            },
            "take_profit_pct": {
                "type": "number",
                "default": 0.05,
                "minimum": 0.001,
                "maximum": 1.0,
                "description": "Profit target as fraction of entry price for exit.",
            },
            "fast_ema_period": {
                "type": "integer",
                "default": 8,
                "minimum": 2,
                "maximum": 200,
                "description": "Fast EMA period for current price level estimation.",
            },
            "slow_ema_period": {
                "type": "integer",
                "default": 72,
                "minimum": 10,
                "maximum": 500,
                "description": "Slow EMA period as fair value proxy.",
            },
            "funding_periods_per_day": {
                "type": "integer",
                "default": 3,
                "minimum": 1,
                "maximum": 24,
                "description": (
                    "Number of funding settlement periods per day on the exchange. "
                    "Binance/OKX = 3, some DEXs = 24."
                ),
            },
        },
        "required": [],
        "additionalProperties": False,
    }

    def __init__(self, config: FundingRateArbConfig) -> None:
        super().__init__(config)
        self.perp_id = InstrumentId.from_str(config.perp_instrument_id)
        self.threshold = config.funding_rate_threshold
        self.exit_threshold = config.exit_threshold
        self.size_pct = config.position_size_pct
        self.stop_loss_pct = config.stop_loss_pct
        self.take_profit_pct = config.take_profit_pct
        self.funding_periods_per_day = config.funding_periods_per_day
        self._rebalance_interval = max(1, config.rebalance_interval_bars)

        self._fast_ema = _EMA(config.fast_ema_period)
        self._slow_ema = _EMA(config.slow_ema_period)
        self._bar_count = 0
        self._position_side: OrderSide | None = None
        self._entry_price = 0.0

    # -- lifecycle --

    def on_start(self) -> None:
        """Initialize strategy state."""
        self.log.info("Funding rate arb strategy starting")
        self._bar_count = 0
        self._position_side = None
        self._entry_price = 0.0

    def on_bar(self, bar: Bar) -> None:
        """Update EMAs and evaluate trading signals on each bar."""
        close = float(bar.close)
        if close <= 0:
            return

        self._fast_ema.update(close)
        self._slow_ema.update(close)
        self._bar_count += 1

        # Wait for both EMAs to warm up
        if not self._slow_ema.initialized:
            return

        # Check risk controls every bar when in position
        if self._position_side is not None:
            if self._check_risk_exit(close):
                return

        # Evaluate signals at rebalance intervals
        if self._bar_count % self._rebalance_interval != 0:
            return

        basis = self._compute_basis()
        annualized_rate = basis * self.funding_periods_per_day * 365

        if self._position_side is None:
            # Entry logic
            if annualized_rate > self.threshold:
                # Premium -> positive funding -> short perp to collect
                self._enter_position(bar, OrderSide.SELL)
            elif annualized_rate < -self.threshold:
                # Discount -> negative funding -> long perp to collect
                self._enter_position(bar, OrderSide.BUY)
        else:
            # Exit logic: basis normalized
            if (
                self._position_side == OrderSide.SELL
                and annualized_rate < self.exit_threshold
            ):
                self._exit_position("basis normalized below exit threshold")
            elif (
                self._position_side == OrderSide.BUY
                and annualized_rate > -self.exit_threshold
            ):
                self._exit_position("basis normalized above exit threshold")

    def on_stop(self) -> None:
        """Clean up on strategy stop."""
        if self._position_side is not None:
            self.log.info("Strategy stopping -- closing all positions")
            self.close_all_positions(self.perp_id)
            self._position_side = None
            self._entry_price = 0.0

    # -- Tino Signal generation --

    def evaluate_bar(self, bar: Any) -> list[Signal]:
        """Evaluate a bar and return Tino Signals (for AI agent layer).

        This bridges the NautilusTrader on_bar execution with the Tino
        Signal interface, allowing the AI agent to inspect strategy decisions.
        """
        close = float(bar.close) if hasattr(bar, "close") else float(bar)
        if close <= 0:
            return []

        self._fast_ema.update(close)
        self._slow_ema.update(close)

        if not self._slow_ema.initialized:
            return []

        basis = self._compute_basis()
        annualized_rate = basis * self.funding_periods_per_day * 365
        symbol = str(self.perp_id) if hasattr(self, "perp_id") else "BTC-PERP.BINANCE"

        signals: list[Signal] = []
        if annualized_rate > self.threshold:
            signals.append(
                Signal(
                    direction=Direction.SHORT,
                    symbol=symbol,
                    size=self.size_pct,
                    metadata={"annualized_rate": annualized_rate, "basis": basis},
                )
            )
        elif annualized_rate < -self.threshold:
            signals.append(
                Signal(
                    direction=Direction.LONG,
                    symbol=symbol,
                    size=self.size_pct,
                    metadata={"annualized_rate": annualized_rate, "basis": basis},
                )
            )
        return signals

    # -- signal computation --

    def _compute_basis(self) -> float:
        """Compute the basis (premium/discount) from EMA spread.

        Returns the fractional spread between the fast and slow EMAs,
        used as a proxy for the implied funding rate in backtests.
        """
        slow = self._slow_ema.value
        if slow == 0:
            return 0.0
        return (self._fast_ema.value - slow) / slow

    # -- risk management --

    def _check_risk_exit(self, current_price: float) -> bool:
        """Check stop-loss and take-profit conditions.

        Returns True if a risk exit was triggered.
        """
        if self._entry_price <= 0:
            return False

        if self._position_side == OrderSide.SELL:
            # Short position: profit when price drops
            pnl_pct = (self._entry_price - current_price) / self._entry_price
        elif self._position_side == OrderSide.BUY:
            # Long position: profit when price rises
            pnl_pct = (current_price - self._entry_price) / self._entry_price
        else:
            return False

        if pnl_pct <= -self.stop_loss_pct:
            self._exit_position(f"stop-loss triggered at {pnl_pct:.4f}")
            return True

        if pnl_pct >= self.take_profit_pct:
            self._exit_position(f"take-profit triggered at {pnl_pct:.4f}")
            return True

        return False

    # -- order execution --

    def _enter_position(self, bar: Bar, side: OrderSide) -> None:
        """Open a position with calculated size."""
        if self._position_side is not None:
            return  # Already in a position

        equity = self._get_equity()
        trade_value = equity * Decimal(str(self.size_pct))
        price = bar.close
        if float(price) <= 0:
            return

        quantity = trade_value / price

        direction = "SHORT" if side == OrderSide.SELL else "LONG"
        basis = self._compute_basis()
        self.log.info(
            f"Entering {direction} perp: qty={quantity}, "
            f"basis={basis:.6f}, price={price}"
        )

        self._submit_market_order(
            instrument_id=self.perp_id,
            order_side=side,
            quantity=quantity,
        )
        # NOTE: Assumes immediate fill (valid for backtests). For live trading,
        # move state updates to on_order_filled() callback.
        self._position_side = side
        self._entry_price = float(price)

    def _exit_position(self, reason: str) -> None:
        """Close current position."""
        self.log.info(f"Exiting position: {reason}")
        self.close_all_positions(self.perp_id)
        self._position_side = None
        self._entry_price = 0.0

    def _get_equity(self) -> Decimal:
        """Get current account equity."""
        account = self.portfolio.account(self.perp_id.venue)
        if account is None:
            self.log.debug("No account found for venue, using default equity 10000")
            return Decimal("10000")
        balances = account.balances()
        if not balances:
            self.log.debug("No balances found, using default equity 10000")
            return Decimal("10000")
        return next(iter(balances.values())).total

    def _submit_market_order(
        self,
        instrument_id: InstrumentId,
        order_side: OrderSide,
        quantity: Decimal,
    ) -> None:
        """Submit a market order for the given instrument."""
        from nautilus_trader.model.objects import Quantity  # type: ignore[import-not-found]

        order = self.order_factory.market(
            instrument_id=instrument_id,
            order_side=order_side,
            quantity=Quantity.from_str(str(round(quantity, 8))),
        )
        self.submit_order(order)
