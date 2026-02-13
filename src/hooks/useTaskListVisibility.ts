import { useCallback, useEffect, useState } from 'react';
import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';

export interface UseTaskListVisibilityResult {
  isVisible: boolean;
  toggle: () => void;
}

export interface TaskListVisibilityState {
  isVisible: boolean;
  toggle: () => void;
}

export function createTaskListVisibilityState(initialValue = false): TaskListVisibilityState {
  let isVisible = initialValue;

  return {
    get isVisible() {
      return isVisible;
    },
    toggle() {
      isVisible = !isVisible;
    },
  };
}

export function registerTaskListToggle(dispatcher: KeyboardDispatcher, toggle: () => void): () => void {
  return dispatcher.register('normal', 'ctrl+t', () => {
    toggle();
    return true;
  });
}

export function useTaskListVisibility(dispatcher: KeyboardDispatcher): UseTaskListVisibilityResult {
  const [isVisible, setIsVisible] = useState(false);

  const toggle = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  useEffect(() => registerTaskListToggle(dispatcher, toggle), [dispatcher, toggle]);

  return { isVisible, toggle };
}
