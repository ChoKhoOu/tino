---
name: factor-analysis
description: Use when users ask for factor exposure diagnostics, Fama-French decomposition, style-bias analysis, or performance attribution by systematic factors.
---

# Factor Analysis Skill

## Workflow Checklist

Copy and track progress:
```
Factor Analysis Progress:
- [ ] Step 1: Define asset universe and analysis window
- [ ] Step 2: Gather return series and benchmark context
- [ ] Step 3: Run Fama-French factor regression
- [ ] Step 4: Interpret factor loadings and significance
- [ ] Step 5: Translate exposures into practical actions
```

## Step 1: Define Universe and Window

Confirm target under analysis:
- Single asset, strategy, or portfolio
- Frequency (daily/weekly/monthly)
- Lookback window and sub-periods

State expectations before computation (e.g., growth tilt, quality tilt) so output can validate or challenge priors.

## Step 2: Gather Return Series and Context

Use `financial_research` to collect adjusted price history and compute returns for:
- Target asset/portfolio
- Relevant benchmark index

Ensure data quality:
- Missing values handled
- Corporate actions reflected in adjusted series
- Calendar alignment across series

If regime context is needed, use `financial_research` news/macro events to explain structural shifts.

## Step 3: Run Fama-French Analysis with quant_analysis

Use `quant_analysis` with `run_factor_analysis`.

Expected output components:
- Alpha estimate
- Betas to core factors (e.g., market, size, value, profitability, investment)
- Fit quality and confidence indicators

If available, run rolling-window factor analysis to detect exposure drift over time.

## Step 4: Interpret Loadings and Significance

Interpret each exposure in investment terms:
- Positive/negative sign implications
- Economic meaning of magnitude
- Stability across periods

Separate statistically meaningful effects from noise.

Highlight red flags:
- Unintended concentration in one factor
- Unstable betas across regimes
- Alpha disappearing after factor adjustment

## Step 5: Translate to Actionable Portfolio Decisions

Convert findings into practical guidance:
- Keep exposures that match stated objective
- Reduce unintended factor bets
- Add complementary assets/strategies to rebalance style drift

If optimization is needed, suggest follow-up with `quant_analysis` portfolio optimization while preserving desired factor profile.

Close with:
- Current factor fingerprint
- Main source of return and risk
- Monitoring triggers for re-running factor analysis
