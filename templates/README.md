# NautilusTrader Strategy Templates

This directory contains reference strategy templates used by the strategy-generation flow.
Each template extends `Strategy`, includes optimization-ready parameters, and implements
`on_start`, `on_bar`, and `on_stop` with stop-loss/take-profit risk controls.

## Templates

- `ema_crossover.py`
  - `EmaCrossoverStrategy`
  - Classic dual EMA crossover with ATR-based stop-loss and take-profit.
  - Good starting point for trend-following systems.

- `mean_reversion.py`
  - `MeanReversionStrategy`
  - Bollinger Band + RSI reversion logic with ATR-based exits.
  - Good starting point for range-bound markets.

- `momentum.py`
  - `MomentumStrategy`
  - RSI + volume impulse entry with ATR-based stop-loss/take-profit.
  - Good starting point for breakout and continuation setups.

## How To Use

1. Copy one template into your project's `strategies/` directory.
2. Rename the strategy class and file to match your use case.
3. Provide runtime config values for `instrument_id`, `bar_type`, and optional parameters.
4. Backtest first, then tune parameters with optimization.

## Parameter Customization Tips

- Signal sensitivity: adjust EMA/RSI/Bollinger periods.
- Trade frequency: increase/decrease entry thresholds.
- Risk profile: tune `risk_per_trade_bps`, `stop_atr_multiple`, and
  `take_profit_atr_multiple`.
- Market fit: validate defaults per instrument and timeframe before live deployment.
