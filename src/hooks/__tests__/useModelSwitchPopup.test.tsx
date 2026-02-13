import React from 'react';
import { describe, it, expect, jest, beforeEach } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useModelSwitchPopup } from '../useModelSwitchPopup.js';
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

const mockSelectModel = jest.fn();

interface ModelInfo {
  name: string;
  provider: string;
  isCurrent: boolean;
}

function StateComponent({ currentModel }: { currentModel: string }) {
  const result = useModelSwitchPopup(currentModel, mockSelectModel);
  return <Text>{`open:${result.isOpen}|idx:${result.selectedIndex}|count:${result.models.length}`}</Text>;
}

function ModelsComponent({ currentModel }: { currentModel: string }) {
  const result = useModelSwitchPopup(currentModel, mockSelectModel);
  const current = result.models.find((m: ModelInfo) => m.isCurrent);
  const providers = [...new Set(result.models.map((m: ModelInfo) => m.provider))];
  return <Text>{`current:${current?.name ?? 'none'}|providers:${providers.join(',')}`}</Text>;
}

describe('useModelSwitchPopup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should start closed', () => {
    const { lastFrame } = render(<StateComponent currentModel="gpt-5.2" />);
    expect(lastFrame()).toContain('open:false');
  });

  it('should provide a list of models', () => {
    const { lastFrame } = render(<StateComponent currentModel="gpt-5.2" />);
    const output = lastFrame()!;
    expect(output).toMatch(/count:\d+/);
    expect(output).not.toContain('count:0');
  });

  it('should mark the current model', () => {
    const { lastFrame } = render(<ModelsComponent currentModel="gpt-5.2" />);
    expect(lastFrame()).toContain('current:gpt-5.2');
  });

  it('should register alt+p handler in normal mode', () => {
    render(<StateComponent currentModel="gpt-5.2" />);
    expect(mockRegister).toHaveBeenCalledWith('normal', 'alt+p', expect.any(Function));
  });

  it('should include models from multiple providers', () => {
    const { lastFrame } = render(<ModelsComponent currentModel="gpt-5.2" />);
    const output = lastFrame()!;
    expect(output).toContain('openai');
    expect(output).toContain('anthropic');
    expect(output).toContain('google');
  });
});
