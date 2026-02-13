import React from 'react';
import { describe, it, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { StylePicker } from '../StylePicker.js';
import type { StyleOption } from '../../hooks/useStylePicker.js';

describe('StylePicker', () => {
  const mockStyles: StyleOption[] = [
    { name: 'default', description: 'Standard engineering responses', isCurrent: true },
    { name: 'concise', description: 'Minimal, direct answers', isCurrent: false },
    { name: 'explanatory', description: 'Educational with reasoning', isCurrent: false },
  ];

  it('should render nothing when not open', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={false} selectedIndex={0} styles={mockStyles} />,
    );
    expect(lastFrame()).toBe('');
  });

  it('should render style names when open', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={0} styles={mockStyles} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('default');
    expect(output).toContain('concise');
    expect(output).toContain('explanatory');
  });

  it('should show descriptions', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={0} styles={mockStyles} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Standard engineering responses');
    expect(output).toContain('Minimal, direct answers');
  });

  it('should mark current style with checkmark', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={1} styles={mockStyles} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('✓');
  });

  it('should limit visible items to 5', () => {
    const manyStyles: StyleOption[] = Array.from({ length: 8 }, (_, i) => ({
      name: `style-${i}`,
      description: `Description ${i}`,
      isCurrent: i === 0,
    }));

    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={0} styles={manyStyles} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('style-0');
    expect(output).toContain('style-4');
    expect(output).not.toContain('style-5');
  });

  it('should scroll to show selected item', () => {
    const manyStyles: StyleOption[] = Array.from({ length: 8 }, (_, i) => ({
      name: `style-${i}`,
      description: `Description ${i}`,
      isCurrent: i === 0,
    }));

    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={7} styles={manyStyles} />,
    );
    const output = lastFrame()!;
    expect(output).toContain('style-7');
    expect(output).not.toContain('style-0');
  });

  it('should render nothing when styles list is empty', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={0} styles={[]} />,
    );
    expect(lastFrame()).toBe('');
  });

  it('should show title', () => {
    const { lastFrame } = render(
      <StylePicker isOpen={true} selectedIndex={0} styles={mockStyles} />,
    );
    expect(lastFrame()!).toContain('Output Style');
  });
});
