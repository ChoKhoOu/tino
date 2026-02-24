---
layout: home

hero:
  name: Tino
  text: AI-Powered Crypto Trading CLI
  tagline: An agentic terminal workbench that researches, builds, backtests, and trades — so you can focus on alpha.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/ChoKhoOu/tino

features:
  - title: 14 Consolidated Tools
    details: Market data, fundamentals, macro data, quant compute, simulated trading, live trading, strategy lab, portfolio tracking, terminal charts, real-time streaming, web search, browser automation, backtest history, and skill workflows.
  - title: 9 Skills
    details: Pre-built research pipelines for backtesting, comprehensive research, DCF valuation, factor analysis, options analysis, strategy generation, paper trading, live trading, and funding rate arbitrage.
  - title: Multi-Exchange Trading
    details: Binance spot and USDT-M futures on testnet and mainnet. NautilusTrader-powered backtesting and live execution engine via gRPC.
  - title: Risk Management
    details: Five configurable risk rules, automatic kill switch, strategy sandboxing, and a graduation workflow from backtest to paper to live.
  - title: 8 LLM Providers
    details: OpenAI, Anthropic, Google, xAI, Moonshot, OpenRouter, Ollama, and custom endpoints. Switch models at runtime with /model.
  - title: Terminal-Native UI
    details: ANSI candlestick charts, streaming tickers, interactive input, and model switching — all built with React/Ink inside your terminal.
---

## Quick Start

```bash
# Install Tino
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash

# Set your LLM API key
export OPENAI_API_KEY="sk-..."

# Launch
tino
```

Then ask Tino anything:

```
You: Backtest a BTC momentum strategy over the last year

Tino: Generating strategy... done
      Running backtest via NautilusTrader... done
      Sharpe: 1.42 | Max DD: -12.3% | Win Rate: 58%
```
