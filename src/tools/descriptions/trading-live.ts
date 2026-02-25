/**
 * Rich description for the trading_live tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TRADING_LIVE_DESCRIPTION = `
Submit live trading orders, set take-profit/stop-loss, trailing stops, and activate the emergency kill switch. ALL actions in this tool involve REAL MONEY and require explicit user confirmation.

## When to Use

- Submitting real live orders (market, limit, stop)
- Setting take-profit and stop-loss (TP/SL) on positions
- Placing trailing stop orders to lock in profits
- Placing conditional stop orders
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
| submit_order | Submit a live order | order{instrument, side, type, quantity, price}, confirmed=true |
| place_tp_sl | Set take-profit and/or stop-loss | order{symbol, side, quantity, tp_price, sl_price}, confirmed=true |
| place_trailing_stop | Place a trailing stop order | order{symbol, side, quantity, callback_rate}, confirmed=true |
| place_stop_order | Place a conditional stop order | order{symbol, side, quantity, stop_price}, confirmed=true |
| kill_switch | Cancel all orders, flatten all positions | confirmed=true |

## Venue Parameter

| Venue | Description |
|-------|-------------|
| SIM | Default simulated venue (NautilusTrader internal matching engine) |
| BINANCE | Binance live exchange for real trading |
| OKX | OKX live exchange for real trading |

- Default venue is SIM when not specified (backward compatible)
- BINANCE venue requires BINANCE_API_KEY and BINANCE_API_SECRET environment variables
- OKX venue requires OKX_API_KEY, OKX_API_SECRET, OKX_PASSPHRASE environment variables
- Live venues connect to real exchanges — REAL MONEY at risk

## Safety — CRITICAL

- **ALL actions require confirmed=true** — the tool will refuse to execute without it
- **This uses REAL MONEY** — never call without explicit user consent
- **Kill switch is high priority** — if user says "stop", "kill", or "emergency", execute immediately
- **Paper trading is always preferred** — suggest trading_sim unless user explicitly wants live
- Never start live trading without explicit user consent

## Usage Notes

- Requires the Tino daemon to be running
- Order details go in the order object: { instrument/symbol, side, type, quantity, price }
- Kill switch flattens ALL positions across ALL instruments
- TP/SL: at least one of tp_price or sl_price should be provided; side is the position side (BUY/SELL)
- Trailing stop: callback_rate is the percentage retracement (e.g. 1.0 = 1%); activation_price is optional
- Stop order: stop_price triggers the order; price is optional (omit for stop-market, include for stop-limit)
- Natural language examples: "BTC TP 70000 SL 60000", "trailing stop 1% on ETH", "stop order BTC at 55000"
`.trim();
