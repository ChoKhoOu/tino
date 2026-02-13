import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from 'ink';
import { existsSync } from 'fs';
import { join } from 'path';
import { DaemonManager } from './daemon/index.js';
import { resolveAppDir } from './utils/resolve-app-dir.js';

import { ModelSelectionFlow } from './components/ModelSelectionFlow.js';
import { AppLayout } from './components/AppLayout.js';
import type { HistoryItem } from './components/index.js';
import type { DoneEvent } from './domain/events.js';

import { useSessionRunner } from './hooks/useSessionRunner.js';
import { useModelSelector } from './hooks/useModelSelector.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { useDaemonStatus } from './hooks/useDaemonStatus.js';
import { useModelSelectionFlow } from './hooks/useModelSelectionFlow.js';
import { useRuntimeInit } from './hooks/useRuntimeInit.js';
import { useCommandHandler } from './hooks/useCommandHandler.js';
import { useSessionCommands } from './hooks/useSessionCommands.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { buildDisplayEvents, findActiveToolId, deriveWorkingState } from './hooks/useDisplayEvents.js';
import { createBashHistory } from './hooks/useBashHistory.js';
import { KeyboardDispatcher } from './keyboard/dispatcher.js';
import { KeyboardProvider } from './keyboard/use-keyboard.js';

export function CLI() {
  const { exit } = useApp();
  const dispatcher = useMemo(() => new KeyboardDispatcher(), []);
  const bashHistory = useMemo(() => createBashHistory(), []);
  const { runtime, broker, sessionStore, connectedMcpServers } = useRuntimeInit();

  useEffect(() => { bashHistory.load(); }, [bashHistory]);
  const { state: runState, startRun, cancel, respondToPermission } = useSessionRunner(runtime);
  const { state: modelState, selectModel } = useModelSelector(broker);

  const {
    flowState, startFlow, cancelFlow,
    handleProviderSelect, handleModelSelect, handleModelInputSubmit,
    handleApiKeyConfirm, handleApiKeySubmit, isInFlow,
  } = useModelSelectionFlow(selectModel);

  const {
    historyValue, navigateUp, navigateDown,
    saveMessage, updateAgentResponse, resetNavigation,
  } = useInputHistory();

  const daemonRef = useRef<DaemonManager | null>(null);
  useEffect(() => {
    const cliDir = resolveAppDir();
    const daemonPkgDir = join(cliDir, 'python');
    if (!existsSync(join(daemonPkgDir, 'pyproject.toml'))) return;
    const manager = new DaemonManager({ projectDir: process.cwd(), daemonPkgDir });
    daemonRef.current = manager;
    manager.start();
    return () => { manager.stop(); };
  }, []);
  const daemonStatus = useDaemonStatus(daemonRef);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isProcessing = runState.status === 'running' || runState.status === 'permission_pending';

  const executeRun = useCallback(async (query: string) => {
    setError(null);
    setHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), query, events: [], answer: '', status: 'processing' as const, startTime: Date.now() },
    ]);
    await startRun(query);
  }, [startRun]);

  const extendedSlashDeps = useSessionCommands({
    runtime,
    runState,
    history,
    setHistory,
    resetNavigation,
    sessionStore,
    connectedMcpServers,
    provider: modelState.currentProvider,
    model: modelState.currentModel,
  });

  const { handleSubmit } = useCommandHandler({
    exit, startFlow, isInFlow, isProcessing, runtime,
    saveMessage, resetNavigation, executeRun, setHistory, setError,
    extendedSlashDeps, bashHistory,
  });

  useEffect(() => {
    if (runState.status === 'idle' && runState.events.length === 0) return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      const displayEvents = buildDisplayEvents(runState.events);
      const activeToolId = findActiveToolId(runState.events);
      const isDone = runState.status === 'done';
      const updated: HistoryItem = {
        ...last, events: displayEvents, activeToolId,
        answer: runState.answer, status: isDone ? 'complete' : last.status,
      };
      if (isDone) {
        const doneEvt = runState.events.find((e) => e.type === 'done') as DoneEvent | undefined;
        if (doneEvt) { updated.duration = doneEvt.totalTime; updated.tokenUsage = doneEvt.tokenUsage; }
      }
      if (runState.error) { updated.status = 'error'; setError(runState.error); }
      return [...prev.slice(0, -1), updated];
    });
  }, [runState]);

  useEffect(() => {
    if (runState.status === 'done' && runState.answer) updateAgentResponse(runState.answer);
  }, [runState.status, runState.answer, updateAgentResponse]);

  const cancelExecution = useCallback(() => {
    cancel();
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      return [...prev.slice(0, -1), { ...last, status: 'interrupted' as const }];
    });
  }, [cancel]);

  const handleHistoryNavigate = useCallback(
    (direction: 'up' | 'down') => { direction === 'up' ? navigateUp() : navigateDown(); },
    [navigateUp, navigateDown],
  );

  const clearScreen = useCallback(() => {
    setHistory([]);
    setError(null);
  }, []);

  const exitApp = useCallback(() => {
    console.log('\nGoodbye!');
    exit();
  }, [exit]);

  useKeyboardShortcuts(dispatcher, {
    onClearScreen: clearScreen,
    onExit: exitApp,
  });

  useEffect(() => {
    const unregisterEscape = dispatcher.register('global', 'escape', () => {
      if (isInFlow()) {
        cancelFlow();
        return true;
      }
      if (isProcessing) {
        cancelExecution();
        return true;
      }
      return false;
    });

    const unregisterCtrlC = dispatcher.register('global', 'ctrl+c', () => {
      if (isInFlow()) {
        cancelFlow();
        return true;
      }
      if (isProcessing) {
        cancelExecution();
        return true;
      }
      exitApp();
      return true;
    });

    const unregisterDoubleEscape = dispatcher.register('global', 'escape+escape', () => true);

    return () => {
      unregisterEscape();
      unregisterCtrlC();
      unregisterDoubleEscape();
    };
  }, [cancelExecution, cancelFlow, dispatcher, exitApp, isInFlow, isProcessing]);

  if (flowState.appState !== 'idle') {
    return (
      <KeyboardProvider dispatcher={dispatcher}>
        <ModelSelectionFlow
          flowState={flowState} modelState={modelState}
          onProviderSelect={handleProviderSelect} onModelSelect={handleModelSelect}
          onModelInputSubmit={handleModelInputSubmit}
          onApiKeyConfirm={handleApiKeyConfirm} onApiKeySubmit={handleApiKeySubmit}
        />
      </KeyboardProvider>
    );
  }

  const workingState = deriveWorkingState(runState);

  return (
    <AppLayout
      dispatcher={dispatcher}
      history={history}
      modelState={modelState}
      runState={runState}
      workingState={workingState}
      error={error}
      isProcessing={isProcessing}
      handleSubmit={handleSubmit}
      historyValue={historyValue}
      handleHistoryNavigate={handleHistoryNavigate}
      respondToPermission={respondToPermission}
      daemonStatus={daemonStatus}
      bashHistory={bashHistory}
    />
  );
}
