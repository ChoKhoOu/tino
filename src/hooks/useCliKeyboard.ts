import { useCallback, useEffect } from 'react';

import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js';

interface UseCliKeyboardOptions {
  dispatcher: KeyboardDispatcher;
  isInFlow: () => boolean;
  cancelFlow: () => void;
  isProcessing: boolean;
  cancelExecution: () => void;
  onClearScreen: () => void;
  exit: () => void;
}

export function useCliKeyboard(options: UseCliKeyboardOptions): void {
  const {
    dispatcher,
    isInFlow,
    cancelFlow,
    isProcessing,
    cancelExecution,
    onClearScreen,
    exit,
  } = options;

  const exitApp = useCallback(() => {
    console.log('\nGoodbye!');
    exit();
  }, [exit]);

  useKeyboardShortcuts(dispatcher, {
    onClearScreen,
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
}
