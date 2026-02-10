/**
 * Rich description for the trading_ops tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TRADING_OPS_DESCRIPTION = `
Intelligent meta-tool for quantitative trading operations. Routes natural language queries to the Tino trading daemon (NautilusTrader) for data management, backtesting, and live/paper trading. Requires the Tino daemon to be running.

## When to Use

- Data ingestion: downloading and cataloging market data (e.g., "ingest AAPL daily data for 2024")
- Catalog management: listing available data in the local catalog
- Backtesting: running strategy backtests with performance metrics (return, Sharpe, drawdown, win rate)
- Paper trading: starting simulated trading sessions with a strategy
- Live trading: starting real-money trading sessions (requires explicit confirmation)
- Position monitoring: querying current open positions and PnL
- Order history: viewing past and pending orders
- Emergency stop: kill switch to cancel all orders and flatten positions

## When NOT to Use

- For financial data research or analysis (use financial_search instead)
- For general web searches (use web_search instead)
- When the Tino daemon is not running
- For strategy code writing or editing (handle directly)

## Safety

- **Paper trading is the default** — always prefer paper trading unless the user explicitly requests live trading
- **Live trading requires confirmation** — the user must explicitly confirm before real money is at risk
- **Kill switch is high priority** — if the user says "stop", "kill", or "emergency", execute immediately
- Never start live trading without explicit user consent

## Usage Notes

- Call ONCE with the complete natural language query — routing is handled internally
- The daemon must be running (started automatically or via \`tino init\`)
- Strategy files are Python scripts in the project's strategies directory
- Backtest results include Sharpe ratio, max drawdown, win rate, profit factor, and more
- Streaming operations (backtest, trading) report progress in real-time
`.trim();
