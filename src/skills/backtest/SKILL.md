---
name: backtest
description: Use when users ask to run, configure, evaluate, or improve historical strategy simulations, including trigger phrases like "run backtest", "test strategy", "optimize parameters", "analyze backtest results", or "why did this strategy underperform".
---

# Backtest Skill

## Workflow Checklist

Copy and track progress:
```
Backtest Progress:
- [ ] Step 1: Validate strategy artifact and assumptions
- [ ] Step 2: Verify and ingest historical data
- [ ] Step 3: Configure backtest environment and parameters
- [ ] Step 4: Execute backtest with trading_ops
- [ ] Step 5: Analyze performance and risk metrics
- [ ] Step 6: Diagnose weaknesses and failure modes
- [ ] Step 7: Recommend concrete strategy improvements
```

## Step 1: Validate Strategy Artifact and Assumptions

Confirm strategy file exists and is review-approved:
- Expected path: `strategies/<name>.py`
- Strategy should already extend `nautilus_trader.trading.Strategy`
- Ensure parameter list is explicit for tuning

If strategy is missing or incomplete, invoke `skill` with `strategy-generation` first.

Capture required assumptions:
- Symbols and asset classes
- Bar interval/timeframe
- Trading session boundaries
- Fee/slippage model expectations

## Step 2: Verify and Ingest Historical Data

Use `trading_ops` to inspect data availability for each symbol/timeframe.

If data is missing or stale:
- Use `trading_ops` data ingestion to fetch required range
- Confirm timezone/session normalization
- Confirm corporate actions handling where relevant

Use `financial_research` to cross-check major market events in the period so result interpretation has context.

## Step 3: Configure Backtest Environment and Parameters

Define a reproducible configuration:
- Start and end dates
- Initial capital
- Commission/fees and slippage assumptions
- Position sizing and max exposure constraints

Define experiment sets:
- Baseline run with default parameters
- Sensitivity runs across key parameters
- Optional walk-forward slices for robustness

Keep configuration explicit in output so runs can be repeated exactly.

## Step 4: Execute Backtest with trading_ops

Run backtest through `trading_ops` and capture full outputs:
- Equity curve and returns series
- Trade list and fill stats
- Exposure and turnover metrics
- Drawdown timeline

If execution fails, report root cause precisely (data gaps, config mismatch, invalid params) and rerun only after correction.

## Step 5: Analyze Performance and Risk Metrics

Use `quant_analysis` to compute and interpret:
- CAGR/total return
- Sharpe and Sortino
- Max drawdown and drawdown duration
- Win rate, profit factor, expectancy
- Volatility and tail risk proxies (VaR if needed)

Compare baseline against sensitivity runs to identify parameter fragility.

## Step 6: Diagnose Weaknesses and Failure Modes

Segment results by regime where possible:
- Trending vs range-bound periods
- High vs low volatility windows
- Event-heavy intervals

Identify specific failure signatures:
- Overtrading during chop
- Late entries in fast trends
- Stops too tight or too loose
- Excess concentration risk

Use `financial_research` event context and `quant_analysis` diagnostics together before concluding root causes.

## Step 7: Recommend Concrete Improvements

Provide ranked improvement plan with expected impact and risk:
1. Parameter adjustments (with tested ranges)
2. Signal filters (e.g., volatility or trend filter)
3. Risk control upgrades (exposure caps, ATR-based sizing)
4. Execution assumptions refinement (slippage realism)

For each recommendation, include:
- Why it addresses observed weakness
- How to test it in the next iteration
- What metric should improve if hypothesis is correct

Close with a proposed next run matrix and, if needed, route to `skill` `paper-trade` after acceptable backtest stability.
