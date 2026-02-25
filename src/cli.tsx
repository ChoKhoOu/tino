import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from 'ink';
import { existsSync } from 'fs';
import { join } from 'path';
import { DaemonManager } from './daemon/index.js';
import { resolveAppDir } from './utils/resolve-app-dir.js';
import { AppLayout } from './components/AppLayout.js';
import { InitWizard } from './components/InitWizard.js';
import type { HistoryItem } from './components/index.js';

import { useSessionRunner } from './hooks/useSessionRunner.js';
import { useModelSelector } from './hooks/useModelSelector.js';
import { useInputHistory } from './hooks/useInputHistory.js';
import { useDaemonStatus } from './hooks/useDaemonStatus.js';
import { useStatusLineData } from './hooks/useStatusLineData.js';
import { useHistorySync } from './hooks/useHistorySync.js';
import { useRuntimeInit } from './hooks/useRuntimeInit.js';
import { useCommandHandler } from './hooks/useCommandHandler.js';
import { useSessionCommands } from './hooks/useSessionCommands.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useVerboseMode } from './hooks/useVerboseMode.js';
import { usePermissionModeToggle } from './hooks/usePermissionModeToggle.js';
import { deriveWorkingState } from './hooks/useDisplayEvents.js';
import { createBashHistory } from './hooks/useBashHistory.js';
import { KeyboardDispatcher } from './keyboard/dispatcher.js';
import { KeyboardProvider } from './keyboard/use-keyboard.js';

import { getSetting, setSetting } from './config/settings.js';

export function CLI() {
  const { exit } = useApp();
  const dispatcher = useMemo(() => new KeyboardDispatcher(), []);
  const bashHistory = useMemo(() => createBashHistory(), []);
  const { isVerbose, toggleVerbose } = useVerboseMode(dispatcher);
  const { permissionMode } = usePermissionModeToggle(dispatcher);
  const { runtime, broker, sessionStore, connectedMcpServers } = useRuntimeInit();

  useEffect(() => { bashHistory.load(); }, [bashHistory]);
  const { state: runState, startRun, cancel, respondToPermission } = useSessionRunner(runtime);
  const { state: modelState, selectModel } = useModelSelector(broker);

  const {
    historyValue, navigateUp, navigateDown,
    saveMessage, updateAgentResponse, resetNavigation,
  } = useInputHistory();

  const stylePickerRef = useRef<(() => void) | null>(null);
  const modelPopupRef = useRef<(() => void) | null>(null);

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
  const [showInitWizard, setShowInitWizard] = useState(() => !getSetting('onboardingCompleted', false));
  const isProcessing = runState.status === 'running' || runState.status === 'permission_pending';

  const statusLineData = useStatusLineData(modelState, runState, daemonStatus, history, permissionMode);

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

  const handleWizardComplete = useCallback((summary: string) => {
    setSetting('onboardingCompleted', true);
    setShowInitWizard(false);
    setHistory((prev) => [
      ...prev,
      { id: Date.now().toString(), query: '/init', events: [], answer: summary, status: 'complete' as const, startTime: Date.now() },
    ]);
  }, []);

  const { handleSubmit } = useCommandHandler({
    exit, openModelPopup: () => modelPopupRef.current?.(), openStylePicker: () => stylePickerRef.current?.(), isProcessing, runtime,
    selectModel,
    saveMessage, resetNavigation, executeRun, setHistory, setError,
    extendedSlashDeps, bashHistory, toggleVerbose,
    openInitWizard: () => setShowInitWizard(true),
  });

  useHistorySync(runState, setHistory, setError, updateAgentResponse);

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
      if (isProcessing) {
        cancelExecution();
        return true;
      }
      return false;
    });

    const unregisterCtrlC = dispatcher.register('global', 'ctrl+c', () => {
      if (isProcessing) {
        cancelExecution();
        return true;
      }
      exitApp();
      return true;
    });

    const unregisterDoubleEscape = dispatcher.register('global', 'escape+escape', () => false);

    return () => {
      unregisterEscape();
      unregisterCtrlC();
      unregisterDoubleEscape();
    };
  }, [cancelExecution, dispatcher, exitApp, isProcessing]);

  const workingState = useMemo(() => deriveWorkingState(runState), [runState]);

  if (showInitWizard) {
    return <InitWizard projectDir={process.cwd()} onComplete={handleWizardComplete} />;
  }

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
      bashHistory={bashHistory}
      statusLineData={statusLineData}
      selectModel={selectModel}
      isVerbose={isVerbose}
      onBackgroundCurrentOperation={cancelExecution}
      stylePickerRef={stylePickerRef}
      modelPopupRef={modelPopupRef}
    />
  );
}
