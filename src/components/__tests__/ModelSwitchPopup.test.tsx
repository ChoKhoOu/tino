import React from 'react';
import { describe, it, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { ModelSwitchPopup } from '../ModelSwitchPopup.js';
import type { ModelOption } from '../../hooks/useModelSwitchPopup.js';

describe('ModelSwitchPopup', () => {
  const mockModels: ModelOption[] = [
    { name: 'gpt-5.2', provider: 'openai', isCurrent: true },
    { name: 'gpt-4o', provider: 'openai', isCurrent: false },
    { name: 'claude-sonnet-4-5', provider: 'anthropic', isCurrent: false },
  ];

  it('should render nothing when not open', () => {
    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={false} selectedIndex={0} models={mockModels} />,
    );
    expect(lastFrame()).toBe('');
  });

  it('should render model names when open', () => {
    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={0} models={mockModels} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('gpt-5.2');
    expect(output).toContain('gpt-4o');
    expect(output).toContain('claude-sonnet-4-5');
  });

  it('should show provider names', () => {
    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={0} models={mockModels} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('openai');
    expect(output).toContain('anthropic');
  });

  it('should mark current model with checkmark', () => {
    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={1} models={mockModels} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('✓');
  });

  it('should limit visible items to 5', () => {
    const manyModels: ModelOption[] = Array.from({ length: 10 }, (_, i) => ({
      name: `model-${i}`,
      provider: 'test',
      isCurrent: i === 0,
    }));

    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={0} models={manyModels} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('model-0');
    expect(output).toContain('model-4');
    expect(output).not.toContain('model-5');
  });

  it('should scroll to show selected item', () => {
    const manyModels: ModelOption[] = Array.from({ length: 10 }, (_, i) => ({
      name: `model-${i}`,
      provider: 'test',
      isCurrent: i === 0,
    }));

    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={7} models={manyModels} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('model-7');
    expect(output).not.toContain('model-0');
  });

  it('should render nothing when models list is empty', () => {
    const { lastFrame } = render(
      <ModelSwitchPopup isOpen={true} selectedIndex={0} models={[]} />,
    );
    expect(lastFrame()).toBe('');
  });
});
