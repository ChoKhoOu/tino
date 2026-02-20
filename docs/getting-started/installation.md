# Installation

## Binary Install (Recommended)

The fastest way to get started. Requires [uv](https://docs.astral.sh/uv/) (Python package manager) and at least one LLM API key.

```bash
curl -sSL https://raw.githubusercontent.com/ChoKhoOu/tino/main/scripts/install.sh | bash
```

Set your API key and launch:

```bash
export OPENAI_API_KEY="sk-..."
tino
```

## From Source (Development)

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Python 3.10 - 3.12

### Clone and Install

```bash
git clone https://github.com/ChoKhoOu/tino.git
cd tino
bun install
```

### Set API Keys

At minimum, you need one LLM provider key:

```bash
export OPENAI_API_KEY="sk-..."
```

For financial data, add provider keys as needed:

```bash
export POLYGON_API_KEY="..."        # Stock OHLCV, options, ticker details
export FMP_API_KEY="..."            # Financial statements, ratios
export FRED_API_KEY="..."           # Macroeconomic data
export FINANCIAL_DATASETS_API_KEY="..." # Financial statements, insider trades
```

### Launch

```bash
tino
```

On first launch, Tino creates a global settings file at `~/.tino/settings.json` with default configuration.

### Development Mode

For hot-reload during development:

```bash
bun run dev
```

### Run Tests

```bash
bun test                          # All tests
bun test src/path/file.test.ts    # Single test file
bun run typecheck                 # Type checking
```

## Verify Installation

After launching, type a simple query to confirm everything works:

```
You: What is the current price of BTC?
```

Tino will fetch the current Bitcoin price from CoinGecko (no API key required for crypto data) and display the result.
