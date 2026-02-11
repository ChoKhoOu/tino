<p align="center">
  <h1 align="center">Tino</h1>
  <p align="center">
    <strong>AI-Powered Quantitative Trading Workbench</strong>
  </p>
  <p align="center">
    An agentic CLI that researches, builds, backtests, and trades — so you can focus on alpha.
  </p>
  <p align="center">
    <a href="https://www.gnu.org/licenses/gpl-3.0"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3"></a>
    <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun" alt="Bun">
    <img src="https://img.shields.io/badge/engine-NautilusTrader-0d1117" alt="NautilusTrader">
    <img src="https://img.shields.io/badge/AI-Vercel%20AI%20SDK-000000" alt="Vercel AI SDK">
  </p>
  <p align="center">
    <a href="./README.zh-CN.md">简体中文</a>
  </p>
</p>

---

## What is Tino?

Tino is a terminal-native AI agent built for quantitative finance. Ask it a question in plain English — it will pull market data, crunch numbers, generate trading strategies, run backtests, and manage live execution, all from your terminal.

Under the hood, Tino combines a **TypeScript CLI** (Bun + React/Ink) with a **Python daemon** (NautilusTrader), connected via gRPC. A ReAct-style agent loop powered by the Vercel AI SDK orchestrates 14 consolidated tools across 9 financial data providers.

```
 You: "Backtest a momentum strategy on AAPL over the last 2 years"

 Tino: Generating strategy... ✓
       Running backtest via NautilusTrader... ✓
       Sharpe: 1.42 | Max DD: -12.3% | Win Rate: 58%
```

## Features

- **14 Consolidated Tools** — Market data, fundamentals, SEC filings, macro data, quant compute, simulated trading, live trading, strategy lab, portfolio tracking, terminal charts, real-time streaming, web search, browser automation, and skill workflows
- **9 Financial Data Providers** — Polygon, FMP, Financial Datasets, FRED, Finnhub, CoinGecko, SEC EDGAR, EODHD, Binance with automatic fallback chains
- **Portfolio Tracking** — SQLite-backed trade history, positions, daily PnL, and portfolio summaries with daemon restart persistence
- **Terminal Charts** — ANSI candlestick, line, and subplot charts rendered directly in the terminal via plotext
- **Real-Time Streaming** — Live market data via WebSocket (Polygon + Binance) with auto-reconnect and subscription management
- **Binance Exchange** — Spot and USDT-M Futures trading on testnet and mainnet with instrument normalization
- **Local Quant Engine** — Technical indicators, risk metrics, options pricing (Black-Scholes/Greeks), factor analysis (Fama-French), portfolio optimization — all computed locally, no API calls
- **NautilusTrader Backend** — Professional-grade backtesting and live trading engine via gRPC
- **8 Skill Workflows** — Pre-built research pipelines: backtest, comprehensive research, DCF valuation, factor analysis, options analysis, strategy generation, paper trading, live trading
- **Multi-Provider LLM** — OpenAI, Anthropic, Google, xAI, Moonshot, OpenRouter, Ollama, and custom endpoints
- **Rich Terminal UI** — ANSI charts, streaming tickers, interactive input, model switching — built with React/Ink
- **Strategy Lifecycle** — Generate → validate → backtest → paper trade → go live, all guided by AI

## Quick Start

### Binary Install (Recommended)

```bash
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash
```

