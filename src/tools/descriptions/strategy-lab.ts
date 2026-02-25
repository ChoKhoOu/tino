/**
 * Rich description for the strategy_lab tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const STRATEGY_LAB_DESCRIPTION = `
Generate and validate NautilusTrader trading strategies from natural language descriptions. Uses intelligent template matching and strategy type detection to produce high-quality code with CONFIG_SCHEMA parameter definitions.

## When to Use

- Generating new strategy code from plain-language requirements
- Validating existing strategy code for safety and structure
- Creating strategy skeletons with lifecycle methods (on_start, on_bar, on_stop)
- Checking strategy code for dangerous imports or execution patterns before backtesting

## When NOT to Use

- Running backtests or paper trading (use trading_sim)
- Submitting live orders (use trading_live)
- Fetching market data or fundamentals (use market_data or fundamentals)
- General quant calculations (use quant_compute)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| generate | Generate strategy code from description | description |
| validate | Validate strategy code for safety | code |

## Enhanced Generation Flow

1. Describe intent — provide a natural language description of the desired strategy
2. Select type — use strategy_type (trend/mean_reversion/momentum/grid/arbitrage) or leave as 'auto' for automatic detection
3. Customize params — optionally pass parameters with default/min/max values
4. Generate — AI produces code using matched template as reference, including CONFIG_SCHEMA
5. Validate — built-in safety checks run automatically
6. Backtest — result includes suggestedBacktest params; run trading_sim with action=backtest to validate

## Parameters

- strategy_type: Strategy type hint (trend, mean_reversion, momentum, grid, arbitrage, auto). Defaults to auto which detects from description.
- parameters: Record of parameter overrides, each with { default, min?, max? }. These guide CONFIG_SCHEMA generation.
- instrument: Target instrument symbol (e.g. AAPL, BTCUSDT)
- constraints: Strategy constraints in natural language (e.g. max drawdown 10%)

## Safety Guardrails

- Rejects dangerous imports: os, subprocess, socket, shutil, requests, urllib, pathlib
- Rejects dynamic execution: exec(), eval(), compile(), __import__()
- Requires class inheritance from Strategy
- Warns when required lifecycle methods (on_start, on_bar) are missing

## Usage Notes

- Generated strategies include CONFIG_SCHEMA (JSON Schema 2020-12) for all tunable parameters
- Templates from the templates/ directory are used as few-shot examples when a type is matched
- Returns code, class name, validation results, suggested file path, template used, and backtest suggestion
- Generated code should always be user-reviewed before execution
`.trim();
