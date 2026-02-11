# TINO — PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-11
**Commit:** 23518a9
**Branch:** main

## OVERVIEW

AI-powered quantitative trading CLI workbench. Bun + Ink (React TUI) frontend, Python daemon (NautilusTrader) backend, connected via gRPC (ConnectRPC). Vercel AI SDK ReAct agent with 11 consolidated tools across 8 financial data providers.

> **WARNING**: The `~/.claude/CLAUDE.md` describes Tauri/Rust/pnpm. None of that exists here. This is a Bun CLI app.

## STRUCTURE

```
tino/
├── src/                    # TypeScript CLI (Bun + Ink)
│   ├── index.tsx           # ENTRY: #!/usr/bin/env bun → renders <CLI/>
│   ├── cli.tsx             # Main Ink component (state machine, runtime wiring)
│   ├── theme.ts            # Color theme constants
│   ├── runtime/            # Core engine: agent loop, model broker, tool registry, permissions, hooks, WAL
│   ├── domain/             # Type contracts: ToolPlugin, RunEvent, Permission, Hook, AgentDef
│   ├── config/             # Settings, env, permissions, hooks (loaded from .tino/)
│   ├── plugins/            # External plugin discovery (~/.tino/plugins/, .tino/plugins/)
│   ├── tools/              # 11 consolidated tools + provider implementations
│   ├── grpc/               # gRPC clients → Python daemon (ConnectRPC)
│   ├── daemon/             # Python daemon lifecycle (spawn/stop/health)
│   ├── skills/             # Markdown skill system (8 builtin workflows)
│   ├── components/         # Ink TUI components (charts, inputs, panels, events)
│   ├── hooks/              # React hooks (session runner, model selection, input)
│   ├── commands/           # Slash commands (/model, /clear, /skill, /help)
│   ├── evals/              # LangSmith evaluation framework
│   └── utils/              # Cache, tokens, history, logging, UI helpers
├── python/                 # Python daemon (NautilusTrader gRPC wrapper)
│   ├── tino_daemon/        # Daemon package
│   │   ├── services/       # gRPC service implementations (backtest, trading, data, daemon)
│   │   ├── nautilus/       # NautilusTrader engine wrapper
│   │   ├── wranglers/      # Data format converters
│   │   └── proto/          # AUTO-GENERATED stubs. DO NOT EDIT.
│   └── tests/
├── proto/                  # Protobuf IDL (source of truth for gRPC)
├── templates/              # Strategy templates (Python)
├── examples/               # Example strategies (Python)
└── scripts/                # Release script
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add LLM provider | `src/runtime/model-broker.ts` | Add to `PREFIX_MAP` + `createModel()` switch |
| Add agent tool | `src/tools/consolidated/*.tool.ts` | `definePlugin()` + description in `descriptions/` — auto-discovered by glob |
| Add financial data source | `src/tools/finance/` | Follow existing provider pattern (see `fmp/`, `fred/`) |
| Modify agent behavior | `src/runtime/prompt-builder.ts` | System prompt, tool usage policy |
| Modify agent loop | `src/runtime/session-runtime.ts` | ReAct loop: streamText → tools → prune → repeat |
| Add gRPC service | `proto/` → `buf generate` → `src/grpc/` + `python/tino_daemon/services/` | Proto first, codegen, then clients |
| Add skill workflow | `src/skills/<name>/SKILL.md` | YAML frontmatter + markdown body |
| Add UI component | `src/components/` | Ink (`<Box>`, `<Text>`), not DOM |
| Modify CLI commands | `src/commands/slash.ts` | `parseSlashCommand()` |
| Add external plugin | `~/.tino/plugins/` or `.tino/plugins/` | Export default `definePlugin()` |
| Python daemon logic | `python/tino_daemon/` | NautilusTrader, gRPC services |
| Trading safety | `src/tools/consolidated/trading-live.tool.ts` | `confirmed=true` gate for live orders |
| Permission rules | `src/config/permissions.ts` → `.tino/permissions.json` | allow/deny/ask per tool |
| Settings | `src/config/settings.ts` | Global `~/.tino/settings.json` + Project `.tino/settings.json` |
| Lifecycle hooks | `src/config/hooks.ts` → `.tino/hooks.json` | SessionStart, PreToolUse, PostToolUse, Stop |

## ARCHITECTURE

```
┌────────────────────────────┐     gRPC (ConnectRPC)     ┌──────────────────────┐
│  TypeScript CLI (Bun)      │ ◄───────────────────────►│  Python Daemon        │
│                            │    127.0.0.1:50051       │                       │
│  cli.tsx (Ink TUI)         │                           │  NautilusTrader       │
│    └─ SessionRuntime       │                           │  Backtest/Trade/Data  │
│         ├─ ModelBroker     │                           │  gRPC Services (5)    │
│         ├─ ToolRegistry    │                           └──────────────────────┘
│         ├─ PermissionEngine│
│         ├─ HookRunner      │
│         └─ PromptBuilder   │
└────────────────────────────┘
```

**Agent loop** (SessionRuntime.startRun):
```
Query → [streamText → toolBatch → permissions.check → executeToolCall → pruneContext] × 10 → answer
```

**Tool discovery**: `ToolRegistry.discoverTools()` scans `src/tools/consolidated/**/*.tool.ts` via `Bun.Glob`. No explicit registration — file existence = tool exists.

**Plugin discovery**: `discoverPlugins()` scans `~/.tino/plugins/` + `.tino/plugins/` for additional `*.tool.ts` files.

## CONVENTIONS

- **Runtime**: Bun only. Use `Bun.spawn()`, `bun test`, `bun run`. No Node.js APIs unless also Bun-compatible.
- **Path aliases**: `@/*` maps to `./src/*` via tsconfig paths.
- **Module style**: ESM-only (`"type": "module"`), `.js` extensions in imports even for `.ts` files.
- **State management**: React `useState` + `useCallback` + `useRef`. No external state libraries.
- **Error handling**: Never throw in cache operations. Retry with backoff for API/LLM calls. Agent captures tool errors and continues.
- **Tool descriptions**: Rich descriptions in `src/tools/descriptions/` injected into system prompt. Separate from tool implementation.
- **Protobuf codegen**: Proto IDL in `proto/` → `buf generate` → TS in `src/grpc/gen/`, Python in `python/tino_daemon/proto/`. Never edit generated files.
- **Modular code**: 200 LOC hard limit per file (enforced by `.sisyphus/rules/`). Single responsibility per file.
- **AI SDK**: Vercel AI SDK (`ai` package) for `streamText`/`generateText`. Not LangChain.

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** guess URLs — use only URLs visible in browser snapshots
- **NEVER** start live trading without explicit user consent; **ALWAYS** prefer paper trading
- **NEVER** cache live market snapshot data (Polygon)
- **Do NOT** import os, subprocess, socket, shutil, requests, urllib, pathlib in generated strategies
- **Do NOT** use exec(), eval(), compile(), \_\_import\_\_() in strategies
- **Do NOT** break single queries into multiple tool calls when one suffices
- **Do NOT** use markdown headers or italics in agent responses
- Tool calls are **never blocked**, only warned (permissions can deny, hooks can block)
- Cache operations **never throw** (resilience pattern)
- All IO config operations (settings, env, permissions, hooks, PID files) are **non-fatal** — errors logged, never crash

## COMMANDS

```bash
bun run start          # Run CLI
bun run dev            # Dev with hot reload (--watch)
bun test               # Run all tests
bun run typecheck      # TypeScript type check (tsc --noEmit)

# Python daemon (spawned automatically by CLI if .tino/settings.json exists)
cd python && uv run --python 3.12 python -m tino_daemon

# Protobuf codegen
buf generate

# Release
./scripts/release.sh
```

## NOTES

- `jest.config.js` exists but CI uses `bun test`. Jest is vestigial.
- No ESLint, Prettier, or Biome configured. No lint/format scripts.
- Python tests (`python/tests/`) are **not in CI** — run manually with `cd python && uv run pytest`.
- `postinstall` installs Playwright/Chromium (for browser tool, not testing). CI skips this with `--ignore-scripts`.
- Daemon auto-restarts on crash (max 3 attempts, 1s delay). PID tracked in `.tino/daemon.pid`.
- `CONTEXT_THRESHOLD` = 100k tokens triggers oldest-message clearing. `TOKEN_BUDGET` = 150k.
- Default model: `gpt-5.2` (OpenAI). 8 providers supported via prefix matching in `model-broker.ts`.
- `src/utils/` has duplicate modules with `src/config/` (env.ts, config.ts vs settings.ts). `src/config/` is canonical.
- CI runs typecheck + test only. No lint, no format, no Python tests.