Prerequisites: [uv](https://docs.astral.sh/uv/) (Python package manager) and at least one LLM API key (OpenAI recommended).

```bash
export OPENAI_API_KEY="sk-..."
tino
```

### From Source (Development)

```bash
# Prerequisites: Bun v1.0+, uv, Python 3.10–3.12
git clone https://github.com/ChoKhoOu/tino.git
cd tino
bun install

export OPENAI_API_KEY="sk-..."
tino
```

> **Note**: Tino automatically creates a global settings file at `~/.tino/settings.json` on first launch.

## Settings

Tino uses a two-tier settings system:

1. **Global Settings** (`~/.tino/settings.json`): Auto-created on first launch. Contains default provider (`openai`) and other user-wide preferences.
2. **Project Settings** (`.tino/settings.json`): Optional. Created in your project directory to override global settings for specific projects.

Project settings take precedence over global settings.

## Architecture

```
┌────────────────────────────┐         gRPC (ConnectRPC)         ┌─────────────────────────┐
│    TypeScript CLI (Bun)    │ ◄───────────────────────────────► │     Python Daemon        │
│                            │         127.0.0.1:50051           │                          │
│  React/Ink TUI             │                                   │  NautilusTrader Engine   │
│  ReAct Agent Loop          │                                   │  Backtest / Paper / Live │
│  14 Tools + 8 Skills       │                                   │  Portfolio (SQLite)      │
│  Multi-Provider LLM        │                                   │  Charts / Streaming      │
│  Portfolio / Charts / Live │                                   │  8 gRPC Services         │
└────────────────────────────┘                                   └─────────────────────────┘
```

**Agent Loop**: `Query → [callModel → executeTools → addToScratchpad → checkContext] × N → streamFinalAnswer`

**Context Management**: 100k token threshold triggers oldest-result clearing. 150k token total budget. The agent runs indefinitely until it has enough information to answer.

## Tools

| Tool | Domain | Description |
|------|--------|-------------|
| `market_data` | Finance | Stock prices, OHLCV bars, options chains, crypto, ticker details |
| `fundamentals` | Finance | Income statements, balance sheets, ratios, analyst estimates, insider trades, news |
| `filings` | Finance | SEC EDGAR full-text search, XBRL company facts |
| `macro_data` | Finance | FRED economic data — GDP, CPI, interest rates, employment |
| `quant_compute` | Quant | Technical indicators, risk metrics, options pricing, factor analysis, portfolio optimization |
| `trading_sim` | Trading | Backtest strategies, paper trade, view positions |
| `trading_live` | Trading | Submit live orders, kill switch (requires explicit confirmation) |
| `strategy_lab` | Strategy | Generate and validate NautilusTrader strategy code |
| `web_search` | Search | Web search via Exa or Tavily |
| `browser` | Browser | Headless browser automation (navigate, read, act) via Playwright |
| `skill` | Workflow | Load pre-built research workflows |
| `portfolio` | Trading | Trade history, positions, PnL tracking, portfolio summaries |
| `chart` | Visualization | ANSI candlestick, line, and subplot charts in the terminal |
| `streaming` | Real-time | Live market data via WebSocket (Polygon, Binance) |

## Skills

Skills are guided multi-step workflows. Type `/skill` in Tino to browse them.

| Skill | What It Does |
|-------|-------------|
| `backtest` | Configure, run, and analyze historical strategy simulations |
| `comprehensive-research` | End-to-end investment analysis combining fundamentals, technicals, and risk |
| `dcf-valuation` | Discounted cash flow analysis to estimate intrinsic value |
| `factor-analysis` | Fama-French factor exposure, style-bias diagnostics, performance attribution |
| `options-analysis` | Options pricing, Greeks, strategy comparison, payoff analysis |
| `strategy-generation` | Generate NautilusTrader strategy code from natural language descriptions |
| `paper-trade` | Simulate live trading without real capital |
| `live-trade` | Deploy strategies with real capital (with safety guardrails) |

## LLM Providers

Default model: `gpt-5.2`. Fast model used for routing/summarization is auto-selected per provider.

| Provider | Model Prefix | API Key |
|----------|-------------|---------|
| OpenAI | _(default)_ | `OPENAI_API_KEY` |
| Anthropic | `claude-` | `ANTHROPIC_API_KEY` |
| Google | `gemini-` | `GOOGLE_API_KEY` |
| xAI | `grok-` | `XAI_API_KEY` |
| Moonshot | `kimi-` | `MOONSHOT_API_KEY` |
| OpenRouter | `openrouter:` | `OPENROUTER_API_KEY` |
| Ollama | `ollama:` | _(local, no key)_ |
| Custom | `custom:name/` | Via `.tino/settings.json` |

Switch models at runtime with `/model <name>`.

## Data Providers

Providers with automatic fallback: Financial Datasets → FMP → Finnhub for fundamental data.

| Provider | API Key | Data |
|----------|---------|------|
| Financial Datasets | `FINANCIAL_DATASETS_API_KEY` | Financial statements, metrics, insider trades, news |
| FMP | `FMP_API_KEY` | Statements, ratios, DCF, prices, earnings transcripts |
| Polygon | `POLYGON_API_KEY` | OHLCV bars, snapshots, ticker details, options chains |
| FRED | `FRED_API_KEY` | GDP, CPI, interest rates, employment, 800k+ series |
| Finnhub | `FINNHUB_API_KEY` | News, sentiment, earnings calendar |
| CoinGecko | _(free)_ | Crypto prices, market data, historical data |
| SEC EDGAR | _(free)_ | EFTS full-text search, XBRL company facts |
| EODHD | `EODHD_API_KEY` | Hong Kong market data |
| Binance | `BINANCE_API_KEY` | Spot and USDT-M Futures trading, real-time WebSocket streams |

## Trading Safety

Safety is non-negotiable in Tino's design:

- **Live Order Confirmation** — All live orders require `confirmed=true` and explicit user consent
- **Kill Switch** — Emergency stop for all active trading
- **Strategy Validation** — Blocks dangerous imports (`os`, `subprocess`, `socket`) and functions (`exec`, `eval`, `__import__`)
- **Sandboxed Execution** — Strategies run in a controlled Python environment
- **Paper Trading First** — The agent always recommends paper trading before going live
- **Testnet Default** — Binance trading defaults to testnet; mainnet requires explicit configuration

## Strategy Templates

Tino ships with ready-to-use strategy templates in `templates/`:

| Template | Description |
|----------|-------------|
| `ema_crossover.py` | Exponential Moving Average crossover strategy |
| `mean_reversion.py` | Mean reversion strategy |
| `momentum.py` | Momentum-based strategy |

Example strategies with more variations are available in `examples/`.

## CLI Commands

| Command | Description |
|---------|-------------|
| `/model [name]` | Switch LLM provider or model |
| `/clear` | Clear conversation context |
| `/skill [name]` | List or activate a skill workflow |
| `/help` | Show available commands |
| `/exit` | Exit Tino |

## Development

```bash
# Start in dev mode (hot reload)
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Run Python daemon manually
cd python && uv run --python 3.12 python -m tino_daemon

# Regenerate Protobuf code
buf generate
```

### Project Structure

```
tino/
├── src/                    # TypeScript CLI (Bun + Ink)
│   ├── index.tsx           # Entry point
│   ├── cli.tsx             # Main Ink component
│   ├── agent/              # ReAct agent loop, prompts, scratchpad
│   ├── runtime/            # Model broker, multi-provider LLM
│   ├── tools/              # 14 consolidated tools + providers
│   ├── grpc/               # gRPC clients (ConnectRPC)
│   ├── daemon/             # Python daemon lifecycle management
│   ├── skills/             # 8 skill workflows (markdown-driven)
│   ├── components/         # Ink TUI components
│   ├── hooks/              # React hooks
│   ├── commands/           # Slash commands
│   └── config/             # Settings, env, constants
├── python/                 # Python daemon
│   └── tino_daemon/        # NautilusTrader gRPC wrapper
├── proto/                  # Protobuf service definitions
│   └── tino/               # trading, data, backtest, daemon, portfolio, chart, streaming services
├── templates/              # Strategy templates (Python)
├── examples/               # Example strategies
└── scripts/                # Release tooling
```

## Environment Variables

Create a `.env` file or export these in your shell:

```bash
# LLM (at least one required)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=
MOONSHOT_API_KEY=
OPENROUTER_API_KEY=

# Data providers (add as needed)
FINANCIAL_DATASETS_API_KEY=
FMP_API_KEY=
POLYGON_API_KEY=
FRED_API_KEY=
FINNHUB_API_KEY=
EODHD_API_KEY=

# Binance (for crypto trading)
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_TESTNET=true

# Search (optional)
EXASEARCH_API_KEY=
TAVILY_API_KEY=

# Custom endpoints (optional)
OPENAI_BASE_URL=
OLLAMA_BASE_URL=

# Tracing (optional)
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=
LANGSMITH_PROJECT=
LANGSMITH_TRACING=
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](./LICENSE) file for details.
