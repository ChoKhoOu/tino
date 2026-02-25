import { useState, useCallback, useEffect } from 'react';
import type { KeyboardDispatcher } from '../keyboard/dispatcher.js';

export interface DashboardState {
  isActive: boolean;
  toggle: () => void;
  close: () => void;
}

export function createDashboardState(): DashboardState {
  let active = false;
  const state: DashboardState = {
    get isActive() { return active; },
    toggle() { active = !active; },
    close() { active = false; },
  };
  return state;
}

export function registerDashboardToggle(
  dispatcher: KeyboardDispatcher,
  toggle: () => void,
  close: () => void,
): () => void {
  const unregCtrlD = dispatcher.register('normal', 'ctrl+d', () => {
    toggle();
    return true;
  });
  const unregEsc = dispatcher.register('dashboard', 'escape', () => {
    close();
    return true;
  });
  return () => {
    unregCtrlD();
    unregEsc();
  };
}

export function useDashboard(dispatcher: KeyboardDispatcher): DashboardState {
  const [isActive, setIsActive] = useState(false);

  const toggle = useCallback(() => {
    setIsActive(prev => {
      const next = !prev;
      if (next) {
        dispatcher.pushMode('dashboard');
      } else {
        dispatcher.popMode();
      }
      return next;
    });
  }, [dispatcher]);

  const close = useCallback(() => {
    setIsActive(prev => {
      if (prev) {
        dispatcher.popMode();
      }
      return false;
    });
  }, [dispatcher]);

  useEffect(() => {
    return registerDashboardToggle(dispatcher, toggle, close);
  }, [dispatcher, toggle, close]);

  return { isActive, toggle, close };
}
