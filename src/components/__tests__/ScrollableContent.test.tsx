import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { ScrollableContent } from '../ScrollableContent.js';

describe('ScrollableContent', () => {
  test('renders children', () => {
    const { lastFrame } = render(
      <ScrollableContent height={10}>
        <Text>Hello</Text>
      </ScrollableContent>
    );
    expect(lastFrame()).toContain('Hello');
  });
});
