import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { existsSync } from 'fs';
import { join } from 'path';
import { DaemonManager } from './daemon/index.js';
import { resolveAppDir } from './utils/resolve-app-dir.js';

import { Input } from './components/Input.js';
import { Intro } from './components/Intro.js';
import { DaemonStatusBar } from './components/DaemonStatusBar.js';
import { DebugPanel } from './components/DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './components/index.js';
import { ModelSelectionFlow } from './components/ModelSelectionFlow.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';
import type { HistoryItem } from './components/index.js';
import type { DoneEvent } from './domain/events.js';

import { useSessionRunner } from './hooks/useSessionRunner.js';
import { useModelSelector } from './hooks/useModelSelector.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { useDaemonStatus } from './hooks/useDaemonStatus.js';
import { useModelSelectionFlow } from './hooks/useModelSelectionFlow.js';
import { useRuntimeInit } from './hooks/useRuntimeInit.js';
import { useCommandHandler } from './hooks/useCommandHandler.js';
import { buildDisplayEvents, findActiveToolId, deriveWorkingState } from './hooks/useDisplayEvents.js';

export function CLI() {
  const { exit } = useApp();
  const { runtime, broker } = useRuntimeInit();
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

  const { handleSubmit } = useCommandHandler({
    exit, startFlow, isInFlow, isProcessing, runtime,
    saveMessage, resetNavigation, executeRun, setHistory, setError,
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

  if (flowState.appState !== 'idle') {
    return (
      <ModelSelectionFlow
        flowState={flowState} modelState={modelState}
        onProviderSelect={handleProviderSelect} onModelSelect={handleModelSelect}
        onModelInputSubmit={handleModelInputSubmit}
        onApiKeyConfirm={handleApiKeyConfirm} onApiKeySubmit={handleApiKeySubmit}
      />
    );
  }

  const workingState = deriveWorkingState(runState);
  return (
    <Box flexDirection="column">
      <Intro provider={modelState.currentProvider} model={modelState.currentModel} />
      {history.map((item) => (<HistoryItemView key={item.id} item={item} />))}
      {error && (<Box marginBottom={1}><Text color="red">Error: {error}</Text></Box>)}
      {isProcessing && runState.status !== 'permission_pending' && <WorkingIndicator state={workingState} />}
      {runState.status === 'permission_pending' && runState.pendingPermission && (
        <PermissionPrompt
          request={{ type: 'permission_request', ...runState.pendingPermission, rule: { tool: runState.pendingPermission.toolId, action: 'ask' } }}
          onResponse={(allowed, alwaysAllow) => respondToPermission(runState.pendingPermission!.toolId, allowed, alwaysAllow)}
        />
      )}
      <Box marginTop={1}>
        <Input onSubmit={handleSubmit} historyValue={historyValue} onHistoryNavigate={handleHistoryNavigate} />
      </Box>
      <DaemonStatusBar status={daemonStatus.status} info={daemonStatus.info} />
      <DebugPanel maxLines={8} show={true} />
    </Box>
  );
}
