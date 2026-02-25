# Plugin Development Guide

This guide walks you through creating plugins for Tino. Plugins extend Tino's capabilities by adding new tools that the AI agent can invoke during conversations.

## Overview

Tino's plugin system is built on a simple contract: export a `ToolPlugin` object with a schema and an execute function. The agent discovers your plugin automatically at startup.

### Plugin Architecture

```
~/.tino/plugins/
  my-plugin.ts          # Single-file plugin (simplest)
  my-complex-plugin/
    index.ts             # Entry point (default export)
    helpers.ts           # Internal modules

.tino/plugins/           # Project-local plugins (higher priority)
  project-tool.ts
```

Tino scans two directories for plugins:

1. **Global**: `~/.tino/plugins/` — available in all projects
2. **Project-local**: `.tino/plugins/` (relative to working directory) — project-specific

Files must have a `.ts` extension. Each file's default export (or module export) is validated against the `ToolPlugin` interface.

### Plugin Lifecycle

```
Startup
  │
  ├─ Scan ~/.tino/plugins/ and .tino/plugins/
  ├─ For each .ts file:
  │    ├─ Dynamic import
  │    ├─ Extract default export (or module root)
  │    ├─ Validate: must have id (string), schema (zod), execute (function)
  │    └─ Register with ToolRegistry
  │
  └─ Deduplicate by id (first wins)
```

## Quick Start

### 1. Create a Plugin File

Create `~/.tino/plugins/hello-world.ts`:

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().describe('Name to greet'),
});

export default {
  id: 'hello_world',
  domain: 'utility',
  riskLevel: 'safe' as const,
  description: 'A simple greeting tool for testing plugin development.',
  schema,
  execute: async (raw: unknown) => {
    const { name } = schema.parse(raw);
    return JSON.stringify({ message: `Hello, ${name}! Plugin system is working.` });
  },
};
```

### 2. Test It

Start Tino and ask: "Use the hello_world tool to greet Alice"

The agent will discover your plugin and invoke it automatically.

## Plugin Types

### Data Source Plugin

Fetches external data for the agent to analyze. Common examples: alternative data feeds, proprietary APIs, on-chain data.

```typescript
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['current', 'history']),
  limit: z.number().optional().describe('Number of records'),
});

export default {
  id: 'fear_greed_index',
  domain: 'finance',
  riskLevel: 'safe' as const,
  description: 'Fetches the Crypto Fear & Greed Index.',
  schema,
  execute: async (raw: unknown) => {
    const { action, limit } = schema.parse(raw);
    const url = action === 'current'
      ? 'https://api.alternative.me/fng/'
      : `https://api.alternative.me/fng/?limit=${limit ?? 10}`;
    const res = await fetch(url);
    const data = await res.json();
    return JSON.stringify(data);
  },
};
```

See `examples/plugins/data-source-example/` for a complete runnable example.

### Strategy Plugin

Provides strategy-related utilities like signal generation, position sizing, or indicator calculations.

```typescript
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['calculate_rsi', 'calculate_sma']),
  prices: z.array(z.number()).describe('Array of price values'),
  period: z.number().optional().describe('Calculation period (default 14)'),
});

export default {
  id: 'technical_indicators',
  domain: 'finance',
  riskLevel: 'safe' as const,
  description: 'Calculate technical indicators from price data.',
  schema,
  execute: async (raw: unknown) => {
    const { action, prices, period = 14 } = schema.parse(raw);
    // ... indicator calculation logic
    return JSON.stringify({ result: /* computed value */ });
  },
};
```

See `examples/plugins/strategy-example/` for a complete runnable example.

### Exchange Adapter Plugin

Connects to an exchange API. These should use `riskLevel: 'dangerous'` for any actions that place orders.

```typescript
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['balance', 'open_orders', 'ticker']),
  symbol: z.string().optional(),
});

