# Exchange Setup

Tino supports Binance, OKX, and Bybit for spot and futures trading. This guide covers API key setup, testnet configuration, and verifying your connection.

## Binance

### Create API Keys

1. Log in to [Binance](https://www.binance.com/)
2. Go to **Account** > **API Management**
3. Create a new API key with a descriptive label (e.g., "Tino Trading")
4. Enable **Spot & Margin Trading** and **Futures** permissions
5. Restrict IP access to your machine's IP for security

### Configure in Tino

Set your keys as environment variables:

```bash
export BINANCE_API_KEY="your-api-key"
export BINANCE_API_SECRET="your-api-secret"
```

Or add them to your settings file at `~/.tino/settings.json`:

```json
{
  "providers": {
    "binance": {
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret"
    }
  }
}
```

### Binance Testnet

Binance testnet uses separate API keys from mainnet:

1. Go to [Binance Testnet](https://testnet.binancefuture.com/)
2. Create testnet API keys
3. Set the testnet flag:

```bash
export BINANCE_TESTNET=true
```

## OKX

### Create API Keys

1. Log in to [OKX](https://www.okx.com/)
2. Go to **Account** > **API Management**
3. Create a new API key with a descriptive label (e.g., "Tino Trading")
4. Set a **passphrase** -- OKX requires a passphrase in addition to the API key and secret
5. Enable **Trade** permissions for the account types you need (Spot, Swap, Futures, Margin)
6. Restrict IP access to your machine's IP for security

::: warning
OKX requires three credentials (key, secret, **and passphrase**). Connection will fail if any of the three are missing.
:::

### Configure in Tino

Set your keys as environment variables:

```bash
export OKX_API_KEY="your-api-key"
export OKX_API_SECRET="your-api-secret"
export OKX_PASSPHRASE="your-passphrase"
```

### OKX Demo Trading

OKX provides a demo trading environment (their testnet equivalent):

1. Go to [OKX](https://www.okx.com/) and switch to **Demo Trading** mode
2. Create API keys under demo trading mode
3. Demo trading uses the same environment variables -- the daemon's `testnet` flag routes to the demo environment

::: tip
OKX demo trading provides virtual funds for testing. Always validate your strategies in demo mode before switching to live trading.
:::

## Bybit

### Create API Keys

1. Log in to [Bybit](https://www.bybit.com/)
2. Go to **Account** > **API Management**
3. Create a new API key with a descriptive label (e.g., "Tino Trading")
4. Enable **Trade** permissions for the account types you need (Spot, Linear, Inverse)
5. Restrict IP access to your machine's IP for security

### Configure in Tino

Set your keys as environment variables:

```bash
export BYBIT_API_KEY="your-api-key"
export BYBIT_API_SECRET="your-api-secret"
```

### Bybit Testnet

Bybit provides a dedicated testnet with separate API keys:

1. Go to [Bybit Testnet](https://testnet.bybit.com/)
2. Create testnet API keys
3. Testnet keys use the same environment variables -- the daemon's `testnet` flag routes to the testnet endpoint

::: tip
Bybit testnet provides virtual funds for testing. Create testnet API keys separately from your mainnet keys.
:::

## Testnet vs Mainnet

Tino defaults to **testnet** for safety across all exchanges. No real money is at risk on testnet.

| Exchange | Testnet URL | Notes |
|----------|-------------|-------|
| Binance | [testnet.binancefuture.com](https://testnet.binancefuture.com/) | Separate API keys from mainnet |
| OKX | Demo Trading mode on [okx.com](https://www.okx.com/) | Same site, switch to demo mode |
| Bybit | [testnet.bybit.com](https://testnet.bybit.com/) | Separate API keys from mainnet |

To trade with real capital, explicitly disable testnet:

```bash
export BINANCE_TESTNET=false
```

::: warning
Mainnet trading uses **real money**. Always test your strategies on testnet and paper trading first. See the [Live Trading Guide](/guides/live-trading) for the full graduation workflow.
:::

## Verifying Connection

After setting your API keys, verify the connection in Tino:

```
You: Check my Binance connection status
You: Check my OKX connection status
You: Check my Bybit connection status
```

Or test with a data query:

```
You: What is the current BTC funding rate on Binance?
```

If the connection is working, you'll see live funding rate data from the exchange.

## Data Provider Keys

Beyond exchange connections, Tino uses several data providers for research and analysis. Add keys as needed:

```bash
# Stock market data
export POLYGON_API_KEY="..."              # OHLCV bars, options chains, ticker details
export FMP_API_KEY="..."                  # Financial statements, ratios, DCF
export FINANCIAL_DATASETS_API_KEY="..."   # Statements, insider trades, news

# Macroeconomic data
export FRED_API_KEY="..."                 # GDP, CPI, interest rates (800k+ series)

# Additional providers
export FINNHUB_API_KEY="..."              # News, sentiment, earnings calendar

# Search
export EXASEARCH_API_KEY="..."            # Web search via Exa
export TAVILY_API_KEY="..."               # Web search via Tavily
```

Crypto data from CoinGecko is free and requires no API key.

## Next Steps

- [First Backtest](/getting-started/first-backtest) -- run your first strategy simulation
- [Risk Management](/guides/risk-management) -- configure risk rules before trading
- [Live Trading](/guides/live-trading) -- graduate to paper and live trading
