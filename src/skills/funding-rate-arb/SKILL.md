---
name: funding-rate-arb
description: Use when users ask to analyze funding rate arbitrage opportunities across perpetual futures, including trigger phrases like "funding rate arb", "funding rate arbitrage", "cash and carry trade", "perp basis trade", or "funding rate strategy".
---

# Funding Rate Arbitrage Skill

## Workflow Checklist

Copy and track progress:
```
Funding Rate Arb Progress:
- [ ] Step 1: Fetch current funding rates across major perpetuals
- [ ] Step 2: Identify anomalies vs historical mean
- [ ] Step 3: Generate funding rate arb strategy
- [ ] Step 4: Backtest the strategy using NautilusTrader
- [ ] Step 5: Output analysis report with risk assessment
```

## Step 1: Fetch Current Funding Rates

Use `market_data` with `action: funding_rates` to get current rates across major perpetuals (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, DOT, LINK).

Also fetch recent historical rates with `action: funding_rates_history` for each symbol (default 30-day window) to establish baseline statistics.

Key metrics to extract per symbol:
- Current funding rate (annualized: rate * 3 * 365)
- 30-day mean funding rate
- 30-day standard deviation
- Funding rate trend (rising, falling, stable)
- Mark price for position sizing context

Use `market_data` with `action: crypto_market_data` for each symbol to get volume and liquidity context, which affects execution feasibility.

## Step 2: Identify Anomalies and Opportunities

Compare current rates against historical statistics:
- Flag symbols where current rate > mean + 1.5 standard deviations (elevated)
- Flag symbols where current rate > mean + 2.5 standard deviations (extreme)
- Flag negative funding rates (shorts paying longs -- inverse opportunity)

Rank opportunities by:
1. Annualized yield (funding rate * 3 * 365)
2. Consistency (low std dev = more predictable income)
3. Liquidity (higher volume = better execution)
4. Mean reversion probability (extreme rates tend to normalize)

Use `web_search` for current market context that may explain rate anomalies (liquidation events, exchange-specific flow, market sentiment shifts).

## Step 3: Generate Funding Rate Arb Strategy

The core strategy is cash-and-carry (basis trade):
- When funding rate > threshold: go long spot + short perpetual
- Collect funding payments while delta-neutral
- Exit when funding rate normalizes below exit threshold

Define strategy parameters:
- `funding_rate_threshold`: Entry trigger (e.g., annualized > 15%)
- `exit_threshold`: When to close (e.g., annualized < 5%)
- `position_size_pct`: Capital allocation per trade (e.g., 10% of portfolio)
- `max_positions`: Concurrent pairs limit (e.g., 3)
- `rebalance_interval`: How often to check rates (e.g., every 8h, aligned with funding)

Use `skill` with `strategy-generation` to generate a NautilusTrader strategy file at `strategies/funding_rate_arb.py` if the user wants to proceed to backtest. The strategy should implement:
- Delta-neutral position management (spot long + perp short)
- Automatic entry when funding exceeds threshold
- Automatic exit when funding drops below exit threshold
- Position size based on available capital and max exposure

## Step 4: Backtest the Strategy

Use `skill` with `backtest` to validate the strategy:
- Test period: at least 6 months of historical data
- Include multiple market regimes (trending, ranging, high volatility)
- Track these specific metrics:
  - Cumulative funding income (gross)
  - Transaction costs (entry/exit fees, spread)
  - Net yield after costs
  - Maximum drawdown from basis risk
  - Time in position (capital efficiency)
  - Number of trades and average holding period

Run sensitivity analysis on key parameters:
- Vary `funding_rate_threshold` from 10% to 30% annualized
- Vary `exit_threshold` from 2% to 10% annualized
- Vary `position_size_pct` from 5% to 20%

Use `quant_compute` to compute risk-adjusted metrics (Sharpe, Sortino) on the funding income stream.

## Step 5: Output Analysis Report

Produce a structured report with:

**Opportunity Summary Table:**
- Symbol, current rate, annualized yield, 30d mean, z-score, volume, recommendation

**Strategy Parameters:**
- Optimal thresholds from backtest sensitivity analysis
- Recommended position sizing and max exposure

**Expected Performance:**
- Estimated annualized APY (net of fees)
- Expected max drawdown from basis risk
- Sharpe ratio of funding income stream
- Capital efficiency (time in position / total time)

**Risk Assessment:**
- Basis risk: spot and perp can diverge temporarily
- Liquidation risk: leverage on perp side
- Exchange risk: centralized exchange counterparty
- Rate reversal risk: funding can flip negative
- Execution risk: slippage on entry/exit

**Actionable Next Steps:**
- If backtest looks good: route to `skill` `paper-trade` for live paper validation
- If rates are currently elevated: flag specific entry opportunities
- If rates are currently flat: set up monitoring alerts for rate spikes

Close with confidence level and key assumptions that could invalidate the strategy.
