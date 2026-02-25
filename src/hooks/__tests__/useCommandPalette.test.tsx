import React from 'react';
import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useCommandPalette } from '../useCommandPalette.js';
import { KeyboardDispatcher } from '../../keyboard/dispatcher.js';
import * as KeyboardContext from '../../keyboard/use-keyboard.js';

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

const mockOnCommandSelect = jest.fn();

function TestComponent({ query: initialQuery }: { query?: string }) {
  const result = useCommandPalette(mockOnCommandSelect);
  // Expose state for assertions
  return (
    <Text>
      {`open:${result.isOpen}|idx:${result.selectedIndex}|count:${result.items.length}|recents:${result.recentCommands.length}`}
    </Text>
  );
}

function ItemsComponent() {
  const result = useCommandPalette(mockOnCommandSelect);
  const categories = [...new Set(result.items.map(item => item.category))];
  return <Text>{`categories:${categories.join(',')}|count:${result.items.length}`}</Text>;
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start closed with index 0', () => {
    const { lastFrame } = render(<TestComponent />);
    expect(lastFrame()).toContain('open:false');
    expect(lastFrame()).toContain('idx:0');
  });

  it('should provide predefined commands plus slash commands', () => {
    const { lastFrame } = render(<TestComponent />);
    const output = lastFrame()!;
    expect(output).toMatch(/count:\d+/);
    expect(output).not.toContain('count:0');
  });

  it('should include multiple categories', () => {
    const { lastFrame } = render(<ItemsComponent />);
    const output = lastFrame()!;
    expect(output).toContain('Market');
    expect(output).toContain('Backtest');
    expect(output).toContain('System');
  });

  it('should register ctrl+p handler in normal mode', () => {
    render(<TestComponent />);
    expect(mockRegister).toHaveBeenCalledWith('normal', 'ctrl+p', expect.any(Function));
  });

  it('should have at least 10 predefined commands', () => {
    const { lastFrame } = render(<TestComponent />);
    const output = lastFrame()!;
    const match = output.match(/count:(\d+)/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });
});
