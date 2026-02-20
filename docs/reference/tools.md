# Tools Reference

Tino provides 15 consolidated tools that the AI agent uses to research, analyze, trade, and visualize. Tools are discovered automatically at startup from `src/tools/consolidated/`.

## market_data

Retrieve real-time and historical market data including stock prices, OHLCV bars, options chains, and cryptocurrency data from multiple providers (Polygon, Financial Datasets, FMP, CoinGecko, Binance).

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `prices` | Historical stock prices | `symbol` |
| `bars` | OHLCV price bars with custom timespan | `symbol`, `from`, `to` |
| `snapshot` | Live real-time price snapshot (never cached) | `symbol` |
| `options_chain` | Options contracts for an underlying | `symbol` |
| `ticker_details` | Company info from Polygon | `symbol` |
| `crypto_price` | Current crypto spot price | `symbol` |
| `crypto_market_data` | Crypto market stats (cap, volume, supply) | `symbol` |
| `crypto_top_coins` | Top N cryptocurrencies by market cap | `limit` |
| `crypto_history` | Historical crypto prices (daily) | `symbol`, `from`, `to` |
| `funding_rates` | Current perpetual futures funding rates | `symbol` (optional) |
| `funding_rates_history` | Historical funding rates for a symbol | `symbol`, `from`, `to` |

**Notes:** Snapshots are never cached. Crypto data via CoinGecko (free). Funding rates via Binance (free). Price bars support `multiplier` param (e.g., 5-minute bars).

## fundamentals

Access company financial statements, ratios, analyst estimates, insider trades, news, and deep fundamental analysis from Financial Datasets, FMP, and Finnhub.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `income_statement` | Income statements (annual/quarterly) | `symbol` |
| `balance_sheet` | Balance sheets (annual/quarterly) | `symbol` |
| `cash_flow` | Cash flow statements (annual/quarterly) | `symbol` |
| `ratios` | Key financial ratios and metrics | `symbol` |
| `company_facts` | Company profile (sector, industry, employees) | `symbol` |
| `analyst_estimates` | Consensus estimates and price targets | `symbol` |
| `insider_trades` | Insider buying/selling activity | `symbol` |
| `news` | Company-specific news articles | `symbol` |
| `all_financials` | All financial statements combined | `symbol` |
| `deep_dive` | Deep analysis by metric | `symbol`, `metric` |

**Notes:** Provider fallback chain: Financial Datasets -> FMP -> Finnhub. Deep dive metrics: `dcf`, `earnings_transcripts`, `segmented_revenues`, `key_metrics`, `sentiment`.

## filings

Search and retrieve SEC EDGAR filings including full-text search, company submissions history, and structured company facts (XBRL data).

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `search` | Full-text search across EDGAR filings | `query` |
| `submissions` | Company filing history by CIK | `ticker` |
| `company_facts` | Structured XBRL financial facts | `ticker` |

**Notes:** EDGAR is always available (no API key required). Search supports `dateRange` and `formType` filters.

## macro_data

Access FRED (Federal Reserve Economic Data) macroeconomic data including series search, historical observations, and series metadata.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `search` | Search FRED for economic data series | `query` |
| `series` | Get historical observations for a series | `seriesId` |
| `series_info` | Get metadata about a series | `seriesId` |

**Common Series IDs:** `GDP` (Gross Domestic Product), `UNRATE` (Unemployment Rate), `CPIAUCSL` (CPI), `FEDFUNDS` (Fed Funds Rate), `DGS10` (10Y Treasury), `M2SL` (M2 Money Stock).

**Notes:** Requires `FRED_API_KEY`. Series action supports `startDate` and `endDate` filters (YYYY-MM-DD).

## quant_compute

Perform quantitative computations: technical indicators, risk metrics, options pricing, factor analysis, portfolio optimization, correlation analysis, and statistics. All computations run locally -- no API calls.

| Action | Description | Key Inputs |
|--------|-------------|------------|
| `indicators` | Technical analysis (SMA, EMA, RSI, MACD, Bollinger, ATR, Stochastic, OBV, VWAP) | `closes`, `indicator`, `period` |
| `risk` | Risk metrics (Sharpe, Sortino, max drawdown, VaR, CVaR, Calmar, win rate) | `returns`, `riskFreeRate` |
| `options` | Black-Scholes pricing and Greeks (delta, gamma, theta, vega, rho) | `spot`, `strike`, `rate`, `timeToExpiry`, `volatility` |
| `factor` | Fama-French 3-factor regression | `assetReturns`, `marketReturns`, `smbReturns`, `hmlReturns` |
| `portfolio` | Portfolio optimization (Markowitz, min variance, equal weight, risk parity) | `returnsMatrix`, `method` |
| `correlation` | Correlation matrix and rolling correlation | `seriesA`, `seriesB`, `window` |
| `stats` | Descriptive statistics and linear regression | `values`, `xValues` |

