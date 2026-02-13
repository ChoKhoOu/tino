import { useEffect } from 'react';
import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';

export type ShortcutAction = 'clear_screen' | 'exit';

interface KeyInfo {
  ctrl?: boolean;
  escape?: boolean;
  return?: boolean;
}

export function classifyShortcut(input: string, key: KeyInfo): ShortcutAction | null {
  if (key.ctrl && input === 'l') return 'clear_screen';
  if (key.ctrl && input === 'd') return 'exit';
  return null;
}

export function shouldTreatAsMultiline(text: string): boolean {
  return text.length > 0 && text.endsWith('\\');
}

interface KeyboardShortcutHandlers {
  onClearScreen: () => void;
  onExit: () => void;
}

export function useKeyboardShortcuts(dispatcher: KeyboardDispatcher, handlers: KeyboardShortcutHandlers) {
  const { onClearScreen, onExit } = handlers;

  useEffect(() => {
    const unregisterClear = dispatcher.register('global', 'ctrl+l', () => {
      onClearScreen();
      return true;
    });

    const unregisterExit = dispatcher.register('global', 'ctrl+d', () => {
      onExit();
      return true;
    });

    return () => {
      unregisterClear();
      unregisterExit();
    };
  }, [dispatcher, onClearScreen, onExit]);
}
