import { useState, useCallback } from 'react';

import { getSetting, setSetting } from '@/config/settings.js';
import { useKeyboardBinding } from '@/keyboard/use-keyboard.js';

export const THINKING_SETTING_KEY = 'extendedThinking';

export function getThinkingEnabled(): boolean {
  return getSetting<boolean>(THINKING_SETTING_KEY, false);
}

export function toggleThinkingSetting(): boolean {
  const current = getThinkingEnabled();
  const next = !current;
  setSetting(THINKING_SETTING_KEY, next);
  return next;
}

export interface UseThinkingToggleResult {
  isThinkingEnabled: boolean;
  toggleThinking: () => void;
}

export function useThinkingToggle(): UseThinkingToggleResult {
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(() => getThinkingEnabled());

  const toggleThinking = useCallback(() => {
    const next = toggleThinkingSetting();
    setIsThinkingEnabled(next);
  }, []);

  useKeyboardBinding('normal', 'alt+t', () => {
    toggleThinking();
    return true;
  });

  return { isThinkingEnabled, toggleThinking };
}
