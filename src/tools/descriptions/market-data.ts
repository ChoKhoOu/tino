/**
 * Rich description for the market_data tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const MARKET_DATA_DESCRIPTION = `
Retrieve real-time and historical market data including stock prices, OHLCV bars, options chains, and cryptocurrency data from multiple providers (Polygon, Financial Datasets, FMP, CoinGecko, and Python daemon gRPC exchange connectors).

## When to Use

- Stock prices (current snapshots or historical time series)
- OHLCV price bars (minute, hour, day, week, month timeframes)
- Options chain data (available contracts, strikes, expirations)
- Ticker details (company info, exchange, market cap)
- Cryptocurrency prices (current spot price in any fiat currency)
- Crypto market data (market cap, volume, supply, 24h change)
- Top cryptocurrencies by market cap
- Historical crypto price data
- Perpetual futures funding rates (current and historical, from Binance)
- Exchange-native crypto quotes and klines via Python daemon gRPC

## When NOT to Use

- Company financial statements or ratios (use fundamentals)
- Macroeconomic data like GDP or CPI (use macro_data)
- Quantitative computations on price data (use quant_compute)
- General web searches (use web_search)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| prices | Historical stock prices | symbol |
| bars | OHLCV price bars with custom timespan | symbol, from, to |
| snapshot | Live real-time price snapshot (NEVER cached) | symbol |
| options_chain | Options contracts for an underlying | symbol |
| ticker_details | Company info from Polygon | symbol |
| crypto_price | Current crypto spot price | symbol |
| crypto_market_data | Crypto market stats (cap, volume, supply) | symbol |
| crypto_top_coins | Top N cryptocurrencies by market cap | limit |
| crypto_history | Historical crypto prices (daily) | symbol, from, to |
| crypto_exchange_quote | Exchange quote via daemon gRPC | exchange, symbol |
| crypto_exchange_klines | Exchange klines via daemon gRPC | exchange, symbol |
| crypto_exchange_overview | Batch exchange quotes via daemon gRPC | exchange, symbol (comma-separated) |
| crypto_supported_exchanges | Exchanges supported by daemon | none |
| funding_rates | Current perpetual futures funding rates | symbol (optional, comma-separated) |
| funding_rates_history | Historical funding rates for a symbol | symbol, from, to |

## Usage Notes

- Snapshots are NEVER cached — always returns real-time data
- Historical data is cached to avoid redundant API calls
- Crypto actions use CoinGecko (FREE, no API key needed)
- Price bars support multiplier param (e.g., multiplier=5 with timespan=minute for 5-min bars)
- Options chain can filter by expiration_date
- Funding rate actions use Binance Futures (FREE, no API key needed)
- crypto_exchange_* actions route through Python daemon exchange adapters
- funding_rates with no symbol returns top-10 major perpetuals (BTC, ETH, SOL, etc.)
- funding_rates_history defaults to last 30 days if from/to not specified
`.trim();
