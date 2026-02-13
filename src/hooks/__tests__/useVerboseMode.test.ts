import { describe, test, expect } from 'bun:test';
import { createVerboseState } from '../useVerboseMode.js';

describe('createVerboseState', () => {
  test('starts with verbose disabled by default', () => {
    const state = createVerboseState();
    expect(state.isVerbose).toBe(false);
  });

  test('starts with verbose enabled when initialValue is true', () => {
    const state = createVerboseState(true);
    expect(state.isVerbose).toBe(true);
  });

  test('toggle switches from false to true', () => {
    const state = createVerboseState();
    expect(state.isVerbose).toBe(false);
    state.toggle();
    expect(state.isVerbose).toBe(true);
  });

  test('toggle switches from true to false', () => {
    const state = createVerboseState(true);
    expect(state.isVerbose).toBe(true);
    state.toggle();
    expect(state.isVerbose).toBe(false);
  });

  test('multiple toggles alternate state', () => {
    const state = createVerboseState();
    expect(state.isVerbose).toBe(false);
    state.toggle();
    expect(state.isVerbose).toBe(true);
    state.toggle();
    expect(state.isVerbose).toBe(false);
    state.toggle();
    expect(state.isVerbose).toBe(true);
  });
});
