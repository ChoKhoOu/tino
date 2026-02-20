# Multi-Model LLM

Tino supports 8 LLM providers out of the box. You can switch models at runtime, configure custom endpoints, and route requests to different providers.

## Supported Providers

| Provider | Model Prefix | API Key Env Var |
|----------|-------------|-----------------|
| OpenAI | _(default, no prefix)_ | `OPENAI_API_KEY` |
| Anthropic | `claude-` | `ANTHROPIC_API_KEY` |
| Google | `gemini-` | `GOOGLE_API_KEY` |
| xAI | `grok-` | `XAI_API_KEY` |
| Moonshot | `kimi-` | `MOONSHOT_API_KEY` |
| OpenRouter | `openrouter:` | `OPENROUTER_API_KEY` |
| Ollama | `ollama:` | _(local, no key needed)_ |
| Custom | `custom:name/` | Via settings file |

The default model is `gpt-5.2` (OpenAI). A fast model is auto-selected per provider for routing and summarization tasks.

## Switching Models

### At Runtime

Use the `/model` command to switch providers during a session:

```
You: /model claude-sonnet-4-5
```

```
You: /model gemini-3
```

```
You: /model grok-3
```

The model prefix determines which provider handles the request. Tino's model broker detects the provider from the prefix and routes accordingly.

### Ollama (Local Models)

Run models locally with Ollama -- no API key needed:

```
You: /model ollama:llama3
```

Requires [Ollama](https://ollama.ai/) running locally on port 11434.

### OpenRouter (Multi-Provider Gateway)

Access hundreds of models through OpenRouter:

```
You: /model openrouter:anthropic/claude-3.5-sonnet
```

## Provider Configuration

Configure provider credentials and base URLs in settings files instead of environment variables.

### Global Settings

Edit `~/.tino/settings.json`:

```json
{
  "provider": "openai",
  "providers": {
    "openai": {
      "baseURL": "https://api.openai.com/v1",
      "apiKey": "sk-..."
    },
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "google": {
      "apiKey": "AI..."
    }
  }
}
```

### Project Settings

Override global settings per project with `.tino/settings.json`:

```json
{
  "provider": "anthropic",
  "modelId": "claude-sonnet-4-5"
}
```

Project settings take precedence over global settings.

### Custom Endpoints

Point any provider to a custom base URL (e.g., an API gateway or proxy):

```json
{
  "providers": {
    "openai": {
      "baseURL": "https://your-gateway.example.com/v1",
      "apiKey": "your-key"
    }
  }
}
```

### Custom Providers

Register entirely new providers:

```json
{
  "customProviders": {
    "my-llm": {
      "baseURL": "https://my-llm-api.example.com/v1",
      "apiKey": "my-key",
      "defaultModel": "my-model-v1"
    }
  }
}
```

Then use it with the `custom:` prefix:

```
You: /model custom:my-llm/my-model-v1
```

## Model Routing

Tino's model broker (`src/runtime/model-broker.ts`) uses a prefix map to detect the provider:

| Prefix | Provider |
|--------|----------|
| `claude-` | Anthropic |
| `gemini-` | Google |
| `grok-` | xAI |
| `kimi-` | Moonshot |
| `openrouter:` | OpenRouter |
| `custom:` | Custom providers |
| `ollama:` | Ollama |
| _(no prefix)_ | OpenAI (default) |

Settings values (from `providers` or `providerOverrides`) take precedence over environment variables for each provider.

## When to Use Which Model

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| General trading research | `gpt-5.2` (default) | Strong reasoning, fast |
| Complex strategy analysis | `claude-sonnet-4-5` | Excellent at long-form analysis |
| Quick price checks | `ollama:llama3` | Free, local, fast for simple tasks |
| Cost-sensitive batch work | `openrouter:` models | Access to cheaper models |
| Regulatory/compliance research | `claude-sonnet-4-5` | Strong at document analysis |

## Next Steps

- [Settings Reference](/reference/settings) -- full settings schema
- [Installation](/getting-started/installation) -- setting up API keys
- [Tools Reference](/reference/tools) -- what tools are available to each model
