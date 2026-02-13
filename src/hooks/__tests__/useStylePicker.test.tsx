import React from 'react';
import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useStylePicker } from '../useStylePicker.js';
import { KeyboardDispatcher } from '../../keyboard/dispatcher.js';
import * as KeyboardContext from '../../keyboard/use-keyboard.js';
import * as StyleRegistry from '../../styles/registry.js';

import type { StyleOption } from '../useStylePicker.js';

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

const mockStyles = [
  { name: 'default', description: 'Standard', systemPromptModifier: '', source: 'builtin' as const },
  { name: 'concise', description: 'Minimal', systemPromptModifier: 'Be concise.', source: 'builtin' as const },
  { name: 'explanatory', description: 'Educational', systemPromptModifier: 'Explain.', source: 'builtin' as const },
];

jest.spyOn(StyleRegistry, 'getAllStyles').mockReturnValue(mockStyles);
jest.spyOn(StyleRegistry, 'getActiveStyle').mockReturnValue(mockStyles[0]);
jest.spyOn(StyleRegistry, 'setActiveStyle').mockReturnValue(true);

function StateComponent() {
  const result = useStylePicker();
  return <Text>{`open:${result.isOpen}|idx:${result.selectedIndex}|count:${result.styles.length}`}</Text>;
}

function StylesComponent() {
  const result = useStylePicker();
  const current = result.styles.find((s: StyleOption) => s.isCurrent);
  return <Text>{`current:${current?.name ?? 'none'}|names:${result.styles.map((s: StyleOption) => s.name).join(',')}`}</Text>;
}

describe('useStylePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(KeyboardContext, 'useKeyboardDispatcher').mockReturnValue(mockDispatcher);
    jest.spyOn(StyleRegistry, 'getAllStyles').mockReturnValue(mockStyles);
    jest.spyOn(StyleRegistry, 'getActiveStyle').mockReturnValue(mockStyles[0]);
    jest.spyOn(StyleRegistry, 'setActiveStyle').mockReturnValue(true);
  });

  it('should start closed', () => {
    const { lastFrame } = render(<StateComponent />);
    expect(lastFrame()).toContain('open:false');
  });

  it('should provide a list of styles', () => {
    const { lastFrame } = render(<StateComponent />);
    expect(lastFrame()).toContain('count:3');
  });

  it('should mark the current style', () => {
    const { lastFrame } = render(<StylesComponent />);
    expect(lastFrame()).toContain('current:default');
  });

  it('should include all style names', () => {
    const { lastFrame } = render(<StylesComponent />);
    const output = lastFrame()!;
    expect(output).toContain('default');
    expect(output).toContain('concise');
    expect(output).toContain('explanatory');
  });

  it('should not register popup handlers when closed', () => {
    render(<StateComponent />);
    expect(mockPushMode).not.toHaveBeenCalledWith('popup');
  });
});
