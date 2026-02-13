import { useState, useMemo, useEffect } from 'react';
import { SLASH_COMMANDS } from '../commands/slash.js';
import { useKeyboardDispatcher } from '../keyboard/use-keyboard.js';

export interface SlashCommandOption {
  command: string;
  description: string;
}

export interface UseSlashCommandMenuResult {
  isOpen: boolean;
  selectedIndex: number;
  filteredCommands: SlashCommandOption[];
}

export function useSlashCommandMenu(
  input: string,
  onSelect: (command: string) => void,
  onClose: () => void
): UseSlashCommandMenuResult {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const dispatcher = useKeyboardDispatcher();

  // Reset dismissed state when input changes significantly (e.g. new search)
  // But we want to keep it dismissed if the user is just typing after dismissing?
  // Usually, typing a new character re-opens the menu.
  useEffect(() => {
    setDismissed(false);
    setSelectedIndex(0);
  }, [input]);

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return [];
    
    const search = input.toLowerCase();
    return Object.entries(SLASH_COMMANDS)
      .filter(([cmd]) => cmd.toLowerCase().startsWith(search))
      .map(([command, description]) => ({ command, description }));
  }, [input]);

  const isOpen = input.startsWith('/') && !dismissed && filteredCommands.length > 0;

  // Manage keyboard mode
  useEffect(() => {
    if (isOpen) {
      dispatcher.pushMode('popup');
      return () => {
        dispatcher.popMode();
      };
    }
  }, [isOpen, dispatcher]);

  // Register handlers
  useEffect(() => {
    if (!isOpen) return;

    const cleanupUp = dispatcher.register('popup', 'up', () => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      return true;
    });

    const cleanupDown = dispatcher.register('popup', 'down', () => {
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      return true;
    });

    const cleanupEnter = dispatcher.register('popup', 'return', () => {
      if (filteredCommands[selectedIndex]) {
        onSelect(filteredCommands[selectedIndex].command);
      }
      return true;
    });

    const cleanupEsc = dispatcher.register('popup', 'escape', () => {
      setDismissed(true);
      onClose();
      return true;
    });

    return () => {
      cleanupUp();
      cleanupDown();
      cleanupEnter();
      cleanupEsc();
    };
  }, [isOpen, filteredCommands, selectedIndex, dispatcher, onSelect, onClose]);

  return {
    isOpen,
    selectedIndex,
    filteredCommands,
  };
}
