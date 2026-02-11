// Spike: validate plotext ANSI output is compatible with Ink <Text> rendering
// Proof-of-concept — NOT production code
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text, Box } from 'ink';

// Captured from: plotext candlestick, dark theme, plot_size(80, 20)
// 256-color ANSI: 38;5;N (fg), 48;5;N (bg), Unicode box-drawing chars
const PLOTEXT_ANSI_SAMPLE = [
  '\x1b[48;5;0m\x1b[38;5;3m115.0\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2502\x1b[0m\x1b[48;5;0m  \x1b[38;5;1m\u2588\x1b[0m\x1b[48;5;0m\x1b[38;5;3m\u2502\x1b[0m',
  '\x1b[48;5;0m\x1b[38;5;3m106.5\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2588\x1b[0m\x1b[48;5;0m  \x1b[38;5;1m\u2502\x1b[0m\x1b[48;5;0m\x1b[38;5;3m\u2502\x1b[0m',
  '\x1b[48;5;0m\x1b[38;5;3m 98.0\u2524\x1b[0m\x1b[48;5;0m  \x1b[38;5;2m\u2502\x1b[0m\x1b[48;5;0m       \x1b[38;5;3m\u2502\x1b[0m',
].join('\n');

describe('plotext ANSI rendering in Ink (spike)', () => {
  test('ANSI string renders inside <Text> without crashing', () => {
    const { lastFrame } = render(
      React.createElement(Box, null, React.createElement(Text, null, PLOTEXT_ANSI_SAMPLE)),
    );

    const frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain('\u2524');
    expect(frame).toContain('\u2502');
    expect(frame).toContain('\u2588');
  });

  test('ANSI string preserves numeric labels', () => {
    const { lastFrame } = render(
      React.createElement(Box, null, React.createElement(Text, null, PLOTEXT_ANSI_SAMPLE)),
    );

    const frame = lastFrame();
    expect(frame).toContain('115.0');
    expect(frame).toContain('106.5');
    expect(frame).toContain('98.0');
  });

  test('multi-line ANSI chart renders with title', () => {
    const { lastFrame } = render(
      React.createElement(
        Box,
        { flexDirection: 'column' },
        React.createElement(Text, { bold: true }, 'Candlestick Chart'),
        React.createElement(Text, null, PLOTEXT_ANSI_SAMPLE),
      ),
    );

    const frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain('Candlestick Chart');
    expect(frame).toContain('115.0');
  });

  test('background color ANSI codes render without garbling', () => {
    const borderLine =
      '\x1b[48;5;0m     \x1b[0m\x1b[48;5;0m\x1b[38;5;3m\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\x1b[0m';

    const { lastFrame } = render(
      React.createElement(Box, null, React.createElement(Text, null, borderLine)),
    );

    const frame = lastFrame();
    expect(frame).toBeDefined();
    expect(frame).toContain('\u250c');
    expect(frame).toContain('\u2510');
  });
});
