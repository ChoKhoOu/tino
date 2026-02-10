---
name: paper-trade
description: Use when users ask to simulate live execution without real capital, including trigger phrases like "start paper trading", "run strategy in simulation", "monitor paper account", or "prepare for live deployment".
---

# Paper Trade Skill

## Workflow Checklist

Copy and track progress:
```
Paper Trading Progress:
- [ ] Step 1: Confirm backtest readiness and deployment scope
- [ ] Step 2: Configure paper trading environment
- [ ] Step 3: Start paper trading session with safeguards
- [ ] Step 4: Monitor positions, orders, and risk drift
- [ ] Step 5: Set alerts and review cadence
- [ ] Step 6: Evaluate readiness for live transition
```

## Step 1: Confirm Backtest Readiness and Scope

Before paper trading, verify strategy already passed backtest review.

Required checks:
- Strategy file exists (`strategies/<name>.py`)
- Recent backtest metrics are acceptable (risk-adjusted returns and drawdown)
- User agrees on symbols, timeframe, and expected behavior

If no valid backtest exists, invoke `skill` with `backtest` first.

## Step 2: Configure Paper Trading Environment

Use `trading_ops` to set simulation parameters:
- Paper account capital
- Allowed instruments and max position sizes
- Order type constraints
- Session schedule and market hours

Use `financial_research` for current market context (earnings/events) so the user knows what regime the paper run starts in.

## Step 3: Start Paper Trading Session with Safeguards

Launch paper trading via `trading_ops`.

At launch, verify:
- Strategy loaded correctly
- Orders route to simulated environment only
- No live broker endpoint is active
- Initial risk limits are enforced

If any safety check fails, stop immediately and correct configuration before restart.

## Step 4: Monitor Positions, Orders, and Risk Drift

Use `trading_ops` to monitor continuously:
- Open positions and exposure
- Pending/filled/cancelled orders
- Realized and unrealized PnL
- Rule violations (if any)

Use `quant_analysis` on paper-trade performance snapshots to check drift from backtest expectations:
- Volatility and drawdown profile
- Win/loss distribution changes
- Slippage sensitivity hints

## Step 5: Set Alerts and Review Cadence

Configure practical alert thresholds through workflow orchestration:
- Max daily drawdown breach
- Position limit breach
- Abnormal order rejection burst
- Unexpected strategy inactivity

Define review cadence with user:
- Intraday checks for active systems
- Daily risk and trade quality review
- Weekly performance consistency review

## Step 6: Evaluate Readiness for Live Transition

Summarize paper trading outcomes with explicit go/no-go criteria:
- Stability across multiple sessions
- Risk controls working as intended
- Behavior close to backtest assumptions

Safety warnings (required):
- Paper fills can be unrealistically favorable
- Live latency and slippage can degrade edge
- Psychological pressure differs with real capital

Do not transition to live automatically. Recommend invoking `skill` with `live-trade` only after user explicitly accepts residual risk and confirms readiness.
