/**
 * Rich description for the crypto_derivatives tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const CRYPTO_DERIVATIVES_DESCRIPTION = `
Retrieve crypto derivatives data from CoinGlass: multi-exchange funding rates, open interest, long/short ratios, liquidation statistics, and futures-to-spot premium across major exchanges (Binance, OKX, Bybit, etc.).

## When to Use

- Multi-exchange funding rate comparison and history
- Open interest across exchanges (current and historical OHLC)
- Global long/short account ratio history
- Liquidation statistics per exchange or aggregated across exchanges
- Futures-to-spot premium (basis) history

## When NOT to Use

- Single-exchange funding rates from Binance only (use market_data funding_rates)
- Spot crypto prices or market cap (use market_data crypto_price)
- Stock/equity market data (use market_data)
- Macroeconomic data (use macro_data)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| funding_rates | Current funding rates across exchanges | symbol (default BTC) |
| funding_rate_history | Historical funding rate OHLC | exchange, symbol |
| open_interest | Open interest across exchanges | symbol (default BTC) |
| open_interest_history | Historical open interest OHLC | exchange, symbol |
| long_short_ratio | Global long/short account ratio history | exchange, symbol |
| liquidations | Liquidation stats across exchanges | symbol (default BTC) |
| liquidation_history | Aggregated liquidation history | symbol |
| futures_premium | Futures basis (premium) history | symbol |

## Usage Notes

- Requires COINGLASS_API_KEY environment variable
- CoinGlass free tier has rate limits; responses are cached where appropriate
- symbol for exchange-list endpoints uses coin name (BTC, ETH); pair endpoints use trading pair (BTCUSDT)
- interval supports: 1h, 4h, 12h, 1d, 1w (availability depends on plan tier)
- exchange names: Binance, OKX, Bybit, Bitget, dYdX, etc.
- liquidations range supports: 1h, 4h, 12h, 24h
`.trim();
