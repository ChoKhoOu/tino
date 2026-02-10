---
name: strategy-generation
description: Use when users ask to create, draft, or optimize a NautilusTrader strategy implementation, including trigger phrases like "generate strategy code", "build a trading strategy", "create NautilusTrader strategy", or "prepare strategy parameters for optimization".
---

# Strategy Generation Skill

## Workflow Checklist

Copy and track progress:
```
Strategy Generation Progress:
- [ ] Step 1: Confirm objective and constraints
- [ ] Step 2: Gather market and signal context
- [ ] Step 3: Design strategy architecture and parameters
- [ ] Step 4: Generate safe NautilusTrader strategy code
- [ ] Step 5: Validate code safety and completeness
- [ ] Step 6: Write code to strategies/<name>.py for user review
- [ ] Step 7: Propose next-step backtest plan
```

## Step 1: Confirm Objective and Constraints

Define instrument universe, timeframe, directionality (long-only, short-only, long/short), and risk style.

Confirm this hard requirement in the plan and in generated code notes:
- Strategy class must extend `nautilus_trader.trading.Strategy`
- Strategy code must be written to `strategies/<name>.py`
- Never execute generated code with `exec()`
- User must review generated code before any run

## Step 2: Gather Market and Signal Context

Call `financial_research` for context inputs:
- Price history and volatility regime
- Market structure clues (trend/range, event windows)
- Symbol-specific considerations (liquidity, session behavior)

Call `quant_analysis` for signal scaffolding:
- Candidate indicators (SMA/EMA/RSI/MACD/Bollinger/ATR)
- Baseline thresholds and lookback ranges
- Initial risk metric targets (drawdown, Sharpe floor)

If useful, call `web_search` and `browser` for high-level strategy references, then adapt to the user constraints rather than copying templates.

## Step 3: Design Strategy Architecture and Parameters

Define strategy interface before coding:
- Instrument identifiers and bar type assumptions
- Signal generation rules
- Entry and exit logic
- Position sizing and risk controls

Define optimization parameters explicitly (required):
- `fast_period`, `slow_period`
- `signal_period` or threshold parameter
- `risk_per_trade_bps`
- `stop_atr_multiple`, `take_profit_atr_multiple`

Give each parameter a default value and valid range so it can be tuned later in backtests.

## Step 4: Generate Safe NautilusTrader Strategy Code

Generate a complete strategy file with a typical target size of 80-120 lines.

Code requirements:
1. Import only approved trading dependencies required for strategy behavior.
2. Define class `YourStrategyName(Strategy)`.
3. Implement lifecycle methods (`on_start`, `on_bar`, optional `on_stop`).
4. Keep state variables explicit and minimal.
5. Add clear parameter definitions suitable for optimization.

Safety rules (strict):
- Do not use dangerous imports: `os`, `subprocess`, `socket`, `shutil`, `pathlib` write utilities, `requests`, or shell execution helpers.
- Do not generate dynamic code execution (`exec`, `eval`, dynamic import tricks).
- Do not embed secrets, API keys, or external side effects.

## Step 5: Validate Code Safety and Completeness

Perform a checklist pass before presenting:
- Class inheritance is `Strategy`
- Entry/exit/risk paths are deterministic
- Parameter names are clear and optimization-ready
- No dangerous imports
- No `exec()` usage
- File path target is `strategies/<name>.py`

If any item fails, revise code before handing to user.

## Step 6: Write Code to Disk and Require User Review

Save code to `strategies/<name>.py` via the trading workflow path (typically through `trading_ops` orchestration, or repository file write flow).

Then explicitly ask user to review:
- Trading logic assumptions
- Risk sizing defaults
- Stop-loss and take-profit behavior
- Symbol/timeframe alignment

Do not trigger backtest or execution automatically from this skill.

## Step 7: Propose Next-Step Backtest Plan

Offer a concrete next action:
- Invoke `skill` with `backtest`
- Validate historical data coverage with `trading_ops`
- Use `quant_analysis` to define evaluation metrics before optimization

Output must end with: generated file path, key parameters, and unresolved assumptions needing user confirmation.
