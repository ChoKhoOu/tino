---
name: options-analysis
description: Use when users ask to price options, evaluate Greeks, compare options strategies, or analyze payoff and risk for calls, puts, spreads, or hedging structures.
---

# Options Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Options Analysis Progress:
- [ ] Step 1: Define options objective and constraints
- [ ] Step 2: Gather options chain and underlying context
- [ ] Step 3: Price contracts and compute Greeks
- [ ] Step 4: Analyze strategy payoff and risk profile
- [ ] Step 5: Provide execution and risk-management guidance
```

## Step 1: Define Objective and Constraints

Confirm user intent first:
- Directional speculation, income, hedge, or event play
- Time horizon and risk budget
- Max acceptable loss and capital usage

Specify candidate structures:
- Single-leg call/put
- Vertical spread
- Covered structure or protective hedge

## Step 2: Gather Chain and Underlying Context

Use `financial_research` to retrieve:
- Underlying spot price and recent volatility behavior
- Full options chain for relevant expiries
- Strike, bid/ask, implied volatility, open interest, volume

Use `financial_research` news/event context (earnings, macro dates) to frame volatility regime and gap risk.

## Step 3: Price Contracts and Greeks with quant_analysis

Use `quant_analysis` `price_option` to estimate theoretical value and Greeks:
- Delta
- Gamma
- Theta
- Vega
- Rho (if rate sensitivity matters)

Compare theoretical values with market mid prices:
- Identify potential overpricing/underpricing zones
- Flag wide-spread or low-liquidity contracts

Use scenario sweeps for underlying price and implied volatility shifts.

## Step 4: Strategy Payoff and Risk Analysis

For each candidate strategy, compute:
- Max gain, max loss, breakeven
- Net premium and capital at risk
- Sensitivity to time decay and volatility crush

Build payoff diagrams across price outcomes at expiry and, when useful, intermediate checkpoints.

Evaluate risk under adverse scenarios:
- Fast move against position
- IV collapse after event
- Liquidity deterioration near expiry

## Step 5: Execution and Risk Management Guidance

Convert analytics into practical guidance:
- Preferred strikes/expiries based on objective
- Position size suggestion tied to risk budget
- Exit rules for profit-taking and stop conditions

Include operational safeguards:
- Avoid low-open-interest contracts when possible
- Respect bid/ask slippage in expected return
- Re-evaluate Greeks after large underlying move

Close with a concise decision table: best candidate, rationale, key risks, and conditions that invalidate the setup.
