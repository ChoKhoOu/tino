import { useCallback, useRef, useState, useEffect } from 'react';
import { Box, Text, Static } from 'ink';
import { Input } from './Input.js';
import { Intro } from './Intro.js';
import { DebugPanel } from './DebugPanel.js';
import { HistoryItemView, WorkingIndicator } from './index.js';
import { PermissionPrompt } from './PermissionPrompt.js';
import { ScrollableContent } from './ScrollableContent.js';
import { ModelSwitchPopup } from './ModelSwitchPopup.js';
import { StylePicker } from './StylePicker.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useModelSwitchPopup } from '../hooks/useModelSwitchPopup.js';
import { useStylePicker } from '../hooks/useStylePicker.js';
import { KeyboardProvider } from '../keyboard/use-keyboard.js';
import type { KeyboardDispatcher } from '../keyboard/dispatcher.js';
import type { HistoryItem } from './index.js';
import type { ModelSelectorState } from '../hooks/useModelSelector.js';
import type { RunState } from '../hooks/useSessionRunner.js';
import type { WorkingState } from './WorkingIndicator.js';
import type { BashHistory } from '../hooks/useBashHistory.js';

import { StatusLine } from './StatusLine.js';
import type { StatusLineProps } from './StatusLine.js';
import { TaskList } from './TaskList.js';
import { useBackgroundTasks } from '../hooks/useBackgroundTasks.js';
import { useBackgroundTaskControl } from '../hooks/useBackgroundTaskControl.js';
import { useTaskListVisibility } from '../hooks/useTaskListVisibility.js';
import { RewindMenu } from './RewindMenu.js';
import { useRewindMenu } from '../hooks/useRewindMenu.js';

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
  bashHistory?: BashHistory | null;
  statusLineData: StatusLineProps;
  selectModel: (name: string) => void;
  isVerbose?: boolean;
  onBackgroundCurrentOperation: () => void;
  stylePickerRef?: React.MutableRefObject<(() => void) | null>;
  modelPopupRef?: React.MutableRefObject<(() => void) | null>;
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <KeyboardProvider dispatcher={props.dispatcher}>
      <AppLayoutContent {...props} />
    </KeyboardProvider>
  );
}

function AppLayoutContent({
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
  bashHistory,
  statusLineData,
  selectModel,
  isVerbose = false,
  onBackgroundCurrentOperation,
  stylePickerRef,
  modelPopupRef,
}: AppLayoutProps) {
  const { rows } = useTerminalSize();
  const modelPopup = useModelSwitchPopup(modelState.currentModel, selectModel);
  const stylePicker = useStylePicker();
  const { tasks } = useBackgroundTasks();
  const { isVisible: isTaskListVisible } = useTaskListVisibility(dispatcher);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);
  const introHeight = history.length === 0 ? 11 : 0;
  const inputHeight = 3;
  const statusLineHeight = 1;
  const contentHeight = Math.max(0, rows - introHeight - inputHeight - statusLineHeight);
  const currentQuery = history[history.length - 1]?.status === 'processing'
    ? history[history.length - 1].query
    : null;

  const backgroundControlRef = useRef({ runState, currentQuery, cancelForegroundRun: onBackgroundCurrentOperation, setNotice: setTaskNotice });
  backgroundControlRef.current = { runState, currentQuery, cancelForegroundRun: onBackgroundCurrentOperation, setNotice: setTaskNotice };

  useBackgroundTaskControl(dispatcher, backgroundControlRef);

  useEffect(() => {
    if (stylePickerRef) {
      stylePickerRef.current = stylePicker.open;
    }
  }, [stylePicker.open, stylePickerRef]);

  useEffect(() => {
    if (modelPopupRef) {
      modelPopupRef.current = modelPopup.open;
    }
  }, [modelPopup.open, modelPopupRef]);

  const handleRewindAction = useCallback((turn: HistoryItem, action: string) => {
    setTaskNotice(`Rewind: ${action} for turn ${turn.id} (UI only)`);
  }, []);

  const rewindMenu = useRewindMenu(history, handleRewindAction);

  return (
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

      {isTaskListVisible && <TaskList tasks={tasks} />}
      {taskNotice && (
        <Box marginBottom={1}>
          <Text color="yellow">{taskNotice}</Text>
        </Box>
      )}
      <RewindMenu
        isOpen={rewindMenu.isOpen}
        selectedIndex={rewindMenu.selectedIndex}
        turns={rewindMenu.turns}
        subMenuOpen={rewindMenu.subMenuOpen}
        subMenuIndex={rewindMenu.subMenuIndex}
      />
      
      <ModelSwitchPopup isOpen={modelPopup.isOpen} selectedIndex={modelPopup.selectedIndex} models={modelPopup.models} />
      <StylePicker isOpen={stylePicker.isOpen} selectedIndex={stylePicker.selectedIndex} styles={stylePicker.styles} />
      <Input onSubmit={handleSubmit} historyValue={historyValue} onHistoryNavigate={handleHistoryNavigate} bashHistory={bashHistory} onSlashSelect={handleSubmit} />
      
      <StatusLine {...statusLineData} />
      
      <DebugPanel maxLines={8} show={isVerbose} />
    </Box>
  );
}
