import { useCallback } from 'react';
import type { KeyEvent } from '../keyboard/types.js';
import type { TextBufferActions } from './useTextBuffer.js';

interface UseAutocompleteKeyHandlerProps {
  isAutocompleteActive: boolean;
  files: string[];
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  query: string | null;
  text: string;
  cursorPosition: number;
  actions: TextBufferActions;
}

export function useAutocompleteKeyHandler({
  isAutocompleteActive,
  files,
  selectedIndex,
  setSelectedIndex,
  query,
  text,
  cursorPosition,
  actions,
}: UseAutocompleteKeyHandlerProps) {
  return useCallback((event: KeyEvent): boolean => {
    const { key } = event;

    if (!isAutocompleteActive) {
      return false;
    }

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

    return false;
  }, [
    isAutocompleteActive,
    files,
    selectedIndex,
    setSelectedIndex,
    query,
    text,
    cursorPosition,
    actions,
  ]);
}
