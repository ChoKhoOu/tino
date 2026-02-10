/**
 * Rich description for the strategy_lab tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const STRATEGY_LAB_DESCRIPTION = `
Generate and validate NautilusTrader trading strategies from natural language descriptions. Includes built-in safety guardrails that reject dangerous imports and dynamic execution patterns.

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

## Safety Guardrails

- Rejects dangerous imports: os, subprocess, socket, shutil, requests, urllib, pathlib
- Rejects dynamic execution: exec(), eval(), compile(), __import__()
- Requires class inheritance from Strategy
- Warns when required lifecycle methods (on_start, on_bar) are missing

## Usage Notes

- Generate accepts optional instrument and constraints params
- Returns code, class name, validation results, and suggested file path
- Generated code should always be user-reviewed before execution
- Validation returns pass/fail with detailed error messages
`.trim();
