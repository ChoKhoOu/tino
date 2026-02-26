## Context

The Tino CLI (`packages/cli/`) is built with React Ink v5 and uses a monolithic `app.tsx` component that couples command routing, LLM interaction, state management, and rendering in a single 267-line file. The LLM client (`services/llm-client.ts`) uses non-streaming `fetch` calls. The shared package (`packages/shared/`) provides a WebSocket client with auto-reconnect and a rich event schema (backtest progress, live trading events, risk alerts) that the CLI does not yet consume visually. The engine REST API client is also in shared and already supports all needed operations (strategies, backtests, live sessions, risk profiles).

This design covers the complete rewrite of the CLI's UI layer while preserving all existing backend infrastructure (daemon lifecycle, engine communication, shared schemas).

## Goals / Non-Goals

**Goals:**
- Replace the dual-panel layout with a linear conversation flow matching modern AI CLI patterns
- Add streaming LLM output with real-time markdown rendering and syntax highlighting
- Create a modular, extensible architecture (command router, message bus, composable components)
- Surface quantitative trading data visually: backtest progress, equity curves, trade notifications, risk alerts
- Make all dangerous operations (live trading) visually distinct with appropriate confirmation flows
- Provide operational transparency: users always know what the system is doing

**Non-Goals:**
- No changes to the Python engine or any cross-language API contracts
- No changes to the daemon lifecycle management (`daemon/` directory) — only the UI layer on top
- No persistent storage or configuration system (future work)
- No mouse support or advanced terminal features (scroll regions, split panes)
- No custom terminal rendering engine — stay within Ink's React model
- No changes to prompt templates or LLM tool schemas (those are separate concerns)

## Decisions

### D1: Stay with Ink, upgrade to v6

**Choice**: Upgrade `ink` from `^5.1.0` to `^6.x` (latest v6.8.0).

**Alternatives considered**:
- **blessed/neo-blessed**: More powerful TUI widgets (scrolling, panels, charts), but the core library is unmaintained (last blessed publish: 10+ years ago). neo-neo-blessed has 14 stars. The imperative programming model conflicts with React patterns already in use.
- **terminal-kit**: Good features but callback-based API, no TypeScript source, moderate community.
- **Raw ANSI + readline**: Maximum control but enormous effort to rebuild what Ink already provides.

**Rationale**: Both Claude Code and OpenAI Codex chose Ink. v6 aligns with newer React internals (react-reconciler 0.33). The existing codebase already uses Ink, minimizing migration friction. Ink's `<Static>` component solves the streaming output pattern cleanly.

### D2: Linear conversation flow with `<Static>` + live area

**Choice**: Use Ink's `<Static>` component for completed messages and a live render area for the current streaming response.

**How it works**:
```
<Box flexDirection="column">
  <Static items={completedMessages}>        ← rendered once, never re-rendered
    {(msg, i) => <Message key={i} ... />}
  </Static>
  <LiveArea>                                 ← re-renders on every stream chunk
    <StreamingMessage text={currentChunk} />
    <Spinner label="Generating strategy..." />
  </LiveArea>
  <StatusBar />                              ← persistent bottom bar
  <InputArea />                              ← user input
</Box>
```

**Rationale**: This is the proven pattern from Claude Code. `<Static>` items are printed once and scroll off naturally (like terminal output), avoiding the performance cost of re-rendering the entire message history. The live area below handles the active streaming content with Ink's 30 FPS throttle.

### D3: Modular architecture with message bus

**Choice**: Replace the monolithic `app.tsx` with a layered architecture:

```
core/
  message-store.ts    — Zustand-like store for conversation messages
  command-registry.ts — Register/dispatch slash commands
  streaming-client.ts — Anthropic streaming API wrapper

commands/
  help.ts, new.ts, save.ts, backtest.ts, deploy.ts, status.ts, kill.ts, clear.ts

components/
  App.tsx              — Top-level layout (Static + LiveArea + StatusBar + Input)
  Message.tsx          — Single message renderer (user/assistant/system)
  MarkdownText.tsx     — marked + marked-terminal output as Ink <Text>
  CodeBlock.tsx        — Syntax-highlighted code with cli-highlight
  Spinner.tsx          — Descriptive spinner (wraps ink-spinner)
  Collapsible.tsx      — Expandable/collapsible section
  ProgressBar.tsx      — Backtest progress with trade count + PnL
  EquityCurve.tsx      — ASCII chart from equity_curve data
  BacktestResult.tsx   — Rich table from BacktestMetrics
  TradeNotification.tsx— Inline trade execution notification
  RiskAlert.tsx        — High-priority risk alert banner
  ModeBanner.tsx       — Paper/Live mode indicator
  ConfirmDialog.tsx    — Type-to-confirm for dangerous operations
  StatusBar.tsx        — Persistent bottom bar
  InputArea.tsx        — Multi-line input with history

hooks/
  useStreamingLLM.ts   — Hook for streaming LLM calls
  useWebSocket.ts      — Hook wrapping EngineWsClient for React lifecycle
  useCommandHistory.ts — Persistent command history
```