**Notes:** No API keys required. All inputs via the `inputs` object. Returns in decimal format (0.01 = 1%).

## trading_sim

Run backtests and paper trading simulations using NautilusTrader via the Tino daemon. No real money at risk.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `backtest` | Run historical simulation | `strategy_file`, `instrument` |
| `paper_trade` | Start simulated live trading | `strategy_file`, `instrument` |
| `positions` | View current simulated positions | none |

**Venues:** `SIM` (default NautilusTrader matching engine), `BINANCE` (testnet). Backtest results include total return, Sharpe ratio, max drawdown, Sortino ratio, win rate, and profit factor.

## trading_live

Submit live trading orders and activate the emergency kill switch. All actions involve **real money** and require explicit user confirmation.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `submit_order` | Submit a live order | `order`, `confirmed=true` |
| `kill_switch` | Cancel all orders, flatten all positions | `confirmed=true` |

**Venues:** `SIM` (default), `BINANCE` (live exchange). All actions require `confirmed=true`. Kill switch flattens all positions across all instruments.

## strategy_lab

Generate and validate NautilusTrader trading strategies from natural language descriptions. Includes safety guardrails.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `generate` | Generate strategy code from description | `description` |
| `validate` | Validate strategy code for safety | `code` |

**Safety guardrails:** Rejects dangerous imports (`os`, `subprocess`, `socket`, `shutil`, `requests`), dynamic execution (`exec()`, `eval()`, `compile()`, `__import__()`), and missing lifecycle methods.

## web_search

Search the web for current information. Supports Exa and Tavily with automatic fallback.

**Params:** `query` (required), `provider` (`auto`/`exa`/`tavily`), `max_results` (default 5), `recency_days`.

**Notes:** Requires `EXASEARCH_API_KEY` or `TAVILY_API_KEY`.

## browser

Control a headless browser to navigate websites and extract information via Playwright.

| Action | Description |
|--------|-------------|
| `navigate` | Load a URL (returns only url/title, no content) |
| `open` | Open URL in a new tab |
| `snapshot` | See page structure with clickable refs |
| `act` | Interact with elements (click, type, press, scroll) |
| `read` | Extract full text content |
| `close` | Free browser resources |

**Workflow:** `navigate` -> `snapshot` -> `act` -> `snapshot` -> `read` -> `close`.

## skill

Load pre-built research workflows. See the [Skills Guide](/guides/skills) for all 9 available skills.

**Params:** `name` (skill name to activate).

## portfolio

View portfolio state: trade history, open positions, PnL tracking, and summary statistics. Read-only.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `summary` | Portfolio overview (trades, positions, PnL, fees) | none |
| `trades` | Trade history with filters | `instrument`, `start_date`, `end_date` (all optional) |
| `positions` | Current open positions with PnL | `instrument` (optional) |
| `pnl_history` | Daily PnL entries over time | `instrument`, `start_date`, `end_date` (all optional) |

**Notes:** All data from local SQLite via gRPC. No external API keys needed.

## chart

Render ANSI charts directly in the terminal. Supports candlestick, line, and subplot charts for OHLCV and time series data.

**Use when:** The user asks to "plot", "chart", "visualize", or "show" price data.

## backtest_history

Query historical backtest results and compare performance across runs. Useful for tracking strategy iterations and identifying improvements over time.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `list` | List past backtest runs with summary stats | none |
| `compare` | Compare performance metrics across multiple runs | `run_ids` |

**Notes:** All data from local SQLite via gRPC. No external API keys needed. Compare action accepts an array of run IDs and returns side-by-side metrics (total return, Sharpe, max drawdown, win rate, profit factor).

## streaming

Subscribe to real-time market data streams via the Tino daemon's WebSocket bridge.

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `subscribe` | Start a real-time data stream | `instrument`, `source`, `event_type` |
| `unsubscribe` | Stop streaming data | `instrument`, `source` |
| `list_subscriptions` | List active subscriptions | none |

**Sources:** `polygon`, `coinbase`, `finnhub`. **Event types:** `quote`, `trade`, `bar`.
