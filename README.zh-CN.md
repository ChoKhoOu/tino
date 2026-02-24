<p align="center">
  <h1 align="center">Tino</h1>
  <p align="center">
    <strong>AI 驱动的量化交易工作台</strong>
  </p>
  <p align="center">
    一个能自主研究、构建策略、回测验证和执行交易的 AI 终端工具 — 让你专注于 alpha。
  </p>
  <p align="center">
    <a href="https://www.gnu.org/licenses/gpl-3.0"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3"></a>
    <img src="https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun" alt="Bun">
    <img src="https://img.shields.io/badge/engine-NautilusTrader-0d1117" alt="NautilusTrader">
    <img src="https://img.shields.io/badge/AI-Vercel%20AI%20SDK-000000" alt="Vercel AI SDK">
  </p>
  <p align="center">
    <a href="./README.md">English</a>
  </p>
</p>

---

## Tino 是什么？

Tino 是一个为量化金融打造的终端原生 AI Agent。用自然语言提问 — 它会拉取市场数据、计算指标、生成交易策略、运行回测、管理实盘执行，全部在终端内完成。

底层架构将 **TypeScript CLI** (Bun + React/Ink) 与 **Python 守护进程** (NautilusTrader) 通过 gRPC 连接。基于 Vercel AI SDK 的 ReAct 风格 Agent 循环协调 13 个整合工具和 6 个金融数据源。

```
 你: "用 AAPL 过去两年的数据回测一个动量策略"

 Tino: 生成策略中... ✓
       通过 NautilusTrader 运行回测... ✓
       夏普比率: 1.42 | 最大回撤: -12.3% | 胜率: 58%
```

## 功能特性

- **13 个整合工具** — 市场数据、基本面、宏观数据、量化计算、模拟交易、实盘交易、策略实验室、投资组合追踪、终端图表、实时行情流、网络搜索、浏览器自动化、技能工作流
- **6 个金融数据源** — Polygon、FMP、Financial Datasets、FRED、Finnhub、CoinGecko、Binance，支持自动降级
- **投资组合追踪** — 基于 SQLite 的交易记录、持仓、每日盈亏和组合概览，支持守护进程重启后数据持久化
- **终端图表** — 通过 plotext 在终端内直接渲染 ANSI K线图、折线图和子图
- **实时行情流** — 通过 WebSocket（Polygon + Binance）获取实时市场数据，支持自动重连和订阅管理
- **币安交易所** — 支持现货和 USDT 合约在测试网和主网的交易，含标的标准化
- **本地量化引擎** — 技术指标、风险指标、期权定价 (Black-Scholes/Greeks)、因子分析 (Fama-French)、投资组合优化 — 全部本地计算，无需 API
- **NautilusTrader 后端** — 专业级回测和实盘交易引擎，通过 gRPC 通信
- **8 个技能工作流** — 预置研究流程：回测、深度研究、DCF 估值、因子分析、期权分析、策略生成、模拟交易、实盘交易
- **多 LLM 提供商** — OpenAI、Anthropic、Google、xAI、Moonshot、OpenRouter、Ollama 及自定义端点
- **丰富的终端 UI** — ANSI 图表、实时行情、交互式输入、模型切换 — 基于 React/Ink 构建
- **策略全生命周期** — 生成 → 验证 → 回测 → 模拟交易 → 实盘，全程由 AI 引导

## 快速开始

### 二进制安装（推荐）

```bash
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash
```

