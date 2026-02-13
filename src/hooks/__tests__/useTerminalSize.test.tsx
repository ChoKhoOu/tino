import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useTerminalSize } from '../useTerminalSize.js';

describe('useTerminalSize', () => {
  test('returns terminal dimensions', () => {
    const TestComponent = () => {
      const { rows, columns } = useTerminalSize();
      return <Text>{`rows:${rows},cols:${columns}`}</Text>;
    };

    const { lastFrame } = render(<TestComponent />);
    expect(lastFrame()).toMatch(/rows:\d+,cols:\d+/);
  });
});
