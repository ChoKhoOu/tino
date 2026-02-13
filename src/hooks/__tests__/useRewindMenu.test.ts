import React from 'react';
import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useRewindMenu } from '../useRewindMenu.js';
import type { RewindAction } from '../useRewindMenu.js';
import { KeyboardDispatcher } from '../../keyboard/dispatcher.js';
import * as KeyboardContext from '../../keyboard/use-keyboard.js';
import type { HistoryItem } from '../../components/HistoryItemView.js';

const mockRegister = jest.fn(() => jest.fn());
const mockPushMode = jest.fn();
const mockPopMode = jest.fn();

const mockDispatcher = {
  register: mockRegister,
  pushMode: mockPushMode,
  popMode: mockPopMode,
  dispatch: jest.fn(),
  dispose: jest.fn(),
} as unknown as KeyboardDispatcher;

jest.spyOn(KeyboardContext, 'useKeyboardDispatcher').mockReturnValue(mockDispatcher);

function buildTurns(): HistoryItem[] {
  return [
    { id: 'a', query: 'First', events: [], answer: 'A', status: 'complete' },
    { id: 'b', query: 'Second', events: [], answer: 'B', status: 'complete' },
  ];
}

function renderHarness(onAction = jest.fn<(turn: HistoryItem, action: RewindAction) => void>()) {
  return render(React.createElement(TestHarness, { turns: buildTurns(), onAction }) as React.ReactElement);
}

function TestHarness({
  turns,
  onAction,
}: {
  turns: HistoryItem[];
  onAction: (turn: HistoryItem, action: RewindAction) => void;
}) {
  const menu = useRewindMenu(turns, onAction);
  return React.createElement(
    Text,
    null,
    `open:${menu.isOpen}|idx:${menu.selectedIndex}|sub:${menu.subMenuOpen}|subIdx:${menu.subMenuIndex}|count:${menu.turns.length}`,
  );
}

describe('useRewindMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(KeyboardContext, 'useKeyboardDispatcher').mockReturnValue(mockDispatcher);
  });

  it('starts closed with turns loaded', () => {
    const { lastFrame } = renderHarness();
    const output = lastFrame()!;
    expect(output).toContain('open:false');
    expect(output).toContain('sub:false');
    expect(output).toContain('count:2');
  });

  it('registers global double-escape handler', () => {
    renderHarness();
    expect(mockRegister).toHaveBeenCalledWith('global', 'escape+escape', expect.any(Function));
  });

  it('opens menu when double-escape handler fires', () => {
    const { rerender, lastFrame } = renderHarness();
    const calls = mockRegister.mock.calls as Array<any>;
    const rewindReg = calls.find(
      (call: any[]) => call[0] === 'global' && call[1] === 'escape+escape',
    );
    expect(rewindReg).toBeDefined();

    rewindReg[2]({ input: '', key: {} });
    rerender(React.createElement(TestHarness, { turns: buildTurns(), onAction: jest.fn() }) as React.ReactElement);

    expect(lastFrame()).toContain('open:true');
    expect(mockPushMode).toHaveBeenCalledWith('rewind');
  });

  it('selects submenu option with Enter and closes on Cancel', () => {
    const onAction = jest.fn();
    const element = React.createElement(TestHarness, { turns: buildTurns(), onAction }) as React.ReactElement;
    const { rerender } = render(element);

    const byPattern = (pattern: string): ((event?: unknown) => boolean | void) => {
      const calls = mockRegister.mock.calls as Array<any>;
      const call = calls.find(
        (entry: any[]) => entry[1] === pattern,
      );
      return call?.[2] ?? (() => false);
    };

    byPattern('escape+escape')?.();
    rerender(element);
    byPattern('return')?.();
    byPattern('down')?.();
    byPattern('down')?.();
    byPattern('down')?.();
    byPattern('down')?.();
    byPattern('return')?.();
    rerender(element);

    expect(onAction).not.toHaveBeenCalled();
    expect(mockPopMode).toHaveBeenCalled();
  });
});
