import { useCallback, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../theme.js';
import { useTextBuffer } from '../hooks/useTextBuffer.js';
import { CursorText } from './CursorText.js';
import { FileAutocomplete } from './FileAutocomplete.js';
import { BashHistoryHint } from './BashHistoryHint.js';
import { useAutocomplete } from '../hooks/useAutocomplete.js';
import { useKeyboardDefaultHandler } from '../keyboard/use-keyboard.js';
import type { BashHistory } from '../hooks/useBashHistory.js';
import { useSlashCommandMenu } from '../hooks/useSlashCommandMenu.js';
import { SlashCommandMenu } from './SlashCommandMenu.js';
import { useAutocompleteKeyHandler } from '../hooks/useAutocompleteKeyHandler.js';
import { useInputKeyHandler } from '../hooks/useInputKeyHandler.js';

interface InputProps {
  onSubmit: (value: string) => void;
  historyValue?: string | null;
  onHistoryNavigate?: (direction: 'up' | 'down') => void;
  bashHistory?: BashHistory | null;
  onSlashSelect?: (command: string) => void;
}

export function Input({ onSubmit, historyValue, onHistoryNavigate, bashHistory, onSlashSelect }: InputProps) {
  const { text, cursorPosition, actions } = useTextBuffer();
  const { query, files, selectedIndex, setSelectedIndex } = useAutocomplete(text, cursorPosition);
  const isAutocompleteActive = query !== null && files.length > 0;

  const handleSlashSelect = useCallback((command: string) => {
    onSlashSelect?.(command);
    actions.clear();
  }, [onSlashSelect, actions]);

  const slashMenu = useSlashCommandMenu(
    text,
    handleSlashSelect,
    () => {}
  );

  const handleAutocompleteKey = useAutocompleteKeyHandler({
    isAutocompleteActive,
    files,
    selectedIndex,
    setSelectedIndex,
    query,
    text,
    cursorPosition,
    actions,
  });

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

  const handleInput = useInputKeyHandler({
    text,
    cursorPosition,
    actions,
    isAutocompleteActive,
    bashHint,
    onHistoryNavigate,
    onSubmit,
    handleAutocompleteKey,
  });

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
      <SlashCommandMenu
        isOpen={slashMenu.isOpen}
        selectedIndex={slashMenu.selectedIndex}
        filteredCommands={slashMenu.filteredCommands}
      />
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
