import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { AnsiChart } from '../AnsiChart.js';

// Captured from: plotext candlestick, dark theme, plot_size(80, 20)
const PLOTEXT_ANSI_SAMPLE = [
  '\x1b[48;5;0m\x1b[38;5;3m115.0\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2502\x1b[0m\x1b[48;5;0m  \x1b[38;5;1m\u2588\x1b[0m\x1b[48;5;0m\x1b[38;5;3m\u2502\x1b[0m',
  '\x1b[48;5;0m\x1b[38;5;3m106.5\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2588\x1b[0m\x1b[48;5;0m  \x1b[38;5;1m\u2502\x1b[0m\x1b[48;5;0m\x1b[38;5;3m\u2502\x1b[0m',
  '\x1b[48;5;0m\x1b[38;5;3m 98.0\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2502\x1b[0m\x1b[48;5;0m       \x1b[38;5;3m\u2502\x1b[0m',
].join('\n');

describe('AnsiChart', () => {
  test('renders ANSI string', () => {
    const { lastFrame } = render(<AnsiChart chart={PLOTEXT_ANSI_SAMPLE} />);
    const frame = lastFrame();
    
    expect(frame).toBeDefined();
    expect(frame).toContain('115.0');
    expect(frame).toContain('106.5');
    expect(frame).toContain('98.0');
  });

  test('renders title when provided', () => {
    const { lastFrame } = render(
      <AnsiChart chart={PLOTEXT_ANSI_SAMPLE} title="Test Chart" />
    );
    const frame = lastFrame();
    
    expect(frame).toContain('Test Chart');
    expect(frame).toContain('115.0');
  });

  test('renders nothing when chart string is empty', () => {
    const { lastFrame } = render(<AnsiChart chart="" />);
    const frame = lastFrame();
    
    expect(frame).not.toContain('115.0');
  });
});
