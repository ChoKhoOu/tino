# Settings Reference

Tino uses a two-tier settings system. Global settings apply everywhere; project settings override globals for a specific directory.

## File Locations

| Scope | Path |
|-------|------|
| Global | `~/.tino/settings.json` |
| Project | `.tino/settings.json` |

Project settings take precedence over global settings. Global settings are auto-created on first launch with `{ "provider": "openai" }`.

## Full Schema

```json
{
  "provider": "openai",
  "modelId": "gpt-5.2",
  "exchange": "binance",
  "defaultPair": "BTCUSDT",
  "providers": {
    "<provider-name>": {
      "baseURL": "https://...",
      "apiKey": "...",
      "defaultModel": "..."
    }
  },
  "customProviders": {
    "<name>": {
      "baseURL": "https://...",
      "apiKey": "...",
      "defaultModel": "..."
    }
  }
}
```

## Fields

### provider

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Default** | `"openai"` |
| **Description** | Default LLM provider. Determines which API is used for the agent loop. |

**Valid values:** `openai`, `anthropic`, `google`, `xai`, `moonshot`, `openrouter`, `ollama`, or a custom provider name.

```json
{
  "provider": "anthropic"
}
```

### modelId

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Default** | _(none, uses provider default)_ |
| **Description** | Specific model ID to use. Overrides the provider's default model selection. |

```json
{
  "modelId": "claude-sonnet-4-5"
}
```

### model (deprecated)

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Default** | _(none)_ |
| **Description** | Legacy field. Auto-migrated to `provider` on read. Use `provider` + `modelId` instead. |

### exchange

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Default** | _(none)_ |
| **Description** | Default exchange for trading operations. |

```json
{
  "exchange": "binance"
}
```

### defaultPair

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Default** | _(none)_ |
| **Description** | Default trading pair when no instrument is specified. |

```json
{
  "defaultPair": "BTCUSDT"
}
```

### providers

| Property | Value |
|----------|-------|
| **Type** | `Record<string, ProviderOverride>` |
| **Default** | `{}` |
| **Description** | Override base URL and API key for built-in providers. Values take precedence over environment variables. |

Each provider override can have:

| Field | Type | Description |
|-------|------|-------------|
| `baseURL` | `string` (URL) | Custom API endpoint |
| `apiKey` | `string` | API key (overrides env var) |
| `defaultModel` | `string` | Default model for this provider |

```json
{
  "providers": {
    "openai": {
      "baseURL": "https://your-gateway.example.com/v1",
      "apiKey": "sk-..."
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "google": {
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "AI..."
    },
    "xai": {
      "baseURL": "https://api.x.ai/v1",
      "apiKey": "xai-..."
    },
    "moonshot": {
      "baseURL": "https://api.moonshot.cn/v1",
      "apiKey": "..."
    },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "..."
    },
    "ollama": {
      "baseURL": "http://127.0.0.1:11434/v1"
    }
  }
}
```

### providerOverrides (deprecated alias)

Same schema as `providers`. Merged with `providers` on load -- use `providers` for new configurations. When both are present, values are deep-merged with `providers` taking precedence.

### customProviders

| Property | Value |
|----------|-------|
| **Type** | `Record<string, CustomProvider>` |
| **Default** | `{}` |
| **Description** | Register custom LLM providers accessible via the `custom:` prefix. |

Each custom provider requires:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `baseURL` | `string` (URL) | Yes | API endpoint |
| `apiKey` | `string` | No | API key |
| `defaultModel` | `string` | No | Default model |

```json
{
  "customProviders": {
    "my-corp-llm": {
      "baseURL": "https://llm.corp.internal/v1",
      "apiKey": "internal-key",
      "defaultModel": "corp-model-v2"
    }
  }
}
```

Use with: `/model custom:my-corp-llm/corp-model-v2`

## Settings Merge Behavior

When both global and project settings exist, they are merged:

1. Top-level fields: project overrides global
2. `providers`: deep-merged per provider key (project values override)
3. `customProviders`: deep-merged per provider key (project values override)
4. `providerOverrides` and `providers`: merged into a single `providers` object

## Environment Variables

Environment variables serve as fallback when settings file values are not present:

```bash
# LLM providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
XAI_API_KEY=xai-...
MOONSHOT_API_KEY=...
OPENROUTER_API_KEY=...

# Data providers
POLYGON_API_KEY=...
FMP_API_KEY=...
FINANCIAL_DATASETS_API_KEY=...
FRED_API_KEY=...
FINNHUB_API_KEY=...

# Binance
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
BINANCE_TESTNET=true

# Search
EXASEARCH_API_KEY=...
TAVILY_API_KEY=...

# Custom endpoints
OPENAI_BASE_URL=...
OLLAMA_BASE_URL=...
```

## Example: Minimal Config

```json
{
  "provider": "openai"
}
```

## Example: Full Setup

```json
{
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-5",
  "exchange": "binance",
  "defaultPair": "BTCUSDT",
  "providers": {
    "openai": {
      "apiKey": "sk-..."
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "google": {
      "apiKey": "AI..."
    }
  },
  "customProviders": {
    "internal": {
      "baseURL": "https://llm.internal.corp/v1",
      "apiKey": "key",
      "defaultModel": "corp-v1"
    }
  }
}
```

## Related

- [Multi-Model Guide](/guides/multi-model) -- switching and configuring LLM providers
- [Exchange Setup](/getting-started/exchange-setup) -- Binance API key configuration
- [Risk Config Reference](/reference/risk-config) -- risk rules configuration
