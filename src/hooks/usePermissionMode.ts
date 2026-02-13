import { useCallback, useState } from 'react';
import { getNextPermissionMode, type PermissionMode } from '@/domain/permission-mode.js';

export interface UsePermissionModeResult {
  currentMode: PermissionMode;
  cycleMode: () => void;
  setMode: (mode: PermissionMode) => void;
}

export interface PermissionModeState {
  currentMode: PermissionMode;
  cycleMode: () => PermissionMode;
  setMode: (mode: PermissionMode) => PermissionMode;
}

export function createPermissionModeState(
  initialMode: PermissionMode = 'default',
  onModeChange?: (mode: PermissionMode) => void,
): PermissionModeState {
  let currentMode = initialMode;

  const applyMode = (nextMode: PermissionMode): PermissionMode => {
    currentMode = nextMode;
    onModeChange?.(nextMode);
    return currentMode;
  };

  return {
    get currentMode() {
      return currentMode;
    },
    cycleMode() {
      return applyMode(getNextPermissionMode(currentMode));
    },
    setMode(mode) {
      return applyMode(mode);
    },
  };
}

export function usePermissionMode(
  initialMode: PermissionMode = 'default',
  onModeChange?: (mode: PermissionMode) => void,
): UsePermissionModeResult {
  const [currentMode, setCurrentMode] = useState<PermissionMode>(initialMode);

  const setMode = useCallback((mode: PermissionMode) => {
    setCurrentMode(mode);
    onModeChange?.(mode);
  }, [onModeChange]);

  const cycleMode = useCallback(() => {
    setCurrentMode((previousMode) => {
      const nextMode = getNextPermissionMode(previousMode);
      onModeChange?.(nextMode);
      return nextMode;
    });
  }, [onModeChange]);

  return { currentMode, cycleMode, setMode };
}
