import { useState, useCallback, useEffect } from 'react';
import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseVerboseModeResult {
  isVerbose: boolean;
  toggleVerbose: () => void;
}

// ─── Pure state (testable without React) ────────────────────────────────────

export interface VerboseState {
  isVerbose: boolean;
  toggle: () => void;
}

export function createVerboseState(initialValue = false): VerboseState {
  let isVerbose = initialValue;

  return {
    get isVerbose() {
      return isVerbose;
    },
    toggle() {
      isVerbose = !isVerbose;
    },
  };
}

// ─── React hook ─────────────────────────────────────────────────────────────

export function useVerboseMode(dispatcher: KeyboardDispatcher): UseVerboseModeResult {
  const [isVerbose, setIsVerbose] = useState(false);

  const toggleVerbose = useCallback(() => {
    setIsVerbose(prev => !prev);
  }, []);

  useEffect(() => {
    return dispatcher.register('normal', 'ctrl+o', () => {
      toggleVerbose();
      return true;
    });
  }, [dispatcher, toggleVerbose]);

  return { isVerbose, toggleVerbose };
}
