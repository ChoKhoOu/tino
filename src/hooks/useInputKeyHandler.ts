import { useCallback } from 'react';
import type { KeyEvent } from '../keyboard/types.js';
import type { TextBufferActions } from './useTextBuffer.js';
import { cursorHandlers } from '../utils/input-key-handlers.js';
import { shouldTreatAsMultiline } from '../hooks/useKeyboardShortcuts.js';

interface UseInputKeyHandlerProps {
  text: string;
  cursorPosition: number;
  actions: TextBufferActions;
  isAutocompleteActive: boolean;
  bashHint: string | null;
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
  onSubmit: (value: string) => void;
  handleAutocompleteKey: (event: KeyEvent) => boolean;
}

export function useInputKeyHandler({
  text,
  cursorPosition,
  actions,
  isAutocompleteActive,
  bashHint,
  onHistoryNavigate,
  onSubmit,
  handleAutocompleteKey,
}: UseInputKeyHandlerProps) {
  return useCallback((event: KeyEvent) => {
    const { input, key } = event;
    const ctx = { text, cursorPosition };

    if (handleAutocompleteKey(event)) {
      return true;
    }

    if (key.tab && !isAutocompleteActive && bashHint) {
      actions.setValue('!' + bashHint);
      return true;
    }

    // Up arrow: move cursor up if not on first line, else history navigation
    if (key.upArrow) {
      const newPos = cursorHandlers.moveUp(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('up');
      }
      return true;
    }

    // Down arrow: move cursor down if not on last line, else history navigation
    if (key.downArrow) {
      const newPos = cursorHandlers.moveDown(ctx);
      if (newPos !== null) {
        actions.moveCursor(newPos);
      } else if (onHistoryNavigate) {
        onHistoryNavigate('down');
      }
      return true;
    }

    // Cursor movement - left arrow (plain, no modifiers)
    if (key.leftArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveLeft(ctx));
      return true;
    }

    // Cursor movement - right arrow (plain, no modifiers)
    if (key.rightArrow && !key.ctrl && !key.meta) {
      actions.moveCursor(cursorHandlers.moveRight(ctx));
      return true;
    }

    // Ctrl+A - move to beginning of current line
    if (key.ctrl && input === 'a') {
      actions.moveCursor(cursorHandlers.moveToLineStart(ctx));
      return true;
    }

    // Ctrl+E - move to end of current line
    if (key.ctrl && input === 'e') {
      actions.moveCursor(cursorHandlers.moveToLineEnd(ctx));
      return true;
    }

    // Option+Left (Mac) / Ctrl+Left (Windows) / Alt+B - word backward
    if ((key.meta && key.leftArrow) || (key.ctrl && key.leftArrow) || (key.meta && input === 'b')) {
      actions.moveCursor(cursorHandlers.moveWordBackward(ctx));
      return true;
    }

    // Option+Right (Mac) / Ctrl+Right (Windows) / Alt+F - word forward
    if ((key.meta && key.rightArrow) || (key.ctrl && key.rightArrow) || (key.meta && input === 'f')) {
      actions.moveCursor(cursorHandlers.moveWordForward(ctx));
      return true;
    }

    // Option+Backspace (Mac) / Ctrl+Backspace (Windows) - delete word backward
    if ((key.meta || key.ctrl) && (key.backspace || key.delete)) {
      actions.deleteWordBackward();
      return true;
    }

    // Handle backspace/delete - delete character before cursor
    if (key.backspace || key.delete) {
      actions.deleteBackward();
      return true;
    }

    // Shift+Enter - insert newline for multi-line input
    if (key.return && key.shift) {
      actions.insert('\n');
      return true;
    }

    // Handle submit (plain Enter)
    if (key.return) {
      if (shouldTreatAsMultiline(text)) {
        actions.setValue(text.slice(0, -1) + '\n', true);
        return true;
      }
      const val = text.trim();
      if (val) {
        onSubmit(val);
        actions.clear();
      }
      return true;
    }

    // Handle regular character input - insert at cursor position
    if (input && !key.ctrl && !key.meta) {
      actions.insert(input);
      return true;
    }

    return false;
  }, [
    actions,
    bashHint,
    cursorPosition,
    handleAutocompleteKey,
    isAutocompleteActive,
    onHistoryNavigate,
    onSubmit,
    text,
  ]);
}
