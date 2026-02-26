## 1. Dependencies and Project Setup (TypeScript)

- [x] 1.1 Upgrade `ink` from `^5.1.0` to `^6.x` in `packages/cli/package.json` and update `react`/`@types/react` to compatible versions
- [x] 1.2 Add new dependencies: `marked`, `marked-terminal`, `cli-highlight`, `ink-spinner`, `simple-ascii-chart`, `cli-table3` and their type declarations
- [x] 1.3 Verify the project builds cleanly with `npm run build` after dependency changes

## 2. Core Architecture (TypeScript)

- [x] 2.1 Create `packages/cli/src/core/message-store.ts` — Zustand-like store for conversation messages (user/assistant/system messages, streaming state, completed vs in-progress)
- [x] 2.2 Create `packages/cli/src/core/command-registry.ts` — Command registration and dispatch system: register(Command), dispatch(input), listCommands(), with `/` prefix routing
- [x] 2.3 Create `packages/cli/src/core/streaming-client.ts` — Anthropic streaming API wrapper returning AsyncGenerator<StreamChunk> with AbortController support for Ctrl+C cancellation
- [x] 2.4 Create `packages/cli/src/hooks/useStreamingLLM.ts` — React hook wrapping streaming-client for component usage, managing streaming state and message accumulation
- [x] 2.5 Create `packages/cli/src/hooks/useWebSocket.ts` — React hook wrapping `EngineWsClient` from shared package, handling connect/disconnect with component lifecycle
- [x] 2.6 Create `packages/cli/src/hooks/useCommandHistory.ts` — Hook for persistent command history (read/write to filesystem, up/down navigation)

## 3. Markdown and Rendering Components (TypeScript)

- [x] 3.1 Create `packages/cli/src/components/MarkdownText.tsx` — Render markdown string as terminal-formatted text using `marked` + `marked-terminal`, outputting ANSI strings inside Ink `<Text>`
- [x] 3.2 Create `packages/cli/src/components/CodeBlock.tsx` — Render syntax-highlighted code blocks using `cli-highlight`, with language label and line numbers
- [x] 3.3 Create `packages/cli/src/components/Spinner.tsx` — Descriptive spinner wrapping `ink-spinner`, showing current operation label (e.g., "Generating strategy...")
- [x] 3.4 Create `packages/cli/src/components/Collapsible.tsx` — Expandable/collapsible section component with summary line and toggle state

## 4. Streaming Output (TypeScript)

- [x] 4.1 Add `streamStrategy()` method to `packages/cli/src/services/llm-client.ts` using Anthropic streaming API (SSE parsing of content_block_delta events), keeping existing non-streaming methods intact
- [x] 4.2 Create `packages/cli/src/components/Message.tsx` — Single message renderer supporting user/assistant/system roles, with markdown rendering for assistant messages
- [x] 4.3 Create `packages/cli/src/components/StreamingMessage.tsx` — Live streaming message component that re-renders on each chunk, with spinner and partial markdown rendering
- [x] 4.4 Implement Ctrl+C cancellation: abort in-flight streaming request, preserve partial output as completed message with "[cancelled]" indicator, restore input prompt

## 5. Input Experience (TypeScript)

- [x] 5.1 Create `packages/cli/src/components/InputArea.tsx` — Multi-line input component with Shift+Enter for newlines, Enter for submit, Escape to clear, paste support, and visual prompt (`>` with cursor)
- [x] 5.2 Implement command history integration in InputArea: up/down arrow navigation using `useCommandHistory` hook
- [x] 5.3 Implement input state management: disabled during streaming (visual indication), re-enabled on completion or cancellation

## 6. Slash Command System (TypeScript)

- [x] 6.1 Create `packages/cli/src/commands/help.ts` — `/help` command listing all registered commands with descriptions
- [x] 6.2 Create `packages/cli/src/commands/new.ts` — `/new` command resetting conversation and strategy agent state
- [x] 6.3 Create `packages/cli/src/commands/save.ts` — `/save` command persisting current strategy via engine API
- [x] 6.4 Create `packages/cli/src/commands/clear.ts` — `/clear` command clearing terminal screen while preserving state
- [x] 6.5 Create `packages/cli/src/commands/status.ts` — `/status` command displaying engine health and active sessions via `EngineClient.health()`
- [x] 6.6 Create `packages/cli/src/commands/backtest.ts` — `/backtest` command submitting backtest and connecting to progress WebSocket (delegates to backtest visualization components)
- [x] 6.7 Create `packages/cli/src/commands/deploy.ts` — `/deploy` command with type-to-confirm dialog ("CONFIRM LIVE") and 3-second cooldown timer before live deployment
- [x] 6.8 Create `packages/cli/src/commands/kill.ts` — `/kill` command calling `EngineClient.killSwitch()` and displaying results

