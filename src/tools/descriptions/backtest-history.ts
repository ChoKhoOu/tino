/**
 * Rich description for the backtest_history tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const BACKTEST_HISTORY_DESCRIPTION = `
Query historical backtest results stored by the daemon. List past runs, retrieve full details by ID, or compare two backtests side by side.

## When to Use

- List all previously completed backtest results
- Retrieve detailed metrics and trade log for a specific backtest
- Compare performance of two different backtest runs (strategies, parameters, instruments)

## When NOT to Use

- Running a new backtest (use trading_sim with action 'backtest')
- Live or paper trading (use trading_sim or trading_live)
- Fetching raw market data (use market_data)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| list_results | List all stored backtest results with summary metrics | — |
| get_result | Get full details for a single backtest by ID | id |
| compare | Side-by-side comparison of two backtest results | ids (array of 2 IDs) |

## Usage Notes

- list_results returns summary metrics (return, sharpe, drawdown, win rate) for each run
- get_result includes full equity curve and trade log JSON
- compare computes deltas for key metrics: total_return, sharpe_ratio, max_drawdown, win_rate, profit_factor
- All actions are read-only and safe to call at any time
`.trim();
