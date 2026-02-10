/**
 * Rich description for the trading_live tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TRADING_LIVE_DESCRIPTION = `
Submit live trading orders and activate the emergency kill switch. ALL actions in this tool involve REAL MONEY and require explicit user confirmation.

## When to Use

- Submitting real live orders (market, limit, stop)
- Emergency stop: kill switch to cancel all orders and flatten all positions
- When the user explicitly requests live/real-money trading

## When NOT to Use

- Backtesting or paper trading (use trading_sim)
- Financial data research (use market_data or fundamentals)
- Strategy code generation (use strategy_lab)
- When the user has NOT explicitly confirmed live trading

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| submit_order | Submit a live order | order, confirmed=true |
| kill_switch | Cancel all orders, flatten all positions | confirmed=true |

## Safety — CRITICAL

- **ALL actions require confirmed=true** — the tool will refuse to execute without it
- **This uses REAL MONEY** — never call without explicit user consent
- **Kill switch is high priority** — if user says "stop", "kill", or "emergency", execute immediately
- **Paper trading is always preferred** — suggest trading_sim unless user explicitly wants live
- Never start live trading without explicit user consent

## Usage Notes

- Requires the Tino daemon to be running
- Order details go in the order object: { instrument, side, type, quantity, price }
- Kill switch flattens ALL positions across ALL instruments
`.trim();
