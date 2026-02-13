import { describe, expect, test } from 'bun:test';
import { createPermissionModeState } from '../usePermissionMode.js';
import { getPermissionModeLabel } from '../usePermissionModeToggle.js';
import { PERMISSION_MODE_DESCRIPTIONS } from '@/domain/permission-mode.js';

describe('permission mode toggle via Shift+Tab', () => {
  test('cycles through all modes in order: default → auto-accept → plan → delegate → default', () => {
    const state = createPermissionModeState('default');

    expect(state.currentMode).toBe('default');

    state.cycleMode();
    expect(state.currentMode).toBe('auto-accept');

    state.cycleMode();
    expect(state.currentMode).toBe('plan');

    state.cycleMode();
    expect(state.currentMode).toBe('delegate');

    state.cycleMode();
    expect(state.currentMode).toBe('default');
  });

  test('each mode has a title in PERMISSION_MODE_DESCRIPTIONS', () => {
    const state = createPermissionModeState('default');
    const titles: string[] = [];

    for (let i = 0; i < 4; i++) {
      titles.push(PERMISSION_MODE_DESCRIPTIONS[state.currentMode].title);
      state.cycleMode();
    }

    expect(titles).toEqual(['Default', 'Auto Accept', 'Plan', 'Delegate']);
  });

  test('onModeChange fires on each cycle', () => {
    const changes: string[] = [];
    const state = createPermissionModeState('default', (mode) => {
      changes.push(mode);
    });

    state.cycleMode();
    state.cycleMode();
    state.cycleMode();
    state.cycleMode();

    expect(changes).toEqual(['auto-accept', 'plan', 'delegate', 'default']);
  });
});

describe('getPermissionModeLabel', () => {
  test('returns human-readable title for each mode', () => {
    expect(getPermissionModeLabel('default')).toBe('Default');
    expect(getPermissionModeLabel('auto-accept')).toBe('Auto Accept');
    expect(getPermissionModeLabel('plan')).toBe('Plan');
    expect(getPermissionModeLabel('delegate')).toBe('Delegate');
  });
});
