import { useInput } from 'ink';

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

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useInput((input, key) => {
    const action = classifyShortcut(input, key);
    if (action === 'clear_screen') {
      process.stdout.write('\x1B[2J\x1B[0f');
      handlers.onClearScreen();
      return;
    }
    if (action === 'exit') {
      handlers.onExit();
      return;
    }
  });
}