前置条件：[uv](https://docs.astral.sh/uv/)（Python 包管理器）和至少一个 LLM API Key（推荐 OpenAI）。

```bash
export OPENAI_API_KEY="sk-..."
tino
```

### 从源码安装（开发）

```bash
# 前置条件：Bun v1.0+、uv、Python 3.10–3.12
git clone https://github.com/ChoKhoOu/tino.git
cd tino
bun install

export OPENAI_API_KEY="sk-..."
tino
```

> **注意**：Tino 会在首次启动时自动在 `~/.tino/settings.json` 创建全局配置文件。

## 设置

Tino 使用两级配置系统：

1. **全局设置** (`~/.tino/settings.json`)：首次启动时自动创建。包含默认提供商 (`openai`) 和其他用户级偏好。
2. **项目设置** (`.tino/settings.json`)：可选。在项目目录中创建，用于覆盖特定项目的全局设置。

项目设置的优先级高于全局设置。

## 架构

```
┌────────────────────────────┐         gRPC (ConnectRPC)         ┌─────────────────────────┐
│    TypeScript CLI (Bun)    │ ◄───────────────────────────────► │     Python 守护进程       │
│                            │         127.0.0.1:50051           │                          │
│  React/Ink TUI             │                                   │  NautilusTrader 引擎      │
│  ReAct Agent 循环           │                                   │  回测 / 模拟 / 实盘        │
│  13 个工具 + 8 个技能        │                                   │  投资组合 (SQLite)        │
│  多 LLM 提供商              │                                   │  图表 / 实时行情          │
│  组合 / 图表 / 实时行情      │                                   │  8 个 gRPC 服务           │
└────────────────────────────┘                                   └─────────────────────────┘
```

**Agent 循环**: `查询 → [调用模型 → 执行工具 → 写入草稿板 → 检查上下文] × N → 流式输出最终回答`

**上下文管理**: 100k token 阈值触发最旧结果清理。150k token 总预算。Agent 持续运行直到收集足够信息来回答。

## 工具

| 工具 | 领域 | 说明 |
|------|------|------|
| `market_data` | 金融 | 股票价格、OHLCV K线、期权链、加密货币、标的详情 |
| `fundamentals` | 金融 | 利润表、资产负债表、财务比率、分析师预估、内部交易、新闻 |
| `macro_data` | 金融 | FRED 经济数据 — GDP、CPI、利率、就业 |
| `quant_compute` | 量化 | 技术指标、风险指标、期权定价、因子分析、投资组合优化 |
| `trading_sim` | 交易 | 策略回测、模拟交易、查看持仓 |
| `trading_live` | 交易 | 提交实盘订单、紧急停止（需明确确认） |
| `strategy_lab` | 策略 | 生成和验证 NautilusTrader 策略代码 |
| `web_search` | 搜索 | 通过 Exa 或 Tavily 进行网络搜索 |
| `browser` | 浏览器 | 无头浏览器自动化（导航、读取、操作），基于 Playwright |
| `skill` | 工作流 | 加载预置研究工作流 |
| `portfolio` | 交易 | 交易记录、持仓、盈亏追踪、投资组合概览 |
| `chart` | 可视化 | 终端内 ANSI K线图、折线图和子图 |
| `streaming` | 实时 | 通过 WebSocket 获取实时市场数据（Polygon、Binance） |

## 技能

技能是 AI 引导的多步骤工作流。在 Tino 中输入 `/skill` 浏览可用技能。

| 技能 | 功能 |
|------|------|
| `backtest` | 配置、运行和分析历史策略模拟 |
| `comprehensive-research` | 结合基本面、技术面和风险的端到端投资分析 |
| `dcf-valuation` | 现金流折现分析，估算内在价值 |
| `factor-analysis` | Fama-French 因子暴露、风格偏差诊断、绩效归因 |
| `options-analysis` | 期权定价、Greeks、策略对比、收益分析 |
| `strategy-generation` | 根据自然语言描述生成 NautilusTrader 策略代码 |
| `paper-trade` | 无真实资金的模拟实盘交易 |
| `live-trade` | 使用真实资金部署策略（带安全防护） |

## LLM 提供商

默认模型：`gpt-5.2`。路由/摘要使用自动选择的快速模型。

| 提供商 | 模型前缀 | API Key |
|--------|---------|---------|
| OpenAI | _（默认）_ | `OPENAI_API_KEY` |
| Anthropic | `claude-` | `ANTHROPIC_API_KEY` |
| Google | `gemini-` | `GOOGLE_API_KEY` |
| xAI | `grok-` | `XAI_API_KEY` |
| Moonshot | `kimi-` | `MOONSHOT_API_KEY` |
| OpenRouter | `openrouter:` | `OPENROUTER_API_KEY` |
| Ollama | `ollama:` | _（本地，无需 Key）_ |
| 自定义 | `custom:name/` | 通过 `.tino/settings.json` |

运行时使用 `/model <名称>` 切换模型。

你也可以在配置文件（`~/.tino/settings.json` 或 `.tino/settings.json`）里覆盖各 Provider 的鉴权和网关地址，不依赖 shell 环境变量。

推荐使用 `providers`，`providerOverrides` 仍可继续使用（向后兼容别名）：

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
    },
    "google": {
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "your-google-key"
    },
    "xai": {
      "baseURL": "https://api.x.ai/v1",
      "apiKey": "your-xai-key"
    },
    "moonshot": {
      "baseURL": "https://api.moonshot.cn/v1",
      "apiKey": "your-moonshot-key"
    },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "your-openrouter-key"
    },
    "ollama": {
      "baseURL": "http://127.0.0.1:11434/v1"
    }
  }
}
```

同一 Provider 下，`providers`（或 `providerOverrides`）中的值优先级高于环境变量。

## 数据源

提供商自动降级：Financial Datasets → FMP → Finnhub（基本面数据）。

| 提供商 | API Key | 数据 |
|--------|---------|------|
| Financial Datasets | `FINANCIAL_DATASETS_API_KEY` | 财务报表、指标、内部交易、新闻 |
| FMP | `FMP_API_KEY` | 报表、比率、DCF、价格、财报电话会议纪要 |
| Polygon | `POLYGON_API_KEY` | OHLCV K线、快照、标的详情、期权链 |
| FRED | `FRED_API_KEY` | GDP、CPI、利率、就业，800k+ 数据序列 |
| Finnhub | `FINNHUB_API_KEY` | 新闻、情绪、财报日历 |
| CoinGecko | _（免费）_ | 加密货币价格、市场数据、历史数据 |
| Binance | `BINANCE_API_KEY` | 现货和 USDT 合约交易、实时 WebSocket 行情流 |

## 交易安全

安全是 Tino 设计中不可妥协的底线：

- **实盘订单确认** — 所有实盘订单需 `confirmed=true` 参数及用户明确同意
- **Kill Switch** — 紧急停止所有活跃交易
- **策略代码验证** — 禁止危险导入（`os`、`subprocess`、`socket`）和函数（`exec`、`eval`、`__import__`）
- **沙箱执行** — 策略在受控 Python 环境中运行
- **模拟优先** — Agent 始终建议先进行模拟交易再上实盘
- **测试网优先** — 币安交易默认使用测试网；主网需要显式配置

## 策略模板

Tino 在 `templates/` 中提供即用型策略模板：

| 模板 | 说明 |
|------|------|
| `ema_crossover.py` | 指数移动平均线交叉策略 |
| `mean_reversion.py` | 均值回归策略 |
| `momentum.py` | 动量策略 |

更多策略变体参见 `examples/` 目录。

## CLI 命令

| 命令 | 说明 |
|------|------|
| `/model [名称]` | 切换 LLM 提供商或模型 |
| `/clear` | 清除对话上下文 |
| `/skill [名称]` | 列出或激活技能工作流 |
| `/help` | 显示可用命令 |
| `/exit` | 退出 Tino |

## 开发

```bash
# 开发模式（热重载）
bun run dev

