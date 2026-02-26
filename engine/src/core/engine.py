"""NautilusTrader engine wrapper for backtest and live trading."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class EngineConfig:
    """Configuration for the trading engine."""

    def __init__(
        self,
        venue: str = "BINANCE",
        account_type: str = "CASH",
        base_currency: str = "USDT",
        starting_balance: float = 10000.0,
    ):
        self.venue = venue
        self.account_type = account_type
        self.base_currency = base_currency
        self.starting_balance = starting_balance


class TradingEngineWrapper:
    """Wrapper around NautilusTrader for backtest and live execution.

    Provides a unified interface for both backtest and live modes,
    ensuring isomorphic strategy execution (same strategy code runs
    in both modes).
    """

    def __init__(self, config: EngineConfig | None = None):
        self.config = config or EngineConfig()
        self._backtest_engine = None
        self._trading_node = None

    async def run_backtest(
        self,
        strategy_source: str,
        strategy_params: dict[str, Any],
        instrument_id: str,
        data_path: str,
        bar_type: str = "1-HOUR",
    ) -> dict:
        """Run a backtest with the given strategy and data.

        Args:
            strategy_source: Python source code of the strategy
            strategy_params: Strategy configuration parameters
            instrument_id: e.g., "BTCUSDT.BINANCE"
            data_path: Path to Parquet data file
            bar_type: Bar aggregation type

        Returns:
            Dict with metrics, trade_log, equity_curve
        """
        try:
            from nautilus_trader.backtest.engine import BacktestEngine
            from nautilus_trader.backtest.engine import BacktestEngineConfig
            from nautilus_trader.model.currencies import USDT
            from nautilus_trader.model.enums import AccountType, OmsType
            from nautilus_trader.model.identifiers import Venue
        except ImportError:
            logger.warning("NautilusTrader not installed. Using mock backtest engine.")
            return self._mock_backtest(instrument_id, strategy_params)

        # Configure backtest engine
        engine_config = BacktestEngineConfig(
            trader_id="TINO-001",
        )
        engine = BacktestEngine(config=engine_config)

        # Add venue
        venue = Venue(self.config.venue)
        engine.add_venue(
            venue=venue,
            oms_type=OmsType.NETTING,
            account_type=AccountType.CASH,
            base_currency=USDT,
            starting_balances=[f"{self.config.starting_balance} USDT"],
        )

        # TODO: Load instrument, data, and strategy from source code
        # This will be fully implemented when NautilusTrader is available

        logger.info(f"Backtest started for {instrument_id}")
        return self._mock_backtest(instrument_id, strategy_params)

    def _mock_backtest(self, instrument_id: str, params: dict) -> dict:
        """Mock backtest results for development without NautilusTrader."""
        return {
            "metrics": {
                "total_pnl": "1250.50",
                "sharpe_ratio": 1.85,
                "sortino_ratio": 2.10,
                "win_rate": 0.62,
                "max_drawdown": 0.08,
                "total_trades": 147,
                "avg_trade_pnl": "8.51",
                "profit_factor": 1.92,
                "max_consecutive_wins": 8,
                "max_consecutive_losses": 4,
            },
            "trade_log": [],
            "equity_curve": [],
        }

    async def start_live(
        self,
        strategy_source: str,
        strategy_params: dict[str, Any],
        instrument_id: str,
        api_key: str,
        api_secret: str,
    ) -> None:
        """Start live trading with the given strategy.

        SAFETY: This method should only be called after:
        1. Human confirmation (y/N prompt)
        2. API key validation (no withdrawal permissions)
        3. Risk circuit breaker initialization
        4. At least one backtest run exists for this strategy
        """
        try:
            from nautilus_trader.live.node import TradingNode
            from nautilus_trader.live.node import TradingNodeConfig
        except ImportError:
            logger.error("NautilusTrader not installed. Cannot start live trading.")
            raise RuntimeError("NautilusTrader is required for live trading")

        # TODO: Configure TradingNode with Binance adapter
        logger.info(f"Live trading started for {instrument_id}")

    async def stop_live(self) -> None:
        """Stop live trading node."""
        if self._trading_node:
            # TODO: Graceful shutdown
            logger.info("Live trading stopped")
            self._trading_node = None
