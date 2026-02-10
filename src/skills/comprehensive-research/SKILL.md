---
name: comprehensive-research
description: Use when users ask for end-to-end investment analysis that combines fundamentals, technicals, and quantitative risk assessment, including trigger phrases like "full research", "comprehensive analysis", "analyze this stock deeply", or "build a complete investment view".
---

# Comprehensive Research Skill

## Workflow Checklist

Copy and track progress:
```
Comprehensive Research Progress:
- [ ] Step 1: Define research scope and decision horizon
- [ ] Step 2: Gather fundamental context with financial_research
- [ ] Step 3: Run technical structure analysis with quant_analysis
- [ ] Step 4: Run quantitative risk and performance diagnostics
- [ ] Step 5: Synthesize evidence into scenario-based thesis
- [ ] Step 6: Provide decision framework and monitoring plan
```

## Step 1: Define Scope and Decision Horizon

Clarify target asset, benchmark, horizon (swing, medium-term, long-term), and risk tolerance.

Set output objective:
- Investment thesis quality check
- Entry/exit planning support
- Portfolio role assessment

## Step 2: Fundamental Context via financial_research

Use `financial_research` to gather:
- Revenue, margins, cash flow quality
- Balance sheet strength and leverage
- Valuation context (multiples, growth vs price)
- Filings/news catalysts and management commentary

Capture both strengths and fragilities:
- Business moat durability
- Earnings quality concerns
- Macro sensitivity and sector cyclicality

If helpful, enrich with `web_search` and `browser` for latest public context and source triangulation.

## Step 3: Technical Structure via quant_analysis

Use `quant_analysis` technical indicators to characterize market behavior:
- Trend state: SMA/EMA structure and slope
- Momentum: RSI/MACD confirmation or divergence
- Volatility envelope: Bollinger and ATR dynamics
- Support/resistance and breakout context

Translate indicators into regime labels:
- Trend continuation
- Mean reversion
- Transition/chop

## Step 4: Quantitative Risk Diagnostics

Use `quant_analysis` risk metrics for objective downside framing:
- Historical volatility
- Max drawdown and drawdown duration
- Sharpe/Sortino for risk-adjusted profile
- VaR or tail-risk proxy when appropriate

If portfolio context is provided, evaluate fit:
- Correlation and diversification effect
- Position sizing implications
- Contribution to portfolio drawdown risk

## Step 5: Synthesize into Scenario-Based Thesis

Build one integrated view from fundamental, technical, and risk evidence.

Provide at least three scenarios:
1. Bull case with conditions that must hold
2. Base case with most likely path
3. Bear case with invalidation triggers

For each scenario include:
- Key drivers
- Observable confirmation signals
- Risk controls or hedging ideas

Resolve contradictions explicitly (e.g., strong fundamentals but weak technicals).

## Step 6: Decision Framework and Monitoring Plan

Produce actionable but non-deterministic guidance:
- Watchlist conditions for entry
- Conditions for reducing exposure
- Conditions for thesis invalidation

Set monitoring cadence and metrics:
- Fundamental checkpoints (earnings, revisions, balance sheet changes)
- Technical checkpoints (trend break, volatility regime shift)
- Risk checkpoints (drawdown threshold, correlation spike)

Close with confidence level, top uncertainties, and what new data would most likely change the conclusion.
