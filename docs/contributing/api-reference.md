# Plugin API Reference

Complete API reference for Tino plugin development.

## ToolPlugin Interface

```typescript
interface ToolPlugin<T extends z.ZodType = z.ZodType> {
  id: string;
  domain: string;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  description: string;
  schema: T;
  execute: (args: unknown, ctx: ToolContext) => Promise<string>;
}
```

### id

- **Type**: `string`
- **Required**: Yes
- **Convention**: `snake_case`, globally unique
- **Examples**: `fear_greed_index`, `custom_exchange`, `technical_indicators`

The agent uses this as the tool name. Must not conflict with built-in tool IDs:
`market_data`, `macro_data`, `fundamentals`, `quant_compute`, `crypto_derivatives`,
`funding_rate_arbitrage`, `portfolio`, `chart`, `streaming`, `backtest_history`,
`strategy_lab`, `browser`, `skill`.

### domain

- **Type**: `string`
- **Required**: Yes
- **Common values**: `finance`, `trading`, `utility`, `data`, `analysis`

Used for logical grouping. Does not affect runtime behavior, but helps organize tools in the system prompt.

### riskLevel

- **Type**: `'safe' | 'moderate' | 'dangerous'`
- **Required**: Yes

Controls the permission system behavior:

| Value | Permission Behavior | Typical Use |
|-------|-------------------|-------------|
| `safe` | Auto-approved in permissive modes | Read-only queries, public APIs |
| `moderate` | Requires user approval in default mode | State modifications, file writes |
| `dangerous` | Always requires explicit confirmation | Order placement, fund transfers, code execution |

The permission system maps risk levels to approval requirements based on the user's configured permission mode (see `src/config/permissions.ts`).

### description

- **Type**: `string`
- **Required**: Yes

Injected into the LLM system prompt. This is the primary way the agent decides when to use your tool. Write clear, structured descriptions:

```typescript
const description = `
Short summary of what this tool does.

## When to Use

- Specific scenario 1
- Specific scenario 2

## When NOT to Use

- Anti-pattern 1 (use X instead)

## Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| action1 | What it does | param1, param2 |

## Usage Notes

- Important caveats or requirements
`.trim();
```

### schema

- **Type**: `z.ZodType` (from the `zod` library)
- **Required**: Yes

Defines the input parameters for the tool. The agent generates arguments matching this schema. Use `.describe()` on each field to help the agent provide correct values:

```typescript
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['fetch', 'search']).describe('The operation to perform'),
  query: z.string().optional().describe('Search query (required for search action)'),
  limit: z.number().min(1).max(100).optional().describe('Max results (default 10)'),
});
```

**Supported Zod types**: `z.string()`, `z.number()`, `z.boolean()`, `z.enum()`, `z.array()`, `z.object()`, `z.optional()`, `z.literal()`, `z.union()`. Avoid complex types like `z.lazy()` or `z.transform()` as they may not serialize correctly to the LLM tool spec.

### execute

- **Type**: `(args: unknown, ctx: ToolContext) => Promise<string>`
- **Required**: Yes

The implementation function. Receives raw (unparsed) arguments and a context object. Must return a JSON string.

```typescript
execute: async (raw: unknown, ctx: ToolContext) => {
  // Always parse with your schema first
  const input = schema.parse(raw);

  // Do work...
  const result = await fetchData(input);

  // Must return a JSON string
  return JSON.stringify(result);
}
```

**Error handling**: Return errors as JSON rather than throwing:

```typescript
execute: async (raw: unknown) => {
  try {
    const input = schema.parse(raw);
    const data = await riskyOperation(input);
    return JSON.stringify({ data });
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

## ToolContext Interface

```typescript
interface ToolContext {
  signal: AbortSignal;
  onProgress: (msg: string) => void;
  config: Record<string, unknown>;
  grpc?: GrpcClients;
}
```

### signal

- **Type**: `AbortSignal`

Signals when the user cancels the operation or a timeout is reached. Pass to `fetch()` and other async operations:

```typescript
const res = await fetch(url, { signal: ctx.signal });
```

### onProgress

- **Type**: `(msg: string) => void`

Reports progress to the user during long-running operations. Messages appear in the TUI as the tool executes:

```typescript
ctx.onProgress('Fetching page 1 of 5...');
// ... work ...
ctx.onProgress('Fetching page 2 of 5...');
```

### config

- **Type**: `Record<string, unknown>`
- **Deprecated**: Use typed fields when available

Access to runtime configuration. Useful for reading API keys or settings:

```typescript
const apiKey = ctx.config['MY_API_KEY'] as string | undefined;
if (!apiKey) {
  return JSON.stringify({ error: 'MY_API_KEY not configured' });
}
```

### grpc

- **Type**: `GrpcClients | undefined`

Typed gRPC clients for communicating with the Python daemon. Only available when the daemon is running.

```typescript
interface GrpcClients {
  trading: TradingClient;      // Order management, positions
  backtest: BacktestClient;    // Backtest execution
  portfolio: PortfolioClient;  // Portfolio queries
  chart: ChartClient;          // Chart generation
  streaming: StreamingClient;  // Real-time data streams
  data: DataClient;            // Historical data queries
  exchange: ExchangeClient;    // Exchange operations
}
```

Example usage:

```typescript
if (ctx.grpc) {
  const positions = await ctx.grpc.portfolio.getPositions({});
  return JSON.stringify(positions);
} else {
  return JSON.stringify({ error: 'Daemon not running. Start with: tino daemon start' });
}
```

## definePlugin Helper

```typescript
import { definePlugin } from '@/domain/index.js';
// or for external plugins:
// Just export the object directly — definePlugin is optional
```

`definePlugin` is a typed identity function that provides TypeScript IntelliSense. It does not transform the object. External plugins can skip it and export a plain object matching the `ToolPlugin` shape.

```typescript
// With definePlugin (for built-in tools with @/ alias):
import { definePlugin } from '@/domain/index.js';
export default definePlugin({ id: 'my_tool', ... });

// Without definePlugin (for external plugins):
export default { id: 'my_tool', ... };
```

Both approaches are equivalent at runtime.

## Plugin Discovery Details

### Scan Order

1. `~/.tino/plugins/` (global)
2. `.tino/plugins/` (project-local, relative to `process.cwd()`)

### File Resolution

- Only `.ts` files are loaded
- For directories, the entry point must be at the directory root level
- Each file's `default` export is checked first, then the module object itself

### Deduplication

If multiple plugins share the same `id`, the first one discovered wins (global before project-local). Duplicates are silently skipped.

### Validation

A loaded module is considered a valid plugin if it has:
- `id`: `string`
- `schema`: any defined value
- `execute`: `function`

Missing or invalid plugins produce a warning log but do not crash the application.

## Built-in Tool IDs (Reserved)

These IDs are used by Tino's built-in tools and must not be used by plugins:

| ID | Domain |
|----|--------|
| `market_data` | finance |
| `macro_data` | finance |
| `fundamentals` | finance |
| `quant_compute` | finance |
| `crypto_derivatives` | finance |
| `funding_rate_arbitrage` | finance |
| `portfolio` | trading |
| `chart` | visualization |
| `streaming` | data |
| `backtest_history` | trading |
| `strategy_lab` | trading |
| `browser` | utility |
| `skill` | utility |
