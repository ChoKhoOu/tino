---
name: live-trade
description: Use when users request real-capital execution, production deployment, or activating live orders, including trigger phrases like "go live", "enable live trading", "deploy to production", or "start trading with real money".
---

# Live Trade Skill

## Workflow Checklist

Copy and track progress:
```
Live Trading Progress:
- [ ] Step 1: Verify prerequisites and paper-trade evidence
- [ ] Step 2: Perform pre-live risk and infrastructure checks
- [ ] Step 3: Obtain explicit double confirmation from user
- [ ] Step 4: Start live session with strict limits
- [ ] Step 5: Monitor execution and enforce risk controls
- [ ] Step 6: Keep kill switch ready and test stop path
- [ ] Step 7: Perform post-launch validation and contingency planning
```

## Step 1: Verify Prerequisites and Paper-Trade Evidence

Live deployment is safety-critical. Confirm all prerequisites:
- Strategy exists and is user-reviewed
- Backtest completed with acceptable risk profile
- Paper trading completed with stable behavior
- User understands live trading risks

### Automated Graduation Gate Check (Required)

Before proceeding, run the graduation gate verification using `checkGraduation` from `src/risk/graduation-gates.ts` for the `paper_to_live` stage:

- Paper trading duration >= 14 days
- PnL deviation vs backtest < 30%

Thresholds are configurable via `.tino/settings.json` under `graduationThresholds`.

**If graduation gates fail:** Display the specific failures to the user with measured values and required thresholds. Do NOT proceed to Step 2. Strongly recommend returning to paper trading until gates are met.

**WARNING:** Proceeding without passing graduation gates significantly increases the risk of capital loss. The gates exist to ensure statistical confidence in the strategy before risking real capital.

If paper trading evidence is missing, strongly recommend `skill` `paper-trade` before proceeding.

## Step 2: Pre-Live Risk and Infrastructure Checks

Use `trading_ops` to validate:
- Broker/exchange connectivity health
- Account permissions and balances
- Symbol mapping and order routing
- Position/account state at session start

Define hard controls before launch:
- Max position per symbol
- Max gross exposure
- Max daily loss limit
- Max order rate / runaway guard

Use `financial_research` for near-term catalysts (earnings, macro releases) that can spike slippage and gap risk.

## Step 3: Require Explicit Double Confirmation (Mandatory)

Collect two separate confirmations from user before starting live:

Confirmation A (intent):
- "I confirm I want to start LIVE trading with real capital."

Confirmation B (risk acceptance):
- "I understand losses can occur and accept the configured risk limits."

If either confirmation is missing, ambiguous, or withdrawn, do not start live trading.

## Step 4: Start Live Session with Strict Limits

Use `trading_ops` to start live trading only after confirmations.

Launch mode guidance:
- Begin with reduced sizing (pilot not full allocation)
- Limit number of simultaneously tradable symbols
- Prefer conservative order types during initial ramp

Record active limits and session parameters in the output for auditability.

## Step 5: Monitor Execution and Enforce Risk Controls

Use `trading_ops` live monitoring:
- Open positions and realized/unrealized PnL
- Rejections, partial fills, and latency anomalies
- Exposure and limit utilization

Use `quant_analysis` for ongoing risk checks:
- Intraday drawdown trajectory
- Volatility shock impact
- Concentration and correlation stress

If any hard limit breach occurs, trigger protective actions immediately.

## Step 6: Keep Kill Switch Ready (Mandatory)

The kill switch must be clearly documented and ready at all times:
- Use `trading_ops` with `stop_trading` to halt live activity

Trigger kill switch when:
- Daily loss threshold breached
- Unexpected behavior or repeated execution errors
- Data integrity or connectivity uncertainty
- User requests immediate stop

Never delay stop actions while investigating root cause.

## Step 7: Post-Launch Validation and Contingency Plan

After initial live window:
- Compare observed behavior against paper-trade expectations
- Document slippage and fill-quality deltas
- Reassess limits before scaling allocation

Provide contingency plan:
1. Criteria to continue unchanged
2. Criteria to reduce size
3. Criteria to halt and return to paper testing

End output with current risk state, active limits, and kill-switch readiness reminder.
