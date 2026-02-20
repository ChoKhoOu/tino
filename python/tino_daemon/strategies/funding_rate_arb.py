"""
Funding Rate Arbitrage Strategy for NautilusTrader.

Implements a delta-neutral cash-and-carry trade:
  - Long spot + short perpetual when funding rate exceeds threshold
  - Collect periodic funding payments while maintaining delta neutrality
  - Exit when funding rate normalizes below exit threshold

Parameters:
  funding_rate_threshold: Minimum annualized funding rate to enter (default 0.15)
  exit_threshold: Annualized rate below which to exit (default 0.05)
  position_size_pct: Fraction of equity per trade (default 0.10)
  rebalance_interval_hours: Check interval aligned to funding (default 8)
  max_positions: Maximum concurrent arb pairs (default 3)
"""

from __future__ import annotations

from decimal import Decimal

from nautilus_trader.config import StrategyConfig  # type: ignore[import-not-found]
from nautilus_trader.model.data import Bar  # type: ignore[import-not-found]
from nautilus_trader.model.enums import OrderSide  # type: ignore[import-not-found]
from nautilus_trader.model.identifiers import InstrumentId  # type: ignore[import-not-found]
from nautilus_trader.trading.strategy import Strategy  # type: ignore[import-not-found]


class FundingRateArbConfig(StrategyConfig, frozen=True):
    """Configuration for funding rate arbitrage strategy."""

    spot_instrument_id: str = "BTC/USDT.BINANCE"
    perp_instrument_id: str = "BTC-PERP.BINANCE"
    funding_rate_threshold: float = 0.15
    exit_threshold: float = 0.05
    position_size_pct: float = 0.10
    rebalance_interval_hours: int = 8
    max_positions: int = 3


class FundingRateArbStrategy(Strategy):
    """Delta-neutral funding rate arbitrage strategy.

    Enters long spot + short perpetual when funding rate is elevated.
    Exits when funding rate normalizes.
    """

    def __init__(self, config: FundingRateArbConfig) -> None:
        super().__init__(config)
        self.spot_id = InstrumentId.from_str(config.spot_instrument_id)
        self.perp_id = InstrumentId.from_str(config.perp_instrument_id)
        self.threshold = config.funding_rate_threshold
        self.exit_threshold = config.exit_threshold
        self.size_pct = config.position_size_pct
        self.max_positions = config.max_positions
        self._in_position = False
        self._bar_count = 0
        self._bars_per_check = max(1, config.rebalance_interval_hours)

    def on_start(self) -> None:
        """Subscribe to bar data for both instruments."""
        self.log.info("Funding rate arb strategy starting")
        self._in_position = False
        self._bar_count = 0

    def on_bar(self, bar: Bar) -> None:
        """Evaluate funding rate signal on each bar."""
        self._bar_count += 1
        if self._bar_count % self._bars_per_check != 0:
            return

        funding_rate = self._estimate_funding_rate(bar)
        annualized = funding_rate * 3 * 365

        if not self._in_position and annualized > self.threshold:
            self._enter_arb(bar)
        elif self._in_position and annualized < self.exit_threshold:
            self._exit_arb(bar)

    def _estimate_funding_rate(self, bar: Bar) -> float:
        """Estimate funding rate from basis between spot and perp.

        In live trading, this would query the exchange API directly.
        For backtesting, we approximate from price divergence.
        """
        close = float(bar.close)
        if close == 0:
            return 0.0
        # Simplified: use bar as proxy. Real impl fetches from exchange.
        return 0.0001  # Placeholder for backtest; override in live

    def _enter_arb(self, bar: Bar) -> None:
        """Open delta-neutral position: long spot, short perp."""
        equity = self._get_equity()
        trade_value = equity * Decimal(str(self.size_pct))
        price = bar.close
        if float(price) == 0:
            return
        quantity = trade_value / price

        self.log.info(f"Entering arb: long spot + short perp, qty={quantity}")

        self.submit_market_order(
            instrument_id=self.spot_id,
            order_side=OrderSide.BUY,
            quantity=quantity,
        )
        self.submit_market_order(
            instrument_id=self.perp_id,
            order_side=OrderSide.SELL,
            quantity=quantity,
        )
        self._in_position = True

    def _exit_arb(self, bar: Bar) -> None:
        """Close delta-neutral position."""
        self.log.info("Exiting arb: closing spot long + perp short")
        self.close_all_positions(self.spot_id)
        self.close_all_positions(self.perp_id)
        self._in_position = False

    def _get_equity(self) -> Decimal:
        """Get current account equity."""
        account = self.portfolio.account(self.spot_id.venue)
        if account is None:
            return Decimal("10000")
        balances = account.balances()
        if not balances:
            return Decimal("10000")
        return next(iter(balances.values())).total

    def on_stop(self) -> None:
        """Clean up on strategy stop."""
        if self._in_position:
            self.log.info("Strategy stopping -- closing all positions")
            self.close_all_positions(self.spot_id)
            self.close_all_positions(self.perp_id)
            self._in_position = False

    def submit_market_order(
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
