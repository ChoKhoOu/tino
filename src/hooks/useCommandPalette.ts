import { useState, useMemo, useEffect, useCallback } from 'react';
import { useKeyboardDispatcher } from '../keyboard/use-keyboard.js';
import { SLASH_COMMANDS } from '../commands/slash.js';
import type { CommandPaletteItem } from '../components/CommandPalette.js';

export interface UseCommandPaletteResult {
  isOpen: boolean;
  query: string;
  setQuery: (q: string) => void;
  selectedIndex: number;
  items: CommandPaletteItem[];
  recentCommands: string[];
  open: () => void;
  close: () => void;
  select: (command: string) => void;
}

const PREDEFINED_COMMANDS: CommandPaletteItem[] = [
  // Market
  { id: 'm1', category: 'Market', title: 'View Bitcoin Price', command: 'What is the current price of BTC?' },
  { id: 'm2', category: 'Market', title: 'View Ethereum Price', command: 'What is the current price of ETH?' },
  { id: 'm3', category: 'Market', title: 'Top Gainers', command: 'Show me the top gaining tokens in the last 24h' },
  // Backtest
  { id: 'b1', category: 'Backtest', title: 'Run Backtest', command: 'Run a backtest for my strategy' },
  { id: 'b2', category: 'Backtest', title: 'View Backtest Results', command: 'Show the results of the last backtest' },
  // Trading
  { id: 't1', category: 'Trading', title: 'View Positions', command: 'Show my current open positions' },
  { id: 't2', category: 'Trading', title: 'View Balances', command: 'Show my current account balances' },
  { id: 't3', category: 'Trading', title: 'Cancel All Orders', command: 'Cancel all open orders' },
  // Settings
  { id: 's1', category: 'Settings', title: 'Toggle Verbose Mode', command: '/verbose' },
  { id: 's2', category: 'Settings', title: 'Show Tool Permissions', command: '/permissions' },
  // System
  ...Object.entries(SLASH_COMMANDS).map(([cmd, desc]) => ({
    id: cmd,
    category: 'System',
    title: cmd,
    subtitle: desc,
    command: cmd,
  })),
];

export function useCommandPalette(
  onCommandSelect: (command: string) => void
): UseCommandPaletteResult {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const dispatcher = useKeyboardDispatcher();

  const items = useMemo(() => {
    let allItems = [...PREDEFINED_COMMANDS];
    
    // Add recents if no query
    if (!query && recentCommands.length > 0) {
      const recents: CommandPaletteItem[] = recentCommands.map((cmd, i) => ({
        id: `recent-${i}`,
        category: 'Recent',
        title: cmd,
        command: cmd,
      }));
      // Deduplicate
      const recentCmdStrings = new Set(recentCommands);
      allItems = allItems.filter(item => !recentCmdStrings.has(item.command));
      allItems = [...recents, ...allItems];
    }

    if (!query) {
      return allItems;
    }

    const q = query.toLowerCase();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    ).sort((a, b) => {
      // Basic sorting: title match preferred
      const aTitleMatch = a.title.toLowerCase().includes(q);
      const bTitleMatch = b.title.toLowerCase().includes(q);
      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;
      return 0;
    });
  }, [query, recentCommands]);

  const open = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const select = useCallback((command: string) => {
    setRecentCommands(prev => {
      const newRecents = [command, ...prev.filter(c => c !== command)].slice(0, 10);
      return newRecents;
    });
    setIsOpen(false);
    onCommandSelect(command);
  }, [onCommandSelect]);

  // Handle Ctrl+P shortcut to open
  useEffect(() => {
    // We register in normal mode
    return dispatcher.register('normal', 'ctrl+p', () => {
      open();
      return true; // We handled it
    });
  }, [dispatcher, open]);

  // When opened, setup keyboard handlers for navigation
  useEffect(() => {
    if (!isOpen) return;

    // Use popup mode so input doesn't affect main CLI history, but might conflict with text input?
    // We can register enter, up, down. Since ink-text-input doesn't use the dispatcher,
    // if we intercept enter/up/down via dispatcher, we prevent ink-text-input from getting them?
    // Wait, ink-text-input takes raw stdin events. If the dispatcher doesn't stop propagation at the raw stdin level,
    // ink-text-input still gets it. Fortunately, up/down aren't used by basic ink-text-input, except maybe left/right.
    // Enter is used to submit, so we should intercept Enter.
    
    dispatcher.pushMode('popup');

    const cleanupUp = dispatcher.register('popup', 'up', () => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      return true;
    });

    const cleanupDown = dispatcher.register('popup', 'down', () => {
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      return true;
    });

    const cleanupEnter = dispatcher.register('popup', 'return', () => {
      if (items.length > 0) {
        const idx = Math.min(selectedIndex, items.length - 1);
        select(items[idx].command);
      }
      return true;
    });

    const cleanupEsc = dispatcher.register('popup', 'escape', () => {
      close();
      return true;
    });

    return () => {
      cleanupUp();
      cleanupDown();
      cleanupEnter();
      cleanupEsc();
      dispatcher.popMode();
    };
  }, [isOpen, items, selectedIndex, dispatcher, select, close]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return { isOpen, query, setQuery, selectedIndex, items, recentCommands, open, close, select };
}
