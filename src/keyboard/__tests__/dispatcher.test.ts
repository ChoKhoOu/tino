import { describe, expect, test } from 'bun:test';

import { ESCAPE_DELAY_MS } from '../constants.js';
import { KeyboardDispatcher } from '../dispatcher.js';
import type { KeyEvent } from '../types.js';

function createEvent(input = '', key: Partial<KeyEvent['key']> = {}): KeyEvent {
  return {
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
      ...key,
    },
  };
}

describe('KeyboardDispatcher', () => {
  test('prefers current mode handlers before global handlers', () => {
    const dispatcher = new KeyboardDispatcher();
    const calls: string[] = [];

    dispatcher.register('global', 'ctrl+l', () => {
      calls.push('global');
      return true;
    });
    dispatcher.register('popup', 'ctrl+l', () => {
      calls.push('popup');
      return true;
    });
    dispatcher.pushMode('popup');

    const handled = dispatcher.dispatch(createEvent('l', { ctrl: true }));

    expect(handled).toBe(true);
    expect(calls).toEqual(['popup']);
  });

  test('falls back to global handler when current mode does not handle', () => {
    const dispatcher = new KeyboardDispatcher();
    const calls: string[] = [];

    dispatcher.pushMode('permission');
    dispatcher.register('global', 'ctrl+c', () => {
      calls.push('global');
      return true;
    });

    const handled = dispatcher.dispatch(createEvent('c', { ctrl: true }));

    expect(handled).toBe(true);
    expect(calls).toEqual(['global']);
  });

  test('supports mode stack push and pop', () => {
    const dispatcher = new KeyboardDispatcher();

    expect(dispatcher.currentMode).toBe('normal');

    dispatcher.pushMode('popup');
    expect(dispatcher.currentMode).toBe('popup');

    dispatcher.pushMode('permission');
    expect(dispatcher.currentMode).toBe('permission');

    dispatcher.popMode();
    expect(dispatcher.currentMode).toBe('popup');

    dispatcher.popMode();
    expect(dispatcher.currentMode).toBe('normal');
  });

  test('runs default handler when no mode or global handler matches', () => {
    const dispatcher = new KeyboardDispatcher();
    const calls: string[] = [];

    dispatcher.setDefaultHandler((event) => {
      calls.push(event.input);
      return true;
    });

    const handled = dispatcher.dispatch(createEvent('x'));

    expect(handled).toBe(true);
    expect(calls).toEqual(['x']);
  });

  test('fires single escape after timeout window', async () => {
    const dispatcher = new KeyboardDispatcher();
    let escapeCount = 0;

    dispatcher.register('global', 'escape', () => {
      escapeCount += 1;
      return true;
    });

    dispatcher.dispatch(createEvent('', { escape: true }));

    expect(escapeCount).toBe(0);
    await Bun.sleep(ESCAPE_DELAY_MS + 30);
    expect(escapeCount).toBe(1);
  });

  test('fires double escape and suppresses single escape', async () => {
    const dispatcher = new KeyboardDispatcher();
    let singleCount = 0;
    let doubleCount = 0;

    dispatcher.register('global', 'escape', () => {
      singleCount += 1;
      return true;
    });
    dispatcher.register('global', 'escape+escape', () => {
      doubleCount += 1;
      return true;
    });

    dispatcher.dispatch(createEvent('', { escape: true }));
    await Bun.sleep(30);
    dispatcher.dispatch(createEvent('', { escape: true }));

    await Bun.sleep(ESCAPE_DELAY_MS + 30);

    expect(doubleCount).toBe(1);
    expect(singleCount).toBe(0);
  });
});
