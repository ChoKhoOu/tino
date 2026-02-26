## Why

The Tino CLI is the primary user interface, but its current implementation is fundamentally limited: a static dual-panel layout with no streaming output, primitive single-line input, keyword-based command routing, and zero operational visibility during AI interactions. Users experience 5-30 second black-box waits with only "Thinking..." as feedback. The interaction quality gap compared to modern AI CLI tools (Claude Code, Codex CLI) is severe, and there is no terminal visualization for quantitative trading data (backtest progress, equity curves, trade execution). This overhaul transforms the CLI from a basic chat wrapper into a professional AI-native trading terminal.

## What Changes

- **BREAKING**: Replace the fixed 60/40 dual-panel layout with a pure linear conversation flow
- **BREAKING**: Replace keyword-based command handling (`if input === 'help'`) with a `/slash` command system
- **BREAKING**: Replace the monolithic `app.tsx` (267 lines, all logic coupled) with a modular architecture: command router, message bus, and composable components
- Add streaming LLM output via Anthropic streaming API (`content_block_delta` events) with real-time token rendering
- Add terminal markdown rendering (headings, bold, lists, tables, code blocks with syntax highlighting)
- Add operational visibility: spinners with descriptive labels during AI processing, collapsible tool result sections
- Add multi-line input support with command history persistence
- Add a persistent status bar showing model info, token usage, engine status, and keybinding hints
- Add cancellation support: Ctrl+C cancels in-flight LLM requests (instead of killing the process)
- Add backtest progress visualization via WebSocket events (`backtest.progress` → real-time progress bar with trade count and running PnL)
- Add ASCII equity curve rendering from `equity_curve` data after backtest completion
- Add rich backtest result tables (per-pair breakdown, summary metrics, exit reason analysis)
- Add real-time trade execution notifications from WebSocket `live.trade_executed` events
- Add inline risk alert rendering from `live.risk_alert` and `live.risk_circuit_breaker` events with high-priority visual treatment
- Add persistent paper/live mode visual differentiation (green single-border vs red double-border, explicit labeling)
- Add global kill switch (Ctrl+K) accessible from any state, cancels all orders and flattens positions
- Upgrade Ink from v5.1.0 to v6.x

## Capabilities

### New Capabilities
- `streaming-output`: Streaming LLM token rendering with markdown, syntax highlighting, and collapsible sections using Ink's `<Static>` + live area pattern
- `slash-commands`: Extensible `/command` system replacing keyword-based routing, with `/help`, `/new`, `/save`, `/backtest`, `/deploy`, `/status`, `/kill`, `/clear`
- `input-experience`: Multi-line text input with cursor navigation, command history persistence, Ctrl+C cancellation, and paste support
- `backtest-visualization`: Real-time backtest progress bar via WebSocket, ASCII equity curves, and rich metric tables in terminal
- `live-trading-display`: Real-time trade notifications, position updates, risk alerts with visual priority levels, and paper/live mode differentiation
- `status-bar`: Persistent bottom bar showing model, token usage, engine health, active session info, and keybinding hints

### Modified Capabilities
- `daemon-lifecycle`: No requirement changes (daemon management is unaffected; only the UI layer that sits on top changes)

## Impact

**Boundary**: This change is entirely within the **Node.js UI boundary**. No Python engine changes required. No cross-language API contract changes. All existing WebSocket event schemas and REST API contracts are consumed as-is.

**Affected code**:
- `packages/cli/src/` — near-complete rewrite of UI layer
  - `index.tsx` — startup flow preserved, render target changes
  - `app.tsx` — replaced entirely with modular architecture
  - `components/` — all components rewritten or replaced
  - `services/llm-client.ts` — add streaming method alongside existing non-streaming
  - `agents/strategy-agent.ts` — adapt to streaming output and new command routing
- `packages/cli/package.json` — new dependencies added

**New dependencies**:
- `ink` upgraded from `^5.1.0` to `^6.x`
- `marked` + `marked-terminal` — markdown rendering
- `cli-highlight` — syntax highlighting (via marked-terminal)
- `ink-spinner` — loading indicators
- `simple-ascii-chart` — equity curve rendering
- `cli-table3` — backtest result tables

**Unchanged**:
- `packages/shared/` — all schemas, engine client, WS client consumed as-is
- `engine/` — no changes
- `packages/dashboard/` — no changes

## Risk Assessment

**Live trading safety**: This change does NOT modify any live trading logic, risk controls, or engine communication protocols. All existing safety gates (human confirmation for live deployment, kill switch API, risk circuit breakers) are preserved. The new CLI surfaces these controls more prominently (Ctrl+K global kill switch, visual risk alerts) but does not alter their underlying behavior.

**Rollback plan**: The existing CLI code can be preserved on a branch. Since all changes are within `packages/cli/src/` and `packages/cli/package.json`, rollback is a simple `git revert` of the CLI package. No database migrations, no API changes, no engine modifications to reverse.

**Risk level**: Low — pure UI-layer change consuming existing stable APIs.