## 7. Backtest Visualization (TypeScript)

- [x] 7.1 Create `packages/cli/src/components/ProgressBar.tsx` — Real-time progress bar component rendering percentage, trade count, running PnL, and current date from `backtest.progress` events
- [x] 7.2 Create `packages/cli/src/components/EquityCurve.tsx` — ASCII line chart component using `simple-ascii-chart` to render equity_curve data points with auto-scaled axes
- [x] 7.3 Create `packages/cli/src/components/BacktestResult.tsx` — Rich metrics table using `cli-table3` showing total PnL, Sharpe, Sortino, win rate, max drawdown, total trades, profit factor with color-coded values (green positive, red negative)
- [x] 7.4 Implement backtest cancellation: Ctrl+C during active backtest sends `backtest.cancel` event via WebSocket

## 8. Live Trading Display (TypeScript)

- [x] 8.1 Create `packages/cli/src/components/ModeBanner.tsx` — Persistent mode indicator: green single-border "PAPER TRADING (simulated)" vs red double-border "LIVE TRADING (REAL MONEY)"
- [x] 8.2 Create `packages/cli/src/components/TradeNotification.tsx` — Inline timestamped trade notification from `live.trade_executed` events with color-coded PnL
- [x] 8.3 Create `packages/cli/src/components/RiskAlert.tsx` — Priority-level risk alert rendering: yellow border for WARNING, red double-border for CRITICAL, full-width red banner for circuit breaker events
- [x] 8.4 Create `packages/cli/src/components/ConfirmDialog.tsx` — Type-to-confirm dialog with countdown timer for dangerous operations (live deployment)
- [x] 8.5 Implement global Ctrl+K kill switch handler in top-level `useInput`: always active regardless of current state, calls `EngineClient.killSwitch()`, displays results inline

## 9. Status Bar (TypeScript)

- [x] 9.1 Create `packages/cli/src/components/StatusBar.tsx` — Persistent bottom bar showing: model name, token usage, engine health indicator, AI connection status, and context-relevant keybinding hints
- [x] 9.2 Implement token tracking: accumulate input/output token counts from streaming responses and display in status bar (e.g., "Token: 1.2K/4K")
- [x] 9.3 Implement dynamic keybinding hints: show context-appropriate hints based on current state (default, backtest running, live session active)

## 10. App Shell and Integration (TypeScript)

- [x] 10.1 Rewrite `packages/cli/src/app.tsx` — New top-level layout using `<Static>` for completed messages, live area for streaming, StatusBar at bottom, InputArea for input, ModeBanner at top
- [x] 10.2 Wire command registry: register all commands from `commands/` at startup, integrate dispatch into InputArea submit handler
- [x] 10.3 Adapt `packages/cli/src/agents/strategy-agent.ts` — Update to work with streaming output (yield chunks instead of returning complete results), maintain backward compatibility for structured tool outputs
- [x] 10.4 Update `packages/cli/src/index.tsx` — Preserve daemon lifecycle management, update App props to pass new dependencies (command registry, message store)
- [x] 10.5 Remove deprecated components: delete old `Chat.tsx`, `Input.tsx`, `StrategyReview.tsx`, `Confirmation.tsx`, `LiveStatus.tsx` after new components are integrated

## 11. Testing (TypeScript)

- [x] 11.1 Add unit tests for `core/command-registry.ts`: command registration, dispatch, unknown command handling
- [x] 11.2 Add unit tests for `core/streaming-client.ts`: SSE parsing, text_delta accumulation, tool_use fragment assembly, abort handling
- [x] 11.3 Add unit tests for `core/message-store.ts`: message add, streaming state transitions, message completion
- [x] 11.4 Add component tests for `MarkdownText.tsx`: verify markdown→terminal rendering for headings, code blocks, lists, bold
- [x] 11.5 Add component tests for `BacktestResult.tsx`: verify metrics table rendering with positive/negative color coding
- [x] 11.6 Add integration test: full command flow — user input → command dispatch → engine API call → result rendering (using mocked engine responses)
