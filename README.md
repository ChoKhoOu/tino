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
    <img src="https://img.shields.io/badge/version-1.0.0-brightgreen" alt="Version 1.0.0">
    <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun" alt="Bun">
    <img src="https://img.shields.io/badge/engine-NautilusTrader-0d1117" alt="NautilusTrader">
    <img src="https://img.shields.io/badge/AI-Vercel%20AI%20SDK-000000" alt="Vercel AI SDK">
  </p>
  <p align="center">
    <a href="#中文说明">简体中文</a>
  </p>
</p>

---

## What is Tino?

Tino is a terminal-native AI agent built for quantitative finance. Ask it a question in plain English — it will pull market data, crunch numbers, generate trading strategies, run backtests, and manage live execution, all from your terminal.

Under the hood, Tino combines a **TypeScript CLI** (Bun + React/Ink) with a **Python daemon** (NautilusTrader), connected via gRPC. A ReAct-style agent loop powered by the Vercel AI SDK orchestrates 14 consolidated tools across 6+ financial data providers.

```
 You: "Backtest a momentum strategy on AAPL over the last 2 years"

 Tino: Generating strategy... ✓
       Running backtest via NautilusTrader... ✓
       Sharpe: 1.42 | Max DD: -12.3% | Win Rate: 58%
```

## Features

- **14 Consolidated Tools** — Market data, fundamentals, macro data, quant compute, simulated trading, live trading, strategy lab, portfolio tracking, terminal charts, real-time streaming, web search, browser automation, backtest history, and skill workflows
- **6+ Financial Data Providers** — Polygon, FMP, Financial Datasets, FRED, Finnhub, CoinGecko, CoinGlass, Binance with automatic fallback chains
- **Multi-Exchange Trading** — Binance, Bybit, OKX, Bitget with unified adapter layer and Hummingbot CEX connectors
- **Cross-Exchange Portfolio** — Aggregated balances, positions, and PnL across all connected exchanges
- **NautilusTrader Backend** — Professional-grade backtesting, paper trading, and live trading engine via gRPC
- **10+ Strategy Templates** — EMA Crossover, Mean Reversion, Momentum, RSI, Grid Trading, MA Crossover, Bollinger Band, DCA, Market Making, Pairs Trading, Funding Rate Arbitrage
- **Advanced Order Types** — Take-Profit/Stop-Loss (TP/SL), trailing stop orders, perpetual contract support
- **AI Risk Management** — Anomaly detection engine, AI risk advisor with proactive monitoring
- **7 Skill Workflows** — Backtest, comprehensive research, DCF valuation, options analysis, strategy generation, paper trading, live trading
- **Local Quant Engine** — Technical indicators, risk metrics, options pricing (Black-Scholes/Greeks), portfolio optimization — all computed locally
- **Multi-Provider LLM** — OpenAI, Anthropic, Google, xAI, Moonshot, OpenRouter, Ollama, and custom endpoints
- **Rich Terminal UI** — ANSI charts, streaming tickers, dashboard with Ctrl+D, command palette with Ctrl+P, dark theme, interactive input
- **Real-Time Streaming** — Live market data via WebSocket (Polygon + Binance) with auto-reconnect
- **Plugin System** — Extensible plugin architecture with SDK, documentation, and example plugins
- **Strategy Lifecycle** — Generate → validate → backtest → paper trade → go live, all guided by AI

## Quick Start

### Prerequisites

