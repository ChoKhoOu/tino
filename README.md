# Tino

Tino is an AI-powered quantitative trading workbench. It performs financial research and analysis using task planning, self-reflection, and real-time market data. Built on top of [Dexter](https://github.com/virattt/dexter) with additional quantitative trading capabilities.

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [👋 Overview](#-overview)
- [⚡ Quick Start](#-quick-start)
- [🏗️ Architecture](#-architecture)
- [✨ Features](#-features)
- [🔑 Data Source Configuration](#-data-source-configuration)
- [🤖 Custom LLM Setup](#-custom-llm-setup)
- [📈 Strategy Development](#-strategy-development)
- [🛡️ Trading Safety](#-trading-safety)
- [💻 CLI Commands](#-cli-commands)
- [🛠️ Development](#-development)
- [🌍 Environment Variables](#-environment-variables)
- [🤝 Credits](#-credits)

## 👋 Overview

Tino takes complex financial questions and turns them into clear, step-by-step research plans. It runs those tasks using live market data, checks its own work, and refines the results until it has a confident, data-backed answer.

**Key Capabilities:**
- **Intelligent Task Planning**: Automatically decomposes complex queries into structured research steps
- **Autonomous Execution**: Selects and executes the right tools to gather financial data
- **Self-Validation**: Checks its own work and iterates until tasks are complete
- **Real-Time Financial Data**: Access to income statements, balance sheets, and cash flow statements
- **Safety Features**: Built-in loop detection and step limits to prevent runaway execution

## ⚡ Quick Start

Get up and running in minutes:

```bash
# Install dependencies
bun install

# Initialize a new project
tino init my-project

# Enter the project directory
cd my-project

# Start Tino
tino
```

## 🏗️ Architecture

Tino uses a hybrid architecture combining a TypeScript CLI for the agentic interface and a Python daemon for heavy quantitative lifting.

```ascii
+----------------+      gRPC      +----------------+
|  TypeScript    | <---------->   |    Python      |
|  CLI (Agent)   |   (Connect)    |    Daemon      |
+----------------+                +----------------+
| - Ink UI       |                | - Nautilus     |
| - LangChain    |                | - Pandas/Numpy |
| - Tool Mgmt    |                | - TA-Lib       |
+----------------+                +----------------+
```

## ✨ Features

- **10+ Data Sources**: Integrated support for FMP, FRED, CoinGecko, EDGAR, Polygon, Finnhub, and more.
- **Custom LLM Support**: Use any OpenAI-compatible provider (local Ollama, vLLM, etc.) via `OPENAI_BASE_URL`.
- **NautilusTrader Integration**: Seamless backtesting, paper trading, and live trading capabilities.
- **Strategy Code Generation**: AI-assisted strategy writing with built-in safety guardrails.
- **Terminal Visualization**: Rich TUI with charts, tables, and sparklines directly in your terminal.
- **8 Specialized Workflows**:
  - `backtest`: Run historical simulations
  - `comprehensive-research`: Deep dive analysis
  - `dcf`: Discounted Cash Flow valuation
  - `factor-analysis`: Multi-factor model analysis
  - `live-trade`: Real-time execution
  - `options-analysis`: Derivatives pricing and greeks
  - `paper-trade`: Simulated forward testing
  - `strategy-generation`: Create new trading strategies

## 🔑 Data Source Configuration

Tino supports various data providers. Configure them in your `.env` file:

| Provider | Env Variable | Description |
|----------|--------------|-------------|
| Financial Datasets | `FINANCIAL_DATASETS_API_KEY` | Institutional-grade market data |
| Exa | `EXASEARCH_API_KEY` | Neural web search for financial news |
| Tavily | `TAVILY_API_KEY` | Fallback web search |
| Polygon | `POLYGON_API_KEY` | Stocks, Options, Forex, Crypto data |
| Finnhub | `FINNHUB_API_KEY` | Global market data |
| FRED | `FRED_API_KEY` | Economic data (Federal Reserve) |
| FMP | `FMP_API_KEY` | Financial Modeling Prep |

## 🤖 Custom LLM Setup

Tino defaults to OpenAI but supports any compatible provider.

**Using Local Models (Ollama):**
```bash
export OLLAMA_BASE_URL=http://127.0.0.1:11434
```

**Using Custom Providers:**
You can configure custom providers in `.dexter/settings.json` or by using the `custom:` prefix in the model selection command.

**Environment Variables:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `OPENROUTER_API_KEY`

## 📈 Strategy Development

Tino helps you write and refine NautilusTrader strategies.

1. **Generate**: Ask Tino to "Create a momentum strategy for BTC/USDT".
2. **Refine**: Tino will draft the code, ensuring it extends `Strategy` and includes `on_start` and `on_bar` methods.
3. **Backtest**: Run the strategy against historical data using the `backtest` skill.
4. **Deploy**: Move to paper trading or live trading when ready.

See `examples/` for reference implementations.

## 🛡️ Trading Safety

Safety is paramount in algorithmic trading. Tino includes:

- **Kill Switch**: Global panic button to stop all trading immediately.
- **Position Limits**: Hard caps on position sizes and leverage.
- **Double Confirmation**: Critical actions (like live order submission) require explicit user approval.
- **Sandboxed Execution**: Strategies run in isolated environments to prevent system interference.

## 💻 CLI Commands

Use these slash commands within the Tino CLI:

| Command | Description |
|---------|-------------|
| `/model` | Switch LLM provider/model |
| `/clear` | Clear conversation history |
| `/skill` | List or load specific skills |
| `/help` | Show available commands |
| `/exit` | Quit the application |

## 🛠️ Development

**Build:**
```bash
bun run build
```

**Test:**
```bash
bun test
```

**Typecheck:**
```bash
bun run typecheck
```

## 🌍 Environment Variables

Complete list of supported environment variables:

```bash
# LLM Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=
OPENROUTER_API_KEY=
OLLAMA_BASE_URL=

# Data Providers
FINANCIAL_DATASETS_API_KEY=
EXASEARCH_API_KEY=
TAVILY_API_KEY=
POLYGON_API_KEY=
FINNHUB_API_KEY=
FRED_API_KEY=
FMP_API_KEY=

# Tracing (LangSmith)
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=
LANGSMITH_PROJECT=
LANGSMITH_TRACING=
```

## 🤝 Credits

Tino is built on top of [Dexter](https://github.com/virattt/dexter) by [virattt](https://twitter.com/virattt). We extend our gratitude for the excellent foundation provided by the Dexter project.
