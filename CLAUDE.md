# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tino is an AI-powered quantitative trading CLI workbench. TypeScript CLI (Bun + React/Ink TUI) frontend, Python daemon (NautilusTrader) backend, connected via gRPC (ConnectRPC) on `127.0.0.1:50051`. Vercel AI SDK ReAct agent with 14 consolidated tools across 6 financial data providers.

## Commands

```bash
bun run start              # Run CLI
bun run dev                # Dev with hot reload (--watch)
bun test                   # Run all tests (Bun's native runner, NOT Jest)
bun test src/path/file.test.ts  # Run single test file
bun run typecheck          # tsc --noEmit

# Python daemon (auto-spawned by CLI, or manually)
cd python && uv run --python 3.12 python -m tino_daemon

# Protobuf codegen (proto/ is source of truth)
buf generate

# Python tests (not in CI)
cd python && uv run pytest
```

Biome linter enabled (formatter disabled). No ESLint or Prettier. CI runs typecheck + test only.

## Architecture

```
TypeScript CLI (Bun)            gRPC (ConnectRPC)           Python Daemon
cli.tsx (Ink TUI)          ◄──────────────────────►    NautilusTrader
  └─ SessionRuntime                                    gRPC Services (5)
       ├─ ModelBroker        127.0.0.1:50051           Backtest/Trade/Data
       ├─ ToolRegistry
       ├─ PermissionEngine
       ├─ HookRunner
       └─ PromptBuilder
```

**Agent loop** (`src/runtime/session-runtime.ts`): `Query → [streamText → toolBatch → permissions.check → executeToolCall → pruneContext] × 10 → answer`. Context threshold 100k tokens triggers compaction; token budget 150k.

**Tool discovery**: `ToolRegistry.discoverTools()` scans `src/tools/consolidated/**/*.tool.ts` via `Bun.Glob`. File existence = tool registration. Tool descriptions live separately in `src/tools/descriptions/` and get injected into the system prompt.

**Plugin discovery**: External plugins scanned from `~/.tino/plugins/` and `.tino/plugins/`.

**Model routing**: Provider detected by model ID prefix in `src/runtime/model-broker.ts` (`PREFIX_MAP`). Supports claude-, gemini-, grok-, kimi-, openrouter:, custom:, ollama:, and OpenAI as default.

**gRPC flow**: Proto IDL in `proto/tino/` → `buf generate` → TS clients in `src/grpc/gen/` (never edit), Python stubs in `python/tino_daemon/proto/` (never edit).

## Where to Look

| Task                  | Location                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Add LLM provider      | `src/runtime/model-broker.ts` — `PREFIX_MAP` + `createModel()`                            |
| Add agent tool        | `src/tools/consolidated/*.tool.ts` — `definePlugin()` + description in `descriptions/`    |
| Add data source       | `src/tools/finance/` — follow existing provider pattern                                   |
| Modify agent behavior | `src/runtime/prompt-builder.ts` — system prompt                                           |
| Modify agent loop     | `src/runtime/session-runtime.ts`                                                          |
| Add gRPC service      | `proto/` → `buf generate` → `src/grpc/` + `python/tino_daemon/services/`                  |
| Add skill workflow    | `src/skills/<name>/SKILL.md` — YAML frontmatter + markdown                                |
| Add UI component      | `src/components/` — Ink (`<Box>`, `<Text>`), not DOM                                      |
| Slash commands        | `src/commands/slash.ts` — `parseSlashCommand()`                                           |
| Settings              | `src/config/settings.ts` — global `~/.tino/settings.json` + project `.tino/settings.json` |
| Permissions           | `src/config/permissions.ts` → `.tino/permissions.json`                                    |
| Hooks                 | `src/config/hooks.ts` → `.tino/hooks.json`                                                |
| Trading safety        | `src/tools/consolidated/trading-live.tool.ts` — `confirmed=true` gate                     |

## Conventions

- **Runtime**: Bun only. `Bun.spawn()`, `bun test`, `bun run`. No Node-only APIs.
- **Modules**: ESM-only (`"type": "module"`). Use `.js` extensions in imports even for `.ts` files.
- **Path alias**: `@/*` → `./src/*` (tsconfig paths).
- **State**: React `useState`/`useCallback`/`useRef` only. No Redux/Zustand.
- **AI SDK**: Vercel AI SDK (`ai` package) for `streamText`/`generateText`. Not LangChain.
- **Error resilience**: Cache ops never throw. IO config ops (settings, env, permissions, hooks, PID files) are non-fatal. Agent captures tool errors as strings and continues.
- **Protobuf**: Proto IDL in `proto/` is source of truth. Never edit generated files in `src/grpc/gen/` or `python/tino_daemon/proto/`.
- **Tests**: Bun's native test runner (`bun:test` module). `jest.config.js` is vestigial. Test files co-located as `__tests__/*.test.ts`. Use `ink-testing-library` for component tests.
- **Strategy safety**: Never allow `os`, `subprocess`, `socket`, `exec()`, `eval()` in generated Python strategies.

## Anti-Patterns

- Never guess URLs — only use URLs from verified sources
- Never start live trading without explicit user consent; prefer paper trading
- Never cache live market snapshot data (Polygon)
- Don't break single queries into multiple tool calls when one suffices
- Don't use markdown headers or italics in agent responses (plain text output)
