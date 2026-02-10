# Tino

Tino 是一个 AI 驱动的量化交易工作台。它通过任务规划、自我反思和实时市场数据进行金融研究与分析。基于 [Dexter](https://github.com/virattt/dexter) 构建，并扩展了量化交易能力。

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 目录

- [👋 概述](#-概述)
- [⚡ 快速开始](#-快速开始)
- [🏗️ 架构](#-架构)
- [✨ 功能特性](#-功能特性)
- [🔑 数据源配置](#-数据源配置)
- [🤖 自定义 LLM 设置](#-自定义-llm-设置)
- [📈 策略开发](#-策略开发)
- [🛡️ 交易安全](#-交易安全)
- [💻 CLI 命令](#-cli-命令)
- [🛠️ 开发指南](#-开发指南)
- [🌍 环境变量](#-环境变量)
- [🤝 致谢](#-致谢)

## 👋 概述

Tino 能将复杂的金融问题转化为清晰的、分步骤的研究计划。它使用实时市场数据执行这些任务，自动检验研究结果，并反复迭代优化，直到给出一个有数据支撑的可靠答案。

**核心能力：**
- **智能任务规划**：自动将复杂查询分解为结构化的研究步骤
- **自主执行**：选择并调用合适的工具来获取金融数据
- **自我验证**：检查自身工作成果，持续迭代直至任务完成
- **实时金融数据**：可访问利润表、资产负债表和现金流量表
- **安全机制**：内置循环检测和步骤限制，防止失控执行

## ⚡ 快速开始

几分钟即可启动运行：

```bash
# 安装依赖
bun install

# 初始化新项目
tino init my-project

# 进入项目目录
cd my-project

# 启动 Tino
tino
```

## 🏗️ 架构

Tino 采用混合架构，结合了 TypeScript CLI 作为智能体交互界面，以及 Python 守护进程承担繁重的量化计算。

```ascii
+----------------+      gRPC      +----------------+
|  TypeScript    | <---------->   |    Python      |
|  CLI (智能体)   |   (Connect)    |    守护进程     |
+----------------+                +----------------+
| - Ink UI       |                | - Nautilus     |
| - LangChain    |                | - Pandas/Numpy |
| - 工具管理      |                | - TA-Lib       |
+----------------+                +----------------+
```

## ✨ 功能特性

- **10+ 数据源**：集成 FMP、FRED、CoinGecko、EDGAR、Polygon、Finnhub 等多个数据提供商。
- **自定义 LLM 支持**：通过 `OPENAI_BASE_URL` 使用任何 OpenAI 兼容的提供商（本地 Ollama、vLLM 等）。
- **NautilusTrader 集成**：无缝对接回测、模拟交易和实盘交易功能。
- **策略代码生成**：AI 辅助编写策略代码，内置安全防护机制。
- **终端可视化**：丰富的 TUI 界面，直接在终端中显示图表、表格和迷你折线图。
- **8 个专业工作流**：
  - `backtest`：运行历史回测模拟
  - `comprehensive-research`：深度研究分析
  - `dcf`：现金流折现估值
  - `factor-analysis`：多因子模型分析
  - `live-trade`：实盘交易执行
  - `options-analysis`：衍生品定价与希腊字母计算
  - `paper-trade`：模拟前瞻性测试
  - `strategy-generation`：创建新的交易策略

## 🔑 数据源配置

Tino 支持多种数据提供商，在 `.env` 文件中配置即可：

| 提供商 | 环境变量 | 说明 |
|--------|----------|------|
| Financial Datasets | `FINANCIAL_DATASETS_API_KEY` | 机构级市场数据 |
| Exa | `EXASEARCH_API_KEY` | 金融新闻神经搜索 |
| Tavily | `TAVILY_API_KEY` | 备用网络搜索 |
| Polygon | `POLYGON_API_KEY` | 股票、期权、外汇、加密货币数据 |
| Finnhub | `FINNHUB_API_KEY` | 全球市场数据 |
| FRED | `FRED_API_KEY` | 经济数据（美联储） |
| FMP | `FMP_API_KEY` | Financial Modeling Prep |

## 🤖 自定义 LLM 设置

Tino 默认使用 OpenAI，但支持任何兼容的提供商。

**使用本地模型 (Ollama)：**
```bash
export OLLAMA_BASE_URL=http://127.0.0.1:11434
```

**使用自定义提供商：**
可以在 `.tino/settings.json` 中配置自定义提供商，或在模型选择命令中使用 `custom:` 前缀。

**环境变量：**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `OPENROUTER_API_KEY`

## 📈 策略开发

Tino 帮助你编写和优化 NautilusTrader 策略。

1. **生成**：让 Tino "创建一个 BTC/USDT 的动量策略"。
2. **优化**：Tino 会起草代码，确保继承 `Strategy` 类并包含 `on_start` 和 `on_bar` 方法。
3. **回测**：使用 `backtest` 技能对历史数据运行策略。
4. **部署**：准备就绪后切换到模拟交易或实盘交易。

参考 `examples/` 目录获取示例实现。

## 🛡️ 交易安全

在算法交易中，安全至关重要。Tino 内置了以下安全机制：

- **紧急停止**：全局紧急按钮，可立即停止所有交易。
- **仓位限制**：对持仓规模和杠杆设置硬性上限。
- **二次确认**：关键操作（如提交实盘订单）需要用户明确批准。
- **沙箱执行**：策略在隔离环境中运行，防止干扰系统。

## 💻 CLI 命令

在 Tino CLI 中使用以下斜杠命令：

| 命令 | 说明 |
|------|------|
| `/model` | 切换 LLM 提供商/模型 |
| `/clear` | 清除对话历史 |
| `/skill` | 列出或加载特定技能 |
| `/help` | 显示可用命令 |
| `/exit` | 退出应用 |

## 🛠️ 开发指南

**构建：**
```bash
bun run build
```

**测试：**
```bash
bun test
```

**类型检查：**
```bash
bun run typecheck
```

## 🌍 环境变量

支持的环境变量完整列表：

```bash
# LLM 提供商
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=
OPENROUTER_API_KEY=
OLLAMA_BASE_URL=

# 数据提供商
FINANCIAL_DATASETS_API_KEY=
EXASEARCH_API_KEY=
TAVILY_API_KEY=
POLYGON_API_KEY=
FINNHUB_API_KEY=
FRED_API_KEY=
FMP_API_KEY=

# 追踪 (LangSmith)
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=
LANGSMITH_PROJECT=
LANGSMITH_TRACING=
```

## 🤝 致谢

Tino 基于 [virattt](https://twitter.com/virattt) 的 [Dexter](https://github.com/virattt/dexter) 项目构建。感谢 Dexter 项目提供的出色基础。
