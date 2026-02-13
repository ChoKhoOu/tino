import React, { createContext, useContext, useEffect } from 'react';
import { useInput } from 'ink';

import type { KeyboardDispatcher } from './dispatcher.js';
import type { KeyEvent, KeyHandler, KeyMode } from './types.js';

const KeyboardDispatcherContext = createContext<KeyboardDispatcher | null>(null);

interface KeyboardProviderProps {
  dispatcher: KeyboardDispatcher;
  children: React.ReactNode;
}

export function KeyboardProvider({ dispatcher, children }: KeyboardProviderProps) {
  useKeyboard(dispatcher);

  useEffect(() => () => dispatcher.dispose(), [dispatcher]);

  return React.createElement(KeyboardDispatcherContext.Provider, { value: dispatcher }, children);
}

export function useKeyboard(dispatcher: KeyboardDispatcher): void {
  useInput((input, key) => {
    const event: KeyEvent = {
      input,
      key: {
        ctrl: Boolean(key.ctrl),
        meta: Boolean(key.meta),
        shift: Boolean(key.shift),
        escape: Boolean(key.escape),
        return: Boolean(key.return),
        tab: Boolean(key.tab),
        backspace: Boolean(key.backspace),
        delete: Boolean(key.delete),
        upArrow: Boolean(key.upArrow),
        downArrow: Boolean(key.downArrow),
        leftArrow: Boolean(key.leftArrow),
        rightArrow: Boolean(key.rightArrow),
      },
    };

    dispatcher.dispatch(event);
  });
}

export function useKeyboardDispatcher(): KeyboardDispatcher {
  const dispatcher = useContext(KeyboardDispatcherContext);
  if (!dispatcher) {
    throw new Error('useKeyboardDispatcher must be used within KeyboardProvider');
  }
  return dispatcher;
}

export function useKeyboardMode(mode: KeyMode): void {
  const dispatcher = useKeyboardDispatcher();
  useEffect(() => {
    dispatcher.pushMode(mode);
    return () => {
      dispatcher.popMode();
    };
  }, [dispatcher, mode]);
}

export function useKeyboardBinding(mode: KeyMode | 'global', pattern: string, handler: KeyHandler): void {
  const dispatcher = useKeyboardDispatcher();
  useEffect(() => dispatcher.register(mode, pattern, handler), [dispatcher, mode, pattern, handler]);
}

export function useKeyboardDefaultHandler(handler: KeyHandler): void {
  const dispatcher = useKeyboardDispatcher();
  useEffect(() => dispatcher.setDefaultHandler(handler), [dispatcher, handler]);
}
