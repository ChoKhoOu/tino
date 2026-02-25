/**
 * Backtest orchestration guide injected into the system prompt.
 * Teaches the AI how to chain tools for a complete natural language backtest workflow.
 */
export const BACKTEST_ORCHESTRATION_GUIDE = `
## Backtest Orchestration

When a user requests a backtest in natural language, follow this automated pipeline. Complete the full pipeline within the iteration limit. Do not ask the user for intermediate confirmations.

### Step 1: Parse Intent

Extract from the user's request:
- **Strategy type**: map keywords to strategy_type (see Strategy Keyword Mapping below)
- **Instrument**: ticker symbol (e.g., BTCUSDT, AAPL, ETHUSDT)
- **Time range**: start/end dates or relative period (e.g., "last 3 months")
- **Parameters**: any explicit strategy parameters (e.g., RSI period, moving average length)

### Step 2: Fetch Data

Use market_data to ensure historical data is available:
- For crypto: action='crypto_history', symbol, from, to
- For stocks: action='bars', symbol, from, to, timespan='day'
- If the user specifies a relative period ("last 3 months"), compute absolute dates from today

### Step 3: Generate Strategy

Use strategy_lab(action='generate') with:
- description: the user's original intent
- strategy_type: mapped from keywords (or 'auto')
- instrument: extracted symbol
- parameters: any user-specified overrides with {default, min, max}

### Step 4: Run Backtest

Use trading_sim(action='backtest') with:
- strategy_file: the file path returned by strategy_lab
- instrument: the target symbol
- params: { start_date, end_date, bar_type } from the data step

### Step 5: Analyze Results

Interpret the backtest metrics and provide clear assessment:

**Sharpe Ratio thresholds:**
- > 2.0: Excellent risk-adjusted return
- 1.0–2.0: Good, viable for live trading consideration
- 0.5–1.0: Mediocre, needs optimization
- < 0.5: Poor, strategy likely not viable

**Max Drawdown thresholds:**
- < 10%: Conservative, low risk
- 10–20%: Moderate, acceptable for most strategies
- 20–30%: Aggressive, needs risk management
- > 30%: Dangerous, likely unacceptable

**Win Rate context:**
- Win rate alone is not sufficient — combine with profit factor
- Profit factor > 1.5 with win rate > 40% is generally healthy
- High win rate (>70%) with low profit factor may indicate small wins / large losses

### Step 6: Suggest Optimizations

Based on results, suggest concrete next steps:
- If Sharpe < 1.0: suggest parameter tuning (e.g., "try RSI period 21 instead of 14")
- If drawdown > 20%: suggest adding stop-loss or position sizing constraints
- If win rate < 40%: suggest adjusting entry/exit thresholds
- Always offer to re-run with modified parameters

### Strategy Keyword Mapping

| User Keywords | strategy_type | Default Parameters |
|--------------|---------------|-------------------|
| RSI, oversold, overbought, relative strength | momentum | rsi_period: 14, oversold: 30, overbought: 70 |
| moving average, MA, SMA, EMA, crossover, golden cross | trend | fast_period: 10, slow_period: 30 |
| mean reversion, bollinger, bands, revert | mean_reversion | bb_period: 20, bb_std: 2.0 |
| grid, grid trading, range trading | grid | grid_levels: 10, grid_spacing: 0.01 |
| arbitrage, spread, pairs | arbitrage | lookback: 60, z_threshold: 2.0 |
| MACD, signal line, histogram | momentum | fast_period: 12, slow_period: 26, signal_period: 9 |
| breakout, channel, support, resistance | trend | channel_period: 20, breakout_factor: 1.0 |

When no keywords match, use strategy_type='auto' and let strategy_lab detect from the description.

### Default Parameter Inference

When the user omits parameters, apply sensible defaults:
- Crypto instruments: prefer 1h or 4h bars, 3-month lookback
- Stock instruments: prefer daily bars, 6-month lookback
- If no time range specified: default to 3 months for crypto, 6 months for stocks
- Bar type format: "1-HOUR-LAST-EXTERNAL" for hourly, "1-DAY-LAST-EXTERNAL" for daily
`.trim();
