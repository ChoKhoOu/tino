/**
 * Rich description for the funding_rate_arbitrage tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const FUNDING_RATE_ARBITRAGE_DESCRIPTION = `
Multi-exchange funding rate arbitrage analysis tool. Scans funding rates across exchanges (Binance, OKX, Bybit, etc.), identifies arbitrage opportunities from rate differentials, backtests historical performance, and provides AI-ready analysis with risk/reward metrics.

Strategy: short perpetual on high-rate exchange + long perpetual on low-rate exchange, collecting the funding rate differential every 8h settlement.

## When to Use

- Compare funding rates across exchanges for the same token
- Find the best funding rate arbitrage opportunities
- Backtest how a funding rate arbitrage strategy would have performed
- Get a comprehensive analysis of a specific arbitrage opportunity with fees and risk metrics

## When NOT to Use

- Single-exchange funding rate lookup (use crypto_derivatives funding_rates)
- Spot trading or non-perpetual futures (use market_data)
- Executing actual trades (this is analysis-only)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| scan_rates | Fetch current funding rates from multiple exchanges | symbols (optional, defaults to top-10) |
| find_opportunities | Identify Top-N arbitrage opportunities by rate differential | symbols (optional), top_n (optional, default 10) |
| backtest | Backtest historical arbitrage returns between two exchanges | symbol, exchange_long, exchange_short, days (optional, default 30) |
| analyze | Comprehensive analysis with current rates, backtest, fees, risk | symbol, exchange_long, exchange_short, days (optional, default 30) |

## Usage Notes

- Uses CoinGlass API (COINGLASS_API_KEY) for multi-exchange data when available; falls back to direct Binance/OKX/Bybit public APIs
- Funding rate settlement occurs every 8 hours (3× per day) on most exchanges
- Fee estimates use default perpetual futures taker rates; actual fees depend on VIP tier
- Annualized spread = rate differential × 3 × 365
- Risk levels: low (<20% annualized), medium (20-50%), high (>50% — may indicate abnormal conditions)
- MVP: analysis and backtest only, does NOT execute trades
- Backtest uses actual historical settlement rates from exchange APIs
`.trim();
