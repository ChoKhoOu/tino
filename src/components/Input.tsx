import { useCallback, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../theme.js';
import { useTextBuffer } from '../hooks/useTextBuffer.js';
import { shouldTreatAsMultiline } from '../hooks/useKeyboardShortcuts.js';
import { cursorHandlers } from '../utils/input-key-handlers.js';
import { CursorText } from './CursorText.js';
import { FileAutocomplete } from './FileAutocomplete.js';
import { BashHistoryHint } from './BashHistoryHint.js';
import { useAutocomplete } from '../hooks/useAutocomplete.js';
import { useKeyboardDefaultHandler } from '../keyboard/use-keyboard.js';
import type { KeyEvent } from '../keyboard/types.js';
import type { BashHistory } from '../hooks/useBashHistory.js';

interface InputProps {
  onSubmit: (value: string) => void;
  historyValue?: string | null;
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
  bashHistory?: BashHistory | null;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate, bashHistory }: InputProps) {
  const { text, cursorPosition, actions } = useTextBuffer();
  const { query, files, selectedIndex, setSelectedIndex } = useAutocomplete(text, cursorPosition);
  const isAutocompleteActive = query !== null && files.length > 0;

  const bashPrefix = text.startsWith('!') ? text.slice(1) : null;
  const bashHint = useMemo(
    () => bashPrefix && bashHistory ? bashHistory.getBestMatch(bashPrefix) : null,
    [bashPrefix, bashHistory],
  );

  // Update input buffer when history navigation changes
  useEffect(() => {
    if (historyValue === null) {
      // Returned to typing mode - clear input for fresh entry
      actions.clear();
    } else if (historyValue !== undefined) {
      // Navigating history - show the historical message
      actions.setValue(historyValue);
    }
  }, [actions, historyValue]);

  const handleInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;
    const ctx = { text, cursorPosition };

    if (isAutocompleteActive) {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return true;
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(files.length - 1, prev + 1));
        return true;
      }
      if (key.tab || key.return) {
        const selectedFile = files[selectedIndex];
        if (selectedFile && query !== null) {
          const queryStart = cursorPosition - query.length;
          const before = text.slice(0, queryStart);
          const after = text.slice(cursorPosition);
          const newText = before + selectedFile + after;
          actions.setValue(newText);
          actions.moveCursor(queryStart + selectedFile.length);
        }
        return true;
      }
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
    files,
    isAutocompleteActive,
    onHistoryNavigate,
    onSubmit,
    query,
    selectedIndex,
    setSelectedIndex,
    text,
  ]);

  useKeyboardDefaultHandler(handleInput);

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.mutedDark}
      borderLeft={false}
      borderRight={false}
      width="100%"
    >
      <FileAutocomplete files={files} selectedIndex={selectedIndex} />
      <Box paddingX={1}>
        <Text color={colors.primary} bold>
          {'> '}
        </Text>
        <CursorText text={text} cursorPosition={cursorPosition} />
        <BashHistoryHint text={text} bestMatch={bashHint} />
      </Box>
    </Box>
  );
}
