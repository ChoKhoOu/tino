export const PORTFOLIO_DESCRIPTION = `
View portfolio state including trade history, open positions, PnL tracking, and summary statistics. All data is queried from the local portfolio database via gRPC — no external API calls.

## When to Use

- Reviewing trade history for a specific instrument or time range
- Checking current open positions and unrealized PnL
- Analyzing daily PnL trends over time
- Getting a portfolio summary (total trades, fees, PnL)
- Evaluating strategy performance after backtests or paper trading
- Viewing aggregated balances and positions across all connected exchanges
- Checking total portfolio value and asset distribution across exchanges

## When NOT to Use

- Executing new trades (use trading_sim or trading_live)
- Running backtests (use trading_sim)
- Looking up market data or prices (use market_data)
- Generating strategy code (use strategy_lab)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| summary | Portfolio overview: total trades, open positions, realized/unrealized PnL, fees | none |
| trades | Trade history with optional filters | instrument (optional), start_date (optional), end_date (optional), limit (optional) |
| positions | Current open positions with PnL | instrument (optional) |
| pnl_history | Daily PnL entries over time | instrument (optional), start_date (optional), end_date (optional) |
| cross_exchange_summary | Aggregated balances across all connected CEX exchanges (Binance, Bybit, OKX, Bitget) with total value and distribution percentages | none |
| cross_exchange_positions | Aggregated open positions across all connected exchanges with total unrealized PnL | none |

## Safety Notes

- This tool is read-only — it cannot modify positions or submit orders
- Requires the Tino daemon to be running with the portfolio service enabled
- Local portfolio data comes from SQLite via gRPC, no external API keys needed
- Cross-exchange actions query live exchange APIs via gRPC and require valid API credentials per exchange
`.trim();
