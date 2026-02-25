import { describe, expect, test } from 'bun:test';
import { KeyboardDispatcher } from '@/keyboard/dispatcher.js';
import {
  createDashboardState,
  registerDashboardToggle,
} from '@/hooks/useDashboard.js';

const makeKeyEvent = (input: string, overrides: Partial<Record<string, boolean>> = {}) => ({
  input,
  key: {
    ctrl: false,
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
    ...overrides,
  },
});

const CTRL_D_EVENT = makeKeyEvent('d', { ctrl: true });
const ESCAPE_EVENT = makeKeyEvent('', { escape: true });

describe('createDashboardState', () => {
  test('creates inactive state by default', () => {
    const state = createDashboardState();
    expect(state.isActive).toBe(false);
  });

  test('toggle flips isActive', () => {
    const state = createDashboardState();
    state.toggle();
    expect(state.isActive).toBe(true);
    state.toggle();
    expect(state.isActive).toBe(false);
  });

  test('close sets isActive to false', () => {
    const state = createDashboardState();
    state.toggle(); // true
    expect(state.isActive).toBe(true);
    state.close();
    expect(state.isActive).toBe(false);
  });

  test('close when already inactive is no-op', () => {
    const state = createDashboardState();
    state.close();
    expect(state.isActive).toBe(false);
  });
});

describe('registerDashboardToggle', () => {
  test('ctrl+d toggles dashboard in normal mode', () => {
    const dispatcher = new KeyboardDispatcher();
    const state = createDashboardState();
    const unregister = registerDashboardToggle(dispatcher, state.toggle, state.close);

    dispatcher.dispatch(CTRL_D_EVENT);
    expect(state.isActive).toBe(true);

    unregister();
  });

  test('ctrl+d toggles dashboard off when active', () => {
    const dispatcher = new KeyboardDispatcher();
    const state = createDashboardState();
    const unregister = registerDashboardToggle(dispatcher, state.toggle, state.close);

    dispatcher.dispatch(CTRL_D_EVENT);
    expect(state.isActive).toBe(true);

    // Toggle back (from normal mode since we don't push mode in pure state tests)
    dispatcher.dispatch(CTRL_D_EVENT);
    expect(state.isActive).toBe(false);

    unregister();
  });

  test('escape closes dashboard in dashboard mode', () => {
    const dispatcher = new KeyboardDispatcher();
    const state = createDashboardState();
    const unregister = registerDashboardToggle(dispatcher, state.toggle, state.close);

    state.toggle(); // Activate
    dispatcher.pushMode('dashboard');
    expect(state.isActive).toBe(true);

    // Escape in dashboard mode — dispatched via handleEscape with delay,
    // so we test the handler registration directly
    const handlers = (dispatcher as any).handlers;
    const escBucket = handlers.get('dashboard:escape');
    expect(escBucket).toBeDefined();
    expect(escBucket.size).toBe(1);

    // Invoke handler directly
    for (const handler of escBucket) {
      handler(ESCAPE_EVENT);
    }
    expect(state.isActive).toBe(false);

    unregister();
  });

  test('unregister removes handlers', () => {
    const dispatcher = new KeyboardDispatcher();
    const state = createDashboardState();
    const unregister = registerDashboardToggle(dispatcher, state.toggle, state.close);

    unregister();

    dispatcher.dispatch(CTRL_D_EVENT);
    expect(state.isActive).toBe(false); // Handler was removed
  });
});
