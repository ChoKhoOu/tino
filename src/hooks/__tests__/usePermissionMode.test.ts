import { describe, expect, test } from 'bun:test';
import { createPermissionModeState } from '../usePermissionMode.js';

describe('createPermissionModeState', () => {
  test('starts in default mode by default', () => {
    const state = createPermissionModeState();
    expect(state.currentMode).toBe('default');
  });

  test('accepts an initial mode', () => {
    const state = createPermissionModeState('plan');
    expect(state.currentMode).toBe('plan');
  });

  test('cycleMode moves through all modes and wraps to default', () => {
    const state = createPermissionModeState();

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

  test('setMode sets the requested mode directly', () => {
    const state = createPermissionModeState();
    state.setMode('delegate');
    expect(state.currentMode).toBe('delegate');
    state.setMode('auto-accept');
    expect(state.currentMode).toBe('auto-accept');
  });

  test('calls onModeChange for cycleMode and setMode', () => {
    const changes: string[] = [];
    const state = createPermissionModeState('default', (mode) => {
      changes.push(mode);
    });

    state.cycleMode();
    state.setMode('plan');

    expect(changes).toEqual(['auto-accept', 'plan']);
  });
});
