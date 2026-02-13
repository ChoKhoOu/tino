import React from 'react';
import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useSlashCommandMenu } from '../useSlashCommandMenu.js';
import { KeyboardDispatcher } from '../../keyboard/dispatcher.js';
import * as KeyboardContext from '../../keyboard/use-keyboard.js';

// Mock the keyboard hooks
const mockRegister = jest.fn(() => jest.fn()); // Return cleanup function
const mockPushMode = jest.fn();
const mockPopMode = jest.fn();

const mockDispatcher = {
  register: mockRegister,
  pushMode: mockPushMode,
  popMode: mockPopMode,
  dispatch: jest.fn(),
  dispose: jest.fn(),
} as unknown as KeyboardDispatcher;

// Mock useKeyboardDispatcher to return our mock
jest.spyOn(KeyboardContext, 'useKeyboardDispatcher').mockReturnValue(mockDispatcher);

function TestComponent({ input }: { input: string }) {
  const { isOpen, selectedIndex, filteredCommands } = useSlashCommandMenu(
    input,
    jest.fn(),
    jest.fn()
  );

  return (
    <Text>
      {JSON.stringify({ isOpen, selectedIndex, filteredCommands })}
    </Text>
  );
}

describe('useSlashCommandMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be closed when input does not start with /', () => {
    const { lastFrame } = render(<TestComponent input="hello" />);
    const result = JSON.parse(lastFrame()!);
    expect(result.isOpen).toBe(false);
  });

  it('should be open when input starts with /', () => {
    const { lastFrame } = render(<TestComponent input="/" />);
    const output = lastFrame()!;
    expect(output).toContain('"isOpen":true');
  });

  it('should filter commands based on input', () => {
    const { lastFrame } = render(<TestComponent input="/he" />);
    const output = lastFrame()!;
    expect(output).toContain('"command":"/help"');
    expect(output).not.toContain('"command":"/model"');
  });

  it('should push popup mode when open', () => {
    render(<TestComponent input="/" />);
    expect(mockPushMode).toHaveBeenCalledWith('popup');
  });

  it('should pop popup mode when closed', () => {
    const { rerender } = render(<TestComponent input="/" />);
    expect(mockPushMode).toHaveBeenCalledWith('popup');
    
    rerender(<TestComponent input="hello" />);
    expect(mockPopMode).toHaveBeenCalled();
  });

  it('should register keyboard handlers when open', () => {
    render(<TestComponent input="/" />);
    expect(mockRegister).toHaveBeenCalledWith('popup', 'up', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('popup', 'down', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('popup', 'return', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('popup', 'escape', expect.any(Function));
  });
});