| Requirement | Version | Installation |
|-------------|---------|-------------|
| [Bun](https://bun.sh) | v1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| [Python](https://www.python.org) | 3.10–3.12 | System package manager or pyenv |
| [uv](https://docs.astral.sh/uv/) | Latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

### Install via Script (Recommended)

```bash
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash
```

This installs the `tino` binary and sets up the Python daemon automatically.

### Install from Source

```bash
git clone https://github.com/ChoKhoOu/tino.git
cd tino
bun install
```

### Configuration

Set at least one LLM API key:

```bash
export OPENAI_API_KEY="sk-..."
```

Then launch:

```bash
tino
```

> Tino automatically creates a global settings file at `~/.tino/settings.json` on first launch.

## Architecture

```
┌────────────────────────────────┐       gRPC (ConnectRPC)       ┌──────────────────────────────┐
│     TypeScript CLI (Bun)       │ ◄──────────────────────────► │       Python Daemon            │
│                                │       127.0.0.1:50051         │                                │
│  React/Ink TUI                 │                               │  NautilusTrader Engine         │
│  ReAct Agent Loop              │                               │  Backtest / Paper / Live       │
│  14 Tools + 7 Skills           │                               │  Portfolio (SQLite)            │
│  Multi-Provider LLM            │                               │  Charts / Streaming            │
│  Plugin System                 │                               │  gRPC Services                 │
└────────────────────────────────┘                               └──────────────────────────────┘
```

**Agent Loop**: `Query → [callModel → executeTools → addToScratchpad → checkContext] × N → streamFinalAnswer`

**Context Management**: 100k token threshold triggers oldest-result clearing. 150k token total budget. The agent runs indefinitely until it has enough information to answer.

## Tools

| Tool | Domain | Description |
|------|--------|-------------|
| `market_data` | Finance | Stock prices, OHLCV bars, options chains, crypto, ticker details |
| `fundamentals` | Finance | Income statements, balance sheets, ratios, analyst estimates, insider trades, news |
| `macro_data` | Finance | FRED economic data — GDP, CPI, interest rates, employment |
| `quant_compute` | Quant | Technical indicators, risk metrics, options pricing, portfolio optimization |
| `trading_sim` | Trading | Backtest strategies, paper trade, view positions |
| `trading_live` | Trading | Submit live orders, kill switch (requires explicit confirmation) |
| `strategy_lab` | Strategy | Generate and validate NautilusTrader strategy code |
| `web_search` | Search | Web search via Exa or Tavily |
| `browser` | Browser | Headless browser automation (navigate, read, act) via Playwright |
| `skill` | Workflow | Load pre-built research workflows |
| `portfolio` | Trading | Trade history, positions, PnL tracking, portfolio summaries |
| `chart` | Visualization | ANSI candlestick, line, and subplot charts in the terminal |
| `streaming` | Real-time | Live market data via WebSocket (Polygon, Binance) |
| `backtest_history` | History | Historical backtest results and comparison |

## Skills

Skills are guided multi-step workflows. Type `/skill` in Tino to browse them.

| Skill | What It Does |
|-------|-------------|
| `backtest` | Configure, run, and analyze historical strategy simulations |
| `comprehensive-research` | End-to-end investment analysis combining fundamentals, technicals, and risk |
| `dcf-valuation` | Discounted cash flow analysis to estimate intrinsic value |
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

You can also override provider credentials and base URLs in settings files (`~/.tino/settings.json` or `.tino/settings.json`) without relying on shell environment variables.

Use `providers` (recommended), or `providerOverrides` (backward-compatible alias):

```json
{
  "providers": {
    "openai": {
      "baseURL": "https://your-gateway.example.com/v1",
      "apiKey": "your-openai-compatible-key"
    },
    "anthropic": {
      "baseURL": "https://api.anthropic.com/v1",
      "apiKey": "your-anthropic-key"
    }
  }
}
```

For each provider, values in `providers` take precedence over environment variables.

## Data Providers

Providers with automatic fallback: Financial Datasets -> FMP -> Finnhub for fundamental data.

| Provider | API Key | Data |
|----------|---------|------|
| Financial Datasets | `FINANCIAL_DATASETS_API_KEY` | Financial statements, metrics, insider trades, news |
| FMP | `FMP_API_KEY` | Statements, ratios, DCF, prices, earnings transcripts |
| Polygon | `POLYGON_API_KEY` | OHLCV bars, snapshots, ticker details, options chains |
| FRED | `FRED_API_KEY` | GDP, CPI, interest rates, employment, 800k+ series |
| Finnhub | `FINNHUB_API_KEY` | News, sentiment, earnings calendar |
| CoinGecko | _(free)_ | Crypto prices, market data, historical data |
| CoinGlass | `COINGLASS_API_KEY` | Funding rates, open interest, liquidations |
| Binance | `BINANCE_API_KEY` | Spot and USDT-M Futures trading, real-time WebSocket streams |

## Supported Exchanges

| Exchange | Spot | Futures | Paper | Live |
|----------|------|---------|-------|------|
| Binance | Yes | USDT-M | Testnet | Mainnet |
| Bybit | Yes | USDT Perp | — | Via adapter |
| OKX | Yes | Swap | — | Via adapter |
| Bitget | Yes | USDT-M | — | Via adapter |

Additional exchanges available via Hummingbot CEX connector integration.

## Trading Safety

Safety is non-negotiable in Tino's design:

- **Live Order Confirmation** — All live orders require `confirmed=true` and explicit user consent
- **Kill Switch** — Emergency stop for all active trading
- **Strategy Validation** — Blocks dangerous imports (`os`, `subprocess`, `socket`) and functions (`exec`, `eval`, `__import__`)
- **Sandboxed Execution** — Strategies run in a controlled Python environment
- **Paper Trading First** — The agent always recommends paper trading before going live
- **Testnet Default** — Binance trading defaults to testnet; mainnet requires explicit configuration
- **AI Risk Advisor** — Proactive risk monitoring with anomaly detection

## Strategy Templates

Tino ships with ready-to-use strategy templates:

| Template | Description |
|----------|-------------|
| `ema_crossover.py` | Exponential Moving Average crossover strategy |
| `mean_reversion.py` | Mean reversion strategy |
| `momentum.py` | Momentum-based strategy |
| `rsi_momentum.py` | RSI-based momentum strategy |
| `grid_trading.py` | Grid trading strategy |
| `ma_crossover.py` | Moving average trend following |
| `bollinger_band.py` | Bollinger Band mean reversion |
| `dca.py` | Dollar-cost averaging strategy |
| `market_making.py` | Basic market making strategy |
| `pairs_trading.py` | Pairs trading with cointegration |
| `funding_rate_arb.py` | Funding rate arbitrage |

## CLI Commands

| Command | Description |
|---------|-------------|
| `/model [name]` | Switch LLM provider or model |
| `/clear` | Clear conversation context |
| `/skill [name]` | List or activate a skill workflow |
| `/help` | Show available commands |
| `/exit` | Exit Tino |

## Settings

Tino uses a two-tier settings system:

1. **Global Settings** (`~/.tino/settings.json`): Auto-created on first launch. Contains default provider and user-wide preferences.
2. **Project Settings** (`.tino/settings.json`): Optional. Created in your project directory to override global settings for specific projects.

Project settings take precedence over global settings.

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

# Run Python tests
cd python && uv run pytest

# Regenerate Protobuf code
buf generate
```

### Project Structure

```
tino/
├── src/                    # TypeScript CLI (Bun + Ink)
│   ├── index.tsx           # Entry point
│   ├── cli.tsx             # Main Ink component
│   ├── runtime/            # Agent loop, model broker, prompt builder
│   ├── tools/              # 14 consolidated tools + finance providers
│   ├── grpc/               # gRPC clients (ConnectRPC)
│   ├── daemon/             # Python daemon lifecycle management
│   ├── skills/             # 7 skill workflows (markdown-driven)
│   ├── components/         # Ink TUI components
│   ├── commands/           # Slash commands
│   ├── config/             # Settings, env, constants
│   └── plugins/            # Plugin system SDK
├── python/                 # Python daemon
│   └── tino_daemon/        # NautilusTrader gRPC wrapper
│       ├── services/       # gRPC service implementations
│       ├── strategies/     # Strategy templates
│       └── proto/          # Generated protobuf stubs
├── proto/                  # Protobuf service definitions (source of truth)
│   └── tino/               # trading, data, backtest, daemon, portfolio, chart, streaming
├── templates/              # Strategy templates (Python)
├── examples/               # Example strategies
├── docs/                   # Documentation
│   └── plugins/            # Plugin development guide
└── scripts/                # Installation and release tooling
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
COINGLASS_API_KEY=

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

## Plugin Development

Tino supports external plugins loaded from `~/.tino/plugins/` and `.tino/plugins/`. See the [Plugin Development Guide](./docs/plugins/) for details on building custom tools, data providers, and strategy templates.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](./LICENSE) file for details.

---

<a id="中文说明"></a>

## 中文说明

### Tino 是什么？

Tino 是一个面向量化金融的终端 AI 智能体。用自然语言提问，它能自动获取市场数据、运行量化分析、生成交易策略、执行回测，并管理实盘交易——一切都在终端中完成。

底层架构由 **TypeScript CLI**（Bun + React/Ink）前端和 **Python 守护进程**（NautilusTrader）后端组成，通过 gRPC 通信。基于 Vercel AI SDK 的 ReAct 智能体循环协调 14 个整合工具和 6+ 个金融数据源。

### 主要特性

- **14 个整合工具** — 市场数据、基本面、宏观数据、量化计算、模拟交易、实盘交易、策略实验室、投资组合、终端图表、实时行情、网络搜索、浏览器自动化等
- **6+ 个金融数据源** — Polygon、FMP、Financial Datasets、FRED、Finnhub、CoinGecko、CoinGlass、Binance，支持自动回退链
- **多交易所支持** — Binance、Bybit、OKX、Bitget 统一适配器层 + Hummingbot CEX 连接器
- **跨交易所投资组合** — 汇总所有已连接交易所的余额、持仓和盈亏
- **NautilusTrader 引擎** — 专业级回测、模拟交易和实盘交易
- **10+ 策略模板** — EMA 交叉、均值回归、动量、RSI、网格交易、布林带、DCA、做市、配对交易、资金费率套利
- **高级订单类型** — 止盈止损（TP/SL）、追踪止损、永续合约支持
- **AI 风险管理** — 异常检测引擎、AI 风险顾问主动监控
- **7 个技能工作流** — 回测、综合研究、DCF 估值、期权分析、策略生成、模拟交易、实盘交易
- **本地量化引擎** — 技术指标、风险指标、期权定价（Black-Scholes/Greeks）、投资组合优化
- **多模型支持** — OpenAI、Anthropic、Google、xAI、Moonshot、OpenRouter、Ollama 及自定义端点
- **丰富的终端界面** — ANSI 图表、实时行情、仪表盘、命令面板、暗色主题
- **插件系统** — 可扩展的插件架构，含 SDK、文档和示例插件
- **策略全生命周期** — 生成 → 验证 → 回测 → 模拟交易 → 实盘，全程 AI 引导

### 快速开始

#### 环境要求

| 依赖 | 版本 | 安装方式 |
|------|------|---------|
| [Bun](https://bun.sh) | v1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| [Python](https://www.python.org) | 3.10–3.12 | 系统包管理器或 pyenv |
| [uv](https://docs.astral.sh/uv/) | 最新版 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

#### 脚本安装（推荐）

```bash
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash
```

#### 从源码安装

```bash
git clone https://github.com/ChoKhoOu/tino.git
cd tino
bun install
```

#### 配置

设置至少一个 LLM API 密钥：

```bash
export OPENAI_API_KEY="sk-..."
```

启动：

```bash
tino
```

### 交易安全

安全是 Tino 设计中不可妥协的原则：

- **实盘订单确认** — 所有实盘订单需要 `confirmed=true` 和用户明确同意
- **紧急停止开关** — 一键停止所有活跃交易
- **策略安全验证** — 阻止危险导入（`os`、`subprocess`、`socket`）和函数（`exec`、`eval`）
- **沙盒执行** — 策略在受控 Python 环境中运行
- **优先模拟交易** — AI 始终建议先进行模拟交易再实盘
- **默认测试网** — Binance 交易默认使用测试网；主网需要明确配置
- **AI 风险顾问** — 异常检测和主动风险监控

### 开发

```bash
bun run dev          # 开发模式（热重载）
bun test             # 运行测试
bun run typecheck    # 类型检查

# 手动启动 Python 守护进程
cd python && uv run --python 3.12 python -m tino_daemon

# Python 测试
cd python && uv run pytest

# 重新生成 Protobuf 代码
buf generate
```

### 许可证

本项目使用 **GNU 通用公共许可证 v3.0** 授权 — 详见 [LICENSE](./LICENSE) 文件。
