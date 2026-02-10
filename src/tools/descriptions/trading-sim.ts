/**
 * Rich description for the trading_sim tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const TRADING_SIM_DESCRIPTION = `
Run backtests and paper trading simulations using NautilusTrader via the Tino daemon. View simulated positions and performance metrics. No real money is at risk.

## When to Use

- Running strategy backtests with historical data
- Starting paper trading sessions (simulated live trading)
- Viewing current simulated positions and PnL
- Evaluating strategy performance (return, Sharpe, drawdown, win rate)
- Testing strategy code before going live

## When NOT to Use

- Submitting real live orders (use trading_live)
- Emergency stop / kill switch (use trading_live)
- Financial data research (use market_data or fundamentals)
- Strategy code generation (use strategy_lab)
- General web searches (use web_search)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| backtest | Run historical simulation | strategy_file, instrument |
| paper_trade | Start simulated live trading | strategy_file, instrument |
| positions | View current simulated positions | none |

## Safety

- Paper trading is the default — always prefer this over live trading
- No real money is at risk with any action in this tool
- Backtest results include: total return, Sharpe ratio, max drawdown, Sortino ratio, win rate, profit factor

## Usage Notes

- Requires the Tino daemon to be running
- Strategy files are Python scripts in the project's strategies/ directory
- Streaming operations report progress in real-time via onProgress
- Use params object for additional backtest config (bar_type, start_date, end_date)
`.trim();
