# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-25

### Core Platform

- AI-powered quantitative trading CLI workbench with TypeScript (Bun + React/Ink) frontend and Python (NautilusTrader) daemon backend
- ReAct-style agent loop powered by Vercel AI SDK with 14 consolidated tools
- gRPC (ConnectRPC) communication between CLI and daemon on `127.0.0.1:50051`
- Context management with 100k token compaction threshold and 150k token budget
- Multi-provider LLM support: OpenAI, Anthropic, Google, xAI, Moonshot, OpenRouter, Ollama, and custom endpoints
- Two-tier settings system (global `~/.tino/settings.json` + project `.tino/settings.json`)
- Plugin system with SDK, documentation, and example plugins

### Financial Data Providers

- **Polygon** — OHLCV bars, snapshots, ticker details, options chains, real-time WebSocket streaming
- **FMP** — Financial statements, ratios, DCF, prices, earnings transcripts
- **Financial Datasets** — Financial statements, metrics, insider trades, news
- **FRED** — GDP, CPI, interest rates, employment, 800k+ economic series
- **Finnhub** — News, sentiment, earnings calendar
- **CoinGecko** — Crypto prices, market data, historical data
- **CoinGlass** — Crypto derivatives data (funding rates, open interest, liquidations)
- **Binance** — Spot and USDT-M Futures trading, real-time WebSocket streams
- **Bybit** — Public API data provider with WebSocket streaming
- **OKX** — Public API data provider with WebSocket streaming
- **Gate.io** — V4 public API data provider
- **KuCoin** — Public API data provider
- **Bitget** — Data provider and exchange adapter
- Automatic fallback chains: Financial Datasets -> FMP -> Finnhub for fundamental data
- Unified market data flow to Python daemon with new gRPC methods

### Exchange & Trading

- **Multi-exchange support** — Binance, Bybit, OKX, Bitget with BaseExchangeConnector adapters
- **Hummingbot CEX connectors** integration with adapter layer
- **Cross-exchange portfolio summary** with aggregated balances and positions
- **Perpetual contract support** with full lifecycle management
- **Advanced order types** — Take-Profit/Stop-Loss (TP/SL) and trailing stop orders
- **Paper trading engine** with 7x24 stable operation
- **Live trading** with explicit confirmation gate and kill switch
- **Testnet default** — Binance trading defaults to testnet; mainnet requires explicit configuration
- SQLite-backed trade history, positions, daily PnL, and portfolio summaries with daemon restart persistence

### Backtesting

- NautilusTrader-powered professional-grade backtesting engine
- Natural language backtest orchestration flow
- Backtest parameter grid search engine
- Backtest SQLite persistence and history tracking
- AI-enhanced strategy generation with template matching

### Strategy System

- Strategy base class with `CONFIG_SCHEMA` and `Signal` dataclass
- **EMA Crossover** — Exponential Moving Average crossover strategy
- **Mean Reversion** — Mean reversion strategy
- **Momentum** — Momentum-based strategy
- **RSI Momentum** — RSI-based momentum strategy template
- **Grid Trading** — Grid trading strategy template
- **MA Crossover** — Moving average trend following strategy template
- **Bollinger Band** — Bollinger Band mean reversion strategy template
- **DCA** — Dollar-cost averaging strategy
- **Market Making** — Basic market making strategy
- **Pairs Trading** — Pairs trading strategy with cointegration analysis
- **Funding Rate Arbitrage** — Funding rate arbitrage strategy with real trading signals
- Strategy safety validation blocking dangerous imports (`os`, `subprocess`, `socket`, `exec`, `eval`)

### Quantitative Analysis

- Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, etc.)
- Risk metrics (Sharpe ratio, Sortino ratio, max drawdown, VaR, CVaR)
- Options pricing (Black-Scholes model, Greeks computation)
- Portfolio optimization (mean-variance, efficient frontier)
- Anomaly detection engine with statistical methods
- AI risk advisor with proactive risk monitoring

### User Interface

- Rich terminal UI built with React/Ink
- ANSI candlestick, line, and subplot charts rendered via plotext
- Dashboard layout with Ctrl+D toggle and real-time data panels
- Command palette with Ctrl+P shortcut
- Dark theme system with crypto-dark preset
- First-run onboarding flow
- Slash command UX (`/model`, `/skill`, `/clear`, `/help`, `/exit`)
- Streaming tickers, interactive input, model switching
- Fox brand indicator and ASCII fox mascot logo
- Status line, verbose toggle, thinking toggle, and context visualization

### Skills & Workflows

- **Backtest** — Configure, run, and analyze historical strategy simulations
- **Comprehensive Research** — End-to-end investment analysis combining fundamentals, technicals, and risk
- **DCF Valuation** — Discounted cash flow analysis to estimate intrinsic value
- **Options Analysis** — Options pricing, Greeks, strategy comparison, payoff analysis
- **Strategy Generation** — Generate NautilusTrader strategy code from natural language
- **Paper Trade** — Simulate live trading without real capital
- **Live Trade** — Deploy strategies with real capital (with safety guardrails)

### Tools

- `market_data` — Stock prices, OHLCV bars, options chains, crypto, ticker details
- `fundamentals` — Income statements, balance sheets, ratios, analyst estimates, insider trades, news
- `macro_data` — FRED economic data (GDP, CPI, interest rates, employment)
- `quant_compute` — Technical indicators, risk metrics, options pricing, portfolio optimization
- `trading_sim` — Backtest strategies, paper trade, view positions
- `trading_live` — Submit live orders, kill switch (requires explicit confirmation)
- `strategy_lab` — Generate and validate NautilusTrader strategy code
- `web_search` — Web search via Exa or Tavily
- `browser` — Headless browser automation via Playwright
- `skill` — Load pre-built research workflows
- `portfolio` — Trade history, positions, PnL tracking, portfolio summaries
- `chart` — ANSI candlestick, line, and subplot charts in the terminal
- `streaming` — Live market data via WebSocket (Polygon, Binance)
- `backtest_history` — Historical backtest results and comparison

### Notifications

- Telegram notification integration for trade alerts and system events

### Infrastructure

- Dockerized Python daemon with multi-stage build and CI
- GitHub issue management system with templates and auto-labeling
- Biome linter configuration
- Comprehensive test suite with 160+ tests across core modules
- Core path pytest coverage with coverage reporting
- gRPC health check RPC with sub-service readiness

### Developer Experience

- Auto-checkpoint and checkpoint restore/diff system
- Permission modes, background tasks, agent configuration
- Built-in agents (build, plan, explore, general, compaction)
- Post-edit LSP diagnostics for Edit and Write tools
- Tabbed permission dialog, rewind menu, delegate mode UI
- Fullscreen fixed-zone layout with scrollable content area

[1.0.0]: https://github.com/ChoKhoOu/tino/releases/tag/v1.0.0