export default {
  id: 'my_exchange',
  domain: 'trading',
  riskLevel: 'dangerous' as const,
  description: 'Connect to MyExchange API for trading operations.',
  schema,
  execute: async (raw: unknown, ctx: { signal: AbortSignal }) => {
    const input = schema.parse(raw);
    // Use ctx.signal for cancellation support
    const res = await fetch(`https://api.myexchange.com/${input.action}`, {
      signal: ctx.signal,
    });
    return JSON.stringify(await res.json());
  },
};
```

## The ToolPlugin Interface

Every plugin must satisfy this interface:

```typescript
interface ToolPlugin<T extends z.ZodType = z.ZodType> {
  id: string;           // Unique identifier (snake_case, e.g., 'my_plugin')
  domain: string;       // Category: 'finance', 'trading', 'utility', etc.
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  description: string;  // When/how the agent should use this tool
  schema: T;            // Zod schema defining the input parameters
  execute: (args: unknown, ctx: ToolContext) => Promise<string>;
}
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique tool identifier. Use `snake_case`. Must not conflict with built-in tools. |
| `domain` | `string` | Logical grouping. Common values: `finance`, `trading`, `utility`, `data`. |
| `riskLevel` | `'safe' \| 'moderate' \| 'dangerous'` | Controls permission prompts. See [Risk Levels](#risk-levels). |
| `description` | `string` | Guides the agent on when to use this tool. Be specific about capabilities and limitations. |
| `schema` | `z.ZodType` | Zod schema for input validation. Parameter descriptions become part of the tool spec. |
| `execute` | `(args, ctx) => Promise<string>` | The tool implementation. Must return a JSON string. |

### Risk Levels

| Level | Behavior | Use When |
|-------|----------|----------|
| `safe` | No confirmation needed | Read-only operations, public API queries |
| `moderate` | User prompted for permission | Writing data, modifying settings |
| `dangerous` | Explicit confirmation required | Placing orders, transferring funds, executing code |

## Writing Good Descriptions

The `description` field is critical — it tells the AI agent when and how to use your tool. Follow the pattern used by built-in tools:

```typescript
const description = `
Fetches the Crypto Fear & Greed Index from Alternative.me.

## When to Use

- Assessing overall crypto market sentiment
- Combining with price data for contrarian signals
- Historical sentiment analysis

## When NOT to Use

- Stock market sentiment (crypto-only)
- Real-time trading signals (updated daily, not real-time)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| current | Get latest index value | (none) |
| history | Get historical values | limit (optional) |
`.trim();
```

## Using the ToolContext

The second argument to `execute` provides runtime context:

```typescript
execute: async (raw: unknown, ctx: ToolContext) => {
  // AbortSignal — respect cancellation
  const res = await fetch(url, { signal: ctx.signal });

  // Progress reporting — shown to user during execution
  ctx.onProgress('Fetching data from API...');

  // Config — access to runtime settings
  const apiKey = ctx.config['MY_PLUGIN_API_KEY'] as string;

  // gRPC clients — interact with the Python daemon
  if (ctx.grpc) {
    const portfolio = await ctx.grpc.portfolio.getPositions({});
  }

  return JSON.stringify(result);
}
```

## Testing Your Plugin

### Manual Testing

1. Copy your plugin to `~/.tino/plugins/`
2. Start Tino: `bun run start`
3. Ask the agent to use your tool

### Automated Testing

Write tests using Bun's test runner:

```typescript
import { describe, test, expect } from 'bun:test';

// Import your plugin directly
import plugin from './index.ts';

describe('my-plugin', () => {
  test('has valid plugin structure', () => {
    expect(plugin.id).toBe('my_plugin');
    expect(plugin.domain).toBeString();
    expect(typeof plugin.execute).toBe('function');
    expect(plugin.schema).toBeDefined();
  });

  test('executes correctly', async () => {
    const result = await plugin.execute(
      { action: 'current' },
      { signal: AbortSignal.timeout(5000), onProgress: () => {}, config: {} },
    );
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
  });
});
```

### Validation Testing

Test that Tino's plugin discovery can load your plugin:

```typescript
import { describe, test, expect } from 'bun:test';

function isValidPlugin(value: unknown): value is { id: string; schema: unknown; execute: Function } {
  if (value == null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.schema !== 'undefined' &&
    typeof obj.execute === 'function'
  );
}

test('plugin passes Tino validation', async () => {
  const mod = await import('./index.ts');
  const plugin = mod.default ?? mod;
  expect(isValidPlugin(plugin)).toBe(true);
});
```

## Publishing and Distribution

### Sharing via Git

The simplest distribution method:

1. Create a git repository with your plugin
2. Users clone it into their plugins directory:
   ```bash
   git clone https://github.com/you/tino-plugin-example ~/.tino/plugins/tino-plugin-example
   ```
3. Ensure the entry point is `index.ts` or a single `.ts` file in the cloned directory root

### Plugin Naming Convention

- Repository: `tino-plugin-<name>` (e.g., `tino-plugin-fear-greed`)
- Plugin ID: `snake_case` (e.g., `fear_greed_index`)
- Avoid prefixes like `tino_` in the plugin ID — the namespace is implied

### Dependencies

Plugins run in the same Bun process as Tino. They can import:

- `zod` — always available (Tino dependency)
- `@connectrpc/*` — if using gRPC clients
- Any npm package installed in Tino's `node_modules/`

For external dependencies, document them clearly and instruct users to install them.

## Scaffolding a New Plugin

Use the init script to generate plugin boilerplate:

```bash
bun run scripts/init-plugin.ts my-data-source
```

This creates a ready-to-use plugin structure. See [scripts/init-plugin.ts](../../scripts/init-plugin.ts) for details.
