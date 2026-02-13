import { useState, useCallback, useEffect } from 'react';

import { getNextPermissionMode, PERMISSION_MODE_DESCRIPTIONS, type PermissionMode } from '@/domain/permission-mode.js';
import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';

export interface UsePermissionModeToggleResult {
  permissionMode: PermissionMode;
  cyclePermissionMode: () => void;
}

export function usePermissionModeToggle(dispatcher: KeyboardDispatcher): UsePermissionModeToggleResult {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');

  const cyclePermissionMode = useCallback(() => {
    setPermissionMode((prev) => getNextPermissionMode(prev));
  }, []);

  useEffect(() => {
    return dispatcher.register('normal', 'shift+tab', () => {
      cyclePermissionMode();
      return true;
    });
  }, [dispatcher, cyclePermissionMode]);

  return { permissionMode, cyclePermissionMode };
}

export function getPermissionModeLabel(mode: PermissionMode): string {
  return PERMISSION_MODE_DESCRIPTIONS[mode].title;
}