# 运行测试
bun test

# 类型检查
bun run typecheck

# 手动运行 Python 守护进程
cd python && uv run --python 3.12 python -m tino_daemon

# 重新生成 Protobuf 代码
buf generate
```

### 项目结构

```
tino/
├── src/                    # TypeScript CLI (Bun + Ink)
│   ├── index.tsx           # 入口文件
│   ├── cli.tsx             # 主 Ink 组件
│   ├── agent/              # ReAct Agent 循环、提示词、草稿板
│   ├── runtime/            # 模型代理、多提供商 LLM
│   ├── tools/              # 13 个整合工具 + 数据源
│   ├── grpc/               # gRPC 客户端 (ConnectRPC)
│   ├── daemon/             # Python 守护进程生命周期管理
│   ├── skills/             # 8 个技能工作流 (Markdown 驱动)
│   ├── components/         # Ink TUI 组件
│   ├── hooks/              # React Hooks
│   ├── commands/           # 斜杠命令
│   └── config/             # 设置、环境变量、常量
├── python/                 # Python 守护进程
│   └── tino_daemon/        # NautilusTrader gRPC 包装器
├── proto/                  # Protobuf 服务定义
│   └── tino/               # trading, data, backtest, daemon, portfolio, chart, streaming 服务
├── templates/              # 策略模板 (Python)
├── examples/               # 示例策略
└── scripts/                # 发布工具
```

## 环境变量

创建 `.env` 文件或在 Shell 中导出：

```bash
# LLM（至少需要一个）
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=
MOONSHOT_API_KEY=
OPENROUTER_API_KEY=

# 数据源（按需配置）
FINANCIAL_DATASETS_API_KEY=
FMP_API_KEY=
POLYGON_API_KEY=
FRED_API_KEY=
FINNHUB_API_KEY=

# 币安（加密货币交易）
BINANCE_API_KEY=
BINANCE_API_SECRET=
BINANCE_TESTNET=true

# 搜索（可选）
EXASEARCH_API_KEY=
TAVILY_API_KEY=

# 自定义端点（可选）
OPENAI_BASE_URL=
OLLAMA_BASE_URL=

# 追踪（可选）
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=
LANGSMITH_PROJECT=
LANGSMITH_TRACING=
```

## 贡献

欢迎贡献！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/amazing-feature`)
3. 提交变更 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feat/amazing-feature`)
5. 发起 Pull Request

## 许可证

本项目基于 **GNU 通用公共许可证 v3.0** 授权 — 详见 [LICENSE](./LICENSE) 文件。
