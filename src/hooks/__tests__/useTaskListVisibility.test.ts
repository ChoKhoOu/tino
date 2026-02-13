import { describe, expect, test } from 'bun:test';
import { KeyboardDispatcher } from '@/keyboard/dispatcher.js';
import {
  createTaskListVisibilityState,
  registerTaskListToggle,
} from '../useTaskListVisibility.js';

const CTRL_T_EVENT = {
  input: 't',
  key: {
    ctrl: true,
    meta: false,
    shift: false,
    escape: false,
    return: false,
    tab: false,
    backspace: false,
    delete: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
  },
} as const;

describe('useTaskListVisibility', () => {
  test('creates hidden state by default', () => {
    const state = createTaskListVisibilityState();
    expect(state.isVisible).toBe(false);
  });

  test('toggle flips visibility', () => {
    const state = createTaskListVisibilityState();
    state.toggle();
    expect(state.isVisible).toBe(true);
    state.toggle();
    expect(state.isVisible).toBe(false);
  });

  test('registerTaskListToggle registers ctrl+t in normal mode', () => {
    const dispatcher = new KeyboardDispatcher();
    const state = createTaskListVisibilityState();
    const unregister = registerTaskListToggle(dispatcher, state.toggle);

    dispatcher.dispatch(CTRL_T_EVENT);
    expect(state.isVisible).toBe(true);

    dispatcher.dispatch(CTRL_T_EVENT);
    expect(state.isVisible).toBe(false);

    unregister();
  });
});
