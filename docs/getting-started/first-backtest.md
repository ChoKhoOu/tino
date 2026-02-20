# First Backtest

This guide walks you through running your first strategy backtest in Tino.

## Initialize a Project

Create a project directory and initialize Tino configuration:

```bash
mkdir my-trading-project
cd my-trading-project
tino
```

On first launch in a new directory, Tino creates a `.tino/` folder with project-level settings.

## Ask the AI to Backtest

The simplest way to run a backtest is to describe what you want in plain English:

```
You: Backtest a BTC momentum strategy over the last year
```

Tino will:

1. Generate a NautilusTrader momentum strategy via the `strategy_lab` tool
2. Validate the strategy code for safety (no dangerous imports)
3. Run the backtest via the `trading_sim` tool using the NautilusTrader daemon
4. Return performance metrics

## Understanding the Results

Tino displays key performance metrics after each backtest:

| Metric | What It Means | Good Range |
|--------|--------------|------------|
| **Total Return** | Overall profit/loss percentage | Positive |
| **Sharpe Ratio** | Risk-adjusted return (return per unit of volatility) | > 1.0 |
| **Max Drawdown** | Largest peak-to-trough decline | < -20% |
| **Sortino Ratio** | Like Sharpe but only penalizes downside volatility | > 1.5 |
| **Win Rate** | Percentage of profitable trades | > 50% |
| **Profit Factor** | Gross profit / gross loss | > 1.5 |

## Example: EMA Crossover on ETH

```
You: Backtest an EMA crossover strategy on ETHUSDT with a 12/26 period
     over the last 6 months using 1-hour bars
```

Tino generates a strategy that:
- Enters long when the 12-period EMA crosses above the 26-period EMA
- Exits when the 12-period EMA crosses below the 26-period EMA
- Uses the NautilusTrader backtesting engine for accurate fills

## Using the Backtest Skill

For a more structured workflow, use the backtest skill:

```
You: /skill backtest
```

The skill guides you through:
1. Strategy selection or generation
2. Instrument and timeframe configuration
3. Backtest execution
4. Result analysis and parameter sensitivity

## Iterating on Results

After seeing backtest results, ask Tino to refine the strategy:

```
You: The drawdown is too high. Can you add a stop loss at 2%
     and re-run the backtest?
```

```
You: Try the same strategy on SOLUSDT and BNBUSDT too
```

## Next Steps

- [Exchange Setup](/getting-started/exchange-setup) -- connect to Binance for real market data
- [Skills Guide](/guides/skills) -- explore all 9 pre-built research workflows
- [Live Trading Guide](/guides/live-trading) -- graduate from backtest to paper to live
