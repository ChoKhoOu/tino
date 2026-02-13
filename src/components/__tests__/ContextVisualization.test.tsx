import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { ContextVisualization } from '../ContextVisualization.js';

describe('ContextVisualization', () => {
  test('renders bar with token counts', () => {
    const { lastFrame } = render(
      <ContextVisualization usedTokens={67_500} maxTokens={150_000} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('45%');
    expect(frame).toContain('67,500');
    expect(frame).toContain('150,000');
  });

  test('renders filled and empty bar characters', () => {
    const { lastFrame } = render(
      <ContextVisualization usedTokens={75_000} maxTokens={150_000} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('█');
    expect(frame).toContain('░');
  });

  test('renders at 0% usage', () => {
    const { lastFrame } = render(
      <ContextVisualization usedTokens={0} maxTokens={150_000} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('0%');
    expect(frame).toContain('0 / 150,000');
  });

  test('renders at 100% usage', () => {
    const { lastFrame } = render(
      <ContextVisualization usedTokens={150_000} maxTokens={150_000} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('100%');
  });

  test('renders context header label', () => {
    const { lastFrame } = render(
      <ContextVisualization usedTokens={50_000} maxTokens={150_000} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Context');
  });
});
