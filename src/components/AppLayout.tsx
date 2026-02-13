import React from 'react';
import { Box, Text, Static } from 'ink';
import { Input } from './Input.js';
import { Intro } from './Intro.js';
import { DebugPanel } from './DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './index.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { ScrollableContent } from './ScrollableContent.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { KeyboardProvider } from '../keyboard/use-keyboard.js';
import type { KeyboardDispatcher } from '../keyboard/dispatcher.js';
import type { HistoryItem } from './index.js';
import type { ModelSelectorState } from '../hooks/useModelSelector.js';
import type { RunState } from '../hooks/useSessionRunner.js';
import type { WorkingState } from './WorkingIndicator.js';
import type { DaemonStatus, DaemonInfo } from '../hooks/useDaemonStatus.js';
import type { BashHistory } from '../hooks/useBashHistory.js';

interface AppLayoutProps {
  dispatcher: KeyboardDispatcher;
  history: HistoryItem[];
  modelState: ModelSelectorState;
  runState: RunState;
  workingState: WorkingState;
  error: string | null;
  isProcessing: boolean;
  handleSubmit: (value: string) => void;
  historyValue: string | null;
  handleHistoryNavigate: (direction: 'up' | 'down') => void;
  respondToPermission: (toolId: string, allowed: boolean, alwaysAllow?: boolean) => void;
  daemonStatus: { status: DaemonStatus; info?: DaemonInfo };
  bashHistory?: BashHistory | null;
}

export function AppLayout({
  dispatcher,
  history,
  modelState,
  runState,
  workingState,
  error,
  isProcessing,
  handleSubmit,
  historyValue,
  handleHistoryNavigate,
  respondToPermission,
  daemonStatus,
  bashHistory,
}: AppLayoutProps) {
  const { rows } = useTerminalSize();
  const introHeight = history.length === 0 ? 3 : 0;
  const inputHeight = 3;
  const statusLineHeight = 1;
  const contentHeight = Math.max(0, rows - introHeight - inputHeight - statusLineHeight);

  return (
    <KeyboardProvider dispatcher={dispatcher}>
      <Box flexDirection="column" height={rows}>
        {history.length === 0 && <Intro provider={modelState.currentProvider} model={modelState.currentModel} />}
        
        <Static items={history.filter(h => h.status === 'complete' || h.status === 'error' || h.status === 'interrupted')}>
          {(item) => <HistoryItemView key={item.id} item={item} />}
        </Static>

        <ScrollableContent height={contentHeight}>
          {history.filter(h => h.status === 'processing').map((item) => (<HistoryItemView key={item.id} item={item} />))}
          {error && (<Box marginBottom={1}><Text color="red">Error: {error}</Text></Box>)}
          {isProcessing && runState.status !== 'permission_pending' && <WorkingIndicator state={workingState} />}
          {runState.status === 'permission_pending' && runState.pendingPermission && (
            <PermissionPrompt
              request={{ type: 'permission_request', ...runState.pendingPermission, rule: { tool: runState.pendingPermission.toolId, action: 'ask' } }}
              onResponse={(allowed, alwaysAllow) => respondToPermission(runState.pendingPermission!.toolId, allowed, alwaysAllow)}
            />
          )}
        </ScrollableContent>
        
        <Input onSubmit={handleSubmit} historyValue={historyValue} onHistoryNavigate={handleHistoryNavigate} bashHistory={bashHistory} />
        
        <Box paddingX={1}>
          <Text color="#555555">─</Text>
        </Box>
        
        <DebugPanel maxLines={8} show={false} />
      </Box>
    </KeyboardProvider>
  );
}