**Rationale**: Separating concerns enables independent testing, easier feature additions, and prevents the monolith problem. The command registry pattern makes adding new `/commands` trivial (one file per command). The message store centralizes conversation state.

### D4: Streaming LLM via Anthropic streaming API

**Choice**: Add a `streamStrategy()` method to `LLMClient` that returns an `AsyncGenerator<StreamChunk>`.

**Approach**:
1. Use `fetch` with `stream: true` against `POST /v1/messages` with Anthropic streaming
2. Parse SSE events: `message_start`, `content_block_start`, `content_block_delta`, `message_stop`
3. For text content: yield `text_delta` chunks immediately for UI rendering
4. For tool_use content: accumulate JSON fragments, yield complete tool input when `content_block_stop` fires
5. Expose an `AbortController` for Ctrl+C cancellation

**Keep existing non-streaming methods**: The structured `_callWithTool` method remains for commands that need complete JSON responses (e.g., `/save`). Streaming is for the conversational flow.

### D5: Markdown rendering pipeline

**Choice**: `marked` → `marked-terminal` → Ink `<Text>` with raw ANSI.

**Pipeline**:
1. Streaming text chunks are accumulated into a buffer
2. On each render frame (~33ms), the buffer is parsed by `marked` with `marked-terminal` renderer
3. `marked-terminal` uses `cli-highlight` (highlight.js) for code block syntax highlighting
4. The resulting ANSI string is rendered as Ink `<Text>` content

**Alternative considered**: Custom AST-to-Ink-components renderer (converting markdown AST nodes to `<Text bold>`, `<Box borderStyle>`, etc.). Rejected because marked-terminal is battle-tested and the ANSI string approach is simpler while producing identical visual output.

### D6: Slash command system

**Choice**: Commands prefixed with `/` are routed to registered command handlers. Everything else goes to the LLM agent.

**Registry pattern**:
```typescript
interface Command {
  name: string;
  description: string;
  execute(args: string, context: CommandContext): Promise<void>;
}
```

Commands are registered at startup. The input handler checks for `/` prefix, looks up the command, and dispatches. Unknown `/commands` show an error with suggestions. Non-slash input flows to the strategy agent.

### D7: Backtest visualization via existing WebSocket events

**Choice**: Connect to the engine WebSocket and render `backtest.progress` events as a real-time progress bar, `backtest.completed` as a rich result panel with equity curve.

**Data flow**:
1. `/backtest` command calls `EngineClient.submitBacktest()` → gets `ws_url`
2. Connect `EngineWsClient` to the backtest WebSocket
3. `backtest.progress` events → update `<ProgressBar>` component (progress_pct, trades_so_far, current_pnl)
4. `backtest.completed` event → render `<BacktestResult>` with metrics table + `<EquityCurve>` from equity_curve data
5. `backtest.failed` event → render error with message

**Chart rendering**: Use `simple-ascii-chart` (TypeScript native, zero deps) to render equity curve points as an ASCII line chart inside an Ink `<Box>`.

### D8: Paper/Live mode differentiation and kill switch

**Choice**: Visual differentiation through a persistent `<ModeBanner>` component at the top, plus a global Ctrl+K handler.

**Paper mode**: Green single-line border, "PAPER TRADING" label, "(simulated)" suffix on balances.
**Live mode**: Red double-line border, "LIVE TRADING" label, "(REAL MONEY)" suffix.

**Kill switch (Ctrl+K)**:
1. Intercept at the top-level `useInput` handler (always active regardless of current command state)
2. Call `EngineClient.killSwitch()` → cancels all orders, flattens positions
3. Display confirmation of actions taken
4. Does NOT exit the CLI — user can restart or investigate

**Live deployment confirmation**: Uses a type-to-confirm dialog ("Type CONFIRM LIVE to proceed") with a mandatory 3-second cooldown before the input field activates.

## Risks / Trade-offs

**[Memory overhead]** → Ink + React adds ~400MB RAM per instance. Mitigation: acceptable for a desktop trading tool; not targeting resource-constrained environments.

**[CJK IME input latency]** → Known Ink issue (200-500ms for CJK users). Mitigation: Monitor upstream fixes; if critical, implement a custom input component that bypasses ink-text-input for raw stdin.

**[No terminal scrollback in live area]** → Ink's live area cannot be scrolled. Mitigation: `<Static>` handles completed messages which enter normal terminal scrollback. Only the current streaming response lacks scroll — acceptable since it's transient.

**[Streaming + tool_use complexity]** → Anthropic streaming with `tool_choice: tool` requires accumulating partial JSON. Mitigation: The streaming client accumulates tool input fragments and only yields the complete tool result, keeping component logic simple.

**[Large dependency surface]** → Adding ~6 new dependencies. Mitigation: All are well-established (marked: 295M weekly downloads, cli-highlight: battle-tested, simple-ascii-chart: zero deps). Pin versions in package.json.

**[Breaking change for existing users]** → The interaction model changes completely. Mitigation: This is v0.x software with no external users yet. The change is a clear upgrade, not a regression.
