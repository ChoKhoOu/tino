import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { componentTokens } from '@/theme.js';
import { GhostText } from '../GhostText.js';

describe('GhostText', () => {
  test('renders nothing when suggestion is null', () => {
    const { lastFrame } = render(<GhostText suggestion={null} />);
    expect(lastFrame()).toBe('');
  });

  test('renders suggestion text in dim color', () => {
    const rendered = GhostText({ suggestion: 'run backtest' });
    expect(rendered).not.toBeNull();
    expect(rendered?.props.color).toBe(componentTokens.ghostText.color);
    expect(rendered?.props.children).toBe('run backtest');
  });

  test('renders nothing when suggestion is an empty string', () => {
    const { lastFrame } = render(<GhostText suggestion="" />);
    expect(lastFrame()).toBe('');
  });

  test('renders the full suggestion text', () => {
    const suggestion = 'open chart for AAPL and show 1h candles';
    const { lastFrame } = render(<GhostText suggestion={suggestion} />);
    expect(lastFrame()).toContain(suggestion);
  });
});
