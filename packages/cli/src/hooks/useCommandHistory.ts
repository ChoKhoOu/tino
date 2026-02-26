import { useState, useCallback, useEffect, useRef } from 'react';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HISTORY_DIR = join(homedir(), '.tino');
const HISTORY_FILE = join(HISTORY_DIR, 'command-history.json');
const DEFAULT_MAX_ENTRIES = 500;

export interface UseCommandHistoryReturn {
  history: string[];
  addEntry: (command: string) => void;
  navigateUp: () => string | null;
  navigateDown: () => string | null;
  resetNavigation: () => void;
}

function loadHistory(): string[] {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }
    const raw = readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function saveHistory(entries: string[]): void {
  try {
    if (!existsSync(HISTORY_DIR)) {
      mkdirSync(HISTORY_DIR, { recursive: true });
    }
    writeFileSync(HISTORY_FILE, JSON.stringify(entries), 'utf-8');
  } catch {
    // Gracefully ignore write failures
  }
}

export function useCommandHistory(maxEntries: number = DEFAULT_MAX_ENTRIES): UseCommandHistoryReturn {
  const [history, setHistory] = useState<string[]>([]);
  const indexRef = useRef(-1);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addEntry = useCallback((command: string) => {
    setHistory((prev) => {
      // Skip if same as the last entry (dedup consecutive)
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }

      const updated = [...prev, command];
      // Cap at maxEntries
      const capped = updated.length > maxEntries
        ? updated.slice(updated.length - maxEntries)
        : updated;

      saveHistory(capped);
      // Reset navigation index after adding
      indexRef.current = -1;
      return capped;
    });
  }, [maxEntries]);

  const navigateUp = useCallback((): string | null => {
    const currentHistory = history;
    if (currentHistory.length === 0) {
      return null;
    }

    if (indexRef.current === -1) {
      // Start navigating from the end
      indexRef.current = currentHistory.length - 1;
    } else if (indexRef.current > 0) {
      indexRef.current--;
    }

    return currentHistory[indexRef.current] ?? null;
  }, [history]);

  const navigateDown = useCallback((): string | null => {
    const currentHistory = history;
    if (indexRef.current === -1) {
      return null;
    }

    if (indexRef.current < currentHistory.length - 1) {
      indexRef.current++;
      return currentHistory[indexRef.current] ?? null;
    }

    // Past the end -- back to current input
    indexRef.current = -1;
    return null;
  }, [history]);

  const resetNavigation = useCallback(() => {
    indexRef.current = -1;
  }, []);

  return { history, addEntry, navigateUp, navigateDown, resetNavigation };
}
