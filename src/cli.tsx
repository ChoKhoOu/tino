#!/usr/bin/env bun
/**
 * CLI - Main assembly file wiring v2 runtime modules.
 * Composes SessionRuntime, ModelBroker, ToolRegistry, PermissionEngine, HookRunner.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { DaemonManager } from './daemon/index.js';

import { Input } from './components/Input.js';
import { Intro } from './components/Intro.js';
import { ProviderSelector, ModelSelector, ModelInputField } from './components/ModelSelector.js';
import { ApiKeyConfirm, ApiKeyInput } from './components/ApiKeyPrompt.js';
import { DebugPanel } from './components/DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './components/index.js';
import type { HistoryItem } from './components/index.js';
import type { WorkingState } from './components/index.js';
import type { DisplayEvent } from './components/index.js';
import { getApiKeyNameForProvider, getProviderDisplayName } from './utils/env.js';

import { useSessionRunner } from './hooks/useSessionRunner.js';
import { useModelSelector } from './hooks/useModelSelector.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { parseSlashCommand } from './commands/slash.js';
import type { DoneEvent, RunEvent } from './domain/events.js';

import { ModelBroker } from './runtime/model-broker.js';
import { ToolRegistry } from './runtime/tool-registry.js';
import { PermissionEngine } from './runtime/permission-engine.js';
import { HookRunner } from './runtime/hook-runner.js';
import { SessionRuntime } from './runtime/session-runtime.js';
import { buildSystemPrompt } from './runtime/prompt-builder.js';
import { loadPermissions } from './config/permissions.js';
import { loadHooks } from './config/hooks.js';
import { discoverPlugins } from './plugins/discover.js';

import { useModelSelectionFlow } from './hooks/useModelSelectionFlow.js';

export function CLI() {
  const { exit } = useApp();

  // ── V2 runtime modules (created once) ──────────────────────────────
  const broker = useMemo(() => new ModelBroker(), []);
  const registry = useMemo(() => new ToolRegistry(), []);
  const permissions = useMemo(() => new PermissionEngine(loadPermissions()), []);
  const hooks = useMemo(() => new HookRunner(loadHooks()), []);

  // ── Tool discovery & system prompt (runs once on mount) ────────────
  const [runtimeReady, setRuntimeReady] = useState(false);
  const systemPromptRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const builtins = await registry.discoverTools(join(import.meta.dirname ?? '.', 'tools'));
      registry.registerAll(builtins);

      const plugins = await discoverPlugins();
      registry.registerAll(plugins);

      registry.validate();

      const toolDescriptions = registry
        .getAll()
        .map((t) => `### ${t.id}\n\n${t.description}`)
        .join('\n\n');
      systemPromptRef.current = buildSystemPrompt(toolDescriptions);

      if (!cancelled) setRuntimeReady(true);
    })();
    return () => { cancelled = true; };
  }, [registry]);

  // ── SessionRuntime (rebuilt when systemPrompt is ready) ────────────
  const runtime = useMemo(() => {
    if (!runtimeReady) return null;
    return new SessionRuntime({
      broker,
      registry,
      permissions,
      hooks,
      systemPrompt: systemPromptRef.current,
    });
  }, [runtimeReady, broker, registry, permissions, hooks]);

  // SessionRunner needs a runtime; provide a stub until ready
  const stubRuntime = useMemo(
    () =>
      new SessionRuntime({
        broker,
        registry,
        permissions,
        hooks,
        systemPrompt: '',
      }),
    [broker, registry, permissions, hooks],
  );
  const { state: runState, startRun, cancel } = useSessionRunner(runtime ?? stubRuntime);
  const { state: modelState, selectModel } = useModelSelector(broker);

  // ── Model selection multi-step flow (provider → model → API key) ──
  const {
    flowState,
    startFlow,
    cancelFlow,
    handleProviderSelect,
    handleModelSelect,
    handleModelInputSubmit,
    handleApiKeyConfirm,
    handleApiKeySubmit,
    isInFlow,
  } = useModelSelectionFlow(selectModel);

  // ── Input history (up/down navigation) ─────────────────────────────
  const {
    historyValue,
    navigateUp,
    navigateDown,
    saveMessage,
    updateAgentResponse,
    resetNavigation,
  } = useInputHistory();

  // ── Daemon auto-start ──────────────────────────────────────────────
  const daemonRef = useRef<DaemonManager | null>(null);
  useEffect(() => {
    const settingsPath = join(process.cwd(), '.tino', 'settings.json');
    if (!existsSync(settingsPath)) return;
    const cliDir = dirname(resolve(import.meta.dirname ?? '.'));
    const daemonPkgDir = join(cliDir, 'python');
    if (!existsSync(join(daemonPkgDir, 'pyproject.toml'))) return;
    const manager = new DaemonManager({ projectDir: process.cwd(), daemonPkgDir });
    daemonRef.current = manager;
    manager.start();
    return () => { manager.stop(); };
  }, []);

  // ── UI history items (bridge RunState events → HistoryItem[]) ──────
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runState.status === 'idle' && runState.events.length === 0) return;

    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;

      const displayEvents = buildDisplayEvents(runState.events);
      const activeToolId = findActiveToolId(runState.events);
      const answer = runState.answer;
      const isDone = runState.status === 'done';

      const updated: HistoryItem = {
        ...last,
        events: displayEvents,
        activeToolId,
        answer,
        status: isDone ? 'complete' : last.status,
      };

      if (isDone) {
        const doneEvt = runState.events.find((e) => e.type === 'done') as DoneEvent | undefined;
        if (doneEvt) {
          updated.duration = doneEvt.totalTime;
          updated.tokenUsage = doneEvt.tokenUsage;
        }
      }

      if (runState.error) {
        updated.status = 'error';
        setError(runState.error);
      }

      return [...prev.slice(0, -1), updated];
    });
  }, [runState]);

  const workingState = deriveWorkingState(runState);
  const isProcessing = runState.status === 'running' || runState.status === 'permission_pending';

  // ── Handlers ───────────────────────────────────────────────────────
  const handleHistoryNavigate = useCallback(
    (direction: 'up' | 'down') => {
      direction === 'up' ? navigateUp() : navigateDown();
    },
    [navigateUp, navigateDown],
  );

  const addDirectResponse = useCallback((query: string, answer: string) => {
    setHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), query, events: [], answer, status: 'complete' as const, startTime: Date.now() },
    ]);
  }, []);

  const executeRun = useCallback(
    async (query: string) => {
      setError(null);

      setHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          query,
          events: [],
          answer: '',
          status: 'processing' as const,
          startTime: Date.now(),
        },
      ]);

      await startRun(query);
    },
    [startRun],
  );

  const handleSubmit = useCallback(
    async (query: string) => {
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        exit();
        return;
      }

      const slashResult = parseSlashCommand(query);
      if (slashResult !== null) {
        if (slashResult.action === 'model') { startFlow(); return; }
        if (slashResult.action === 'exit') { console.log('Goodbye!'); exit(); return; }
        if (!slashResult.handled) {
          setError(`Unknown command: ${query.trim().split(/\s+/)[0]}. Type /help for available commands.`);
          return;
        }
        if (slashResult.output) {
          addDirectResponse(query, slashResult.output);
          return;
        }
        return;
      }

      if (isInFlow() || isProcessing) return;

      await saveMessage(query);
      resetNavigation();
      await executeRun(query);
    },
    [exit, startFlow, isInFlow, isProcessing, saveMessage, resetNavigation, executeRun, addDirectResponse],
  );

  useEffect(() => {
    if (runState.status === 'done' && runState.answer) {
      updateAgentResponse(runState.answer);
    }
  }, [runState.status, runState.answer, updateAgentResponse]);

  const cancelExecution = useCallback(() => {
    cancel();
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      return [...prev.slice(0, -1), { ...last, status: 'interrupted' as const }];
    });
  }, [cancel]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useInput((input, key) => {
    if (key.escape) {
      if (isInFlow()) { cancelFlow(); return; }
      if (isProcessing) { cancelExecution(); return; }
    }
    if (key.ctrl && input === 'c') {
      if (isInFlow()) { cancelFlow(); }
      else if (isProcessing) { cancelExecution(); }
      else { console.log('\nGoodbye!'); exit(); }
    }
  });

  // ── Render: selection flow screens ─────────────────────────────────
  const { appState, pendingProvider, pendingModels } = flowState;

  if (appState === 'provider_select') {
    return (
      <Box flexDirection="column">
        <ProviderSelector provider={modelState.currentProvider} onSelect={handleProviderSelect} />
      </Box>
    );
  }

  if (appState === 'model_select' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelSelector
          providerId={pendingProvider}
          models={pendingModels}
          currentModel={modelState.currentProvider === pendingProvider ? modelState.currentModel : undefined}
          onSelect={handleModelSelect}
        />
      </Box>
    );
  }

  if (appState === 'model_input' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ModelInputField
          providerId={pendingProvider}
          currentModel={modelState.currentProvider === pendingProvider ? modelState.currentModel : undefined}
          onSubmit={handleModelInputSubmit}
        />
      </Box>
    );
  }

  if (appState === 'api_key_confirm' && pendingProvider) {
    return (
      <Box flexDirection="column">
        <ApiKeyConfirm
          providerName={getProviderDisplayName(pendingProvider)}
          onConfirm={handleApiKeyConfirm}
        />
      </Box>
    );
  }

  if (appState === 'api_key_input' && pendingProvider) {
    const apiKeyName = getApiKeyNameForProvider(pendingProvider) || '';
    return (
      <Box flexDirection="column">
        <ApiKeyInput
          providerName={getProviderDisplayName(pendingProvider)}
          apiKeyName={apiKeyName}
          onSubmit={handleApiKeySubmit}
        />
      </Box>
    );
  }

  // ── Render: main chat interface ────────────────────────────────────
  return (
    <Box flexDirection="column">
      <Intro provider={modelState.currentProvider} model={modelState.currentModel} />

      {history.map((item) => (
        <HistoryItemView key={item.id} item={item} />
      ))}

      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {isProcessing && <WorkingIndicator state={workingState} />}

      <Box marginTop={1}>
        <Input onSubmit={handleSubmit} historyValue={historyValue} onHistoryNavigate={handleHistoryNavigate} />
      </Box>

      <DebugPanel maxLines={8} show={true} />
    </Box>
  );
}

// ── Pure helpers (event bridging) ──────────────────────────────────────

function buildDisplayEvents(events: RunEvent[]): DisplayEvent[] {
  const display: DisplayEvent[] = [];
  const activeTools = new Map<string, number>();

  for (const event of events) {
    switch (event.type) {
      case 'thinking':
        display.push({ id: `thinking-${display.length}`, event, completed: true });
        break;
      case 'tool_start': {
        const id = `tool-${event.toolId}-${display.length}`;
        display.push({ id, event, completed: false });
        activeTools.set(event.toolId, display.length - 1);
        break;
      }
      case 'tool_end': {
        const idx = activeTools.get(event.toolId);
        if (idx !== undefined) {
          display[idx] = { ...display[idx], completed: true, endEvent: event };
          activeTools.delete(event.toolId);
        }
        break;
      }
      case 'tool_error': {
        const idx = activeTools.get(event.toolId);
        if (idx !== undefined) {
          display[idx] = { ...display[idx], completed: true, endEvent: event };
          activeTools.delete(event.toolId);
        } else {
          display.push({ id: `error-${display.length}`, event, completed: true });
        }
        break;
      }
      case 'context_cleared':
        display.push({ id: `ctx-${display.length}`, event, completed: true });
        break;
      default:
        break;
    }
  }

  return display;
}

function findActiveToolId(events: RunEvent[]): string | undefined {
  const started = new Set<string>();
  const finished = new Set<string>();

  for (const e of events) {
    if (e.type === 'tool_start') started.add(e.toolId);
    if (e.type === 'tool_end' || e.type === 'tool_error') finished.add(e.toolId);
  }

  for (const id of started) {
    if (!finished.has(id)) return `tool-${id}-0`;
  }
  return undefined;
}

function deriveWorkingState(runState: { status: string; events: RunEvent[] }): WorkingState {
  if (runState.status === 'idle' || runState.status === 'done') return { status: 'idle' };

  const lastEvent = runState.events[runState.events.length - 1];
  if (!lastEvent) return { status: 'thinking' };

  if (lastEvent.type === 'tool_start') return { status: 'tool', toolName: lastEvent.toolId };
  if (lastEvent.type === 'answer_start') return { status: 'answering', startTime: Date.now() };
  return { status: 'thinking' };
}
