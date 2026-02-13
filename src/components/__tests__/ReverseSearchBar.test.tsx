import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { ReverseSearchBar } from '../ReverseSearchBar.js';

describe('ReverseSearchBar', () => {
  test('renders search prompt with empty query', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery=""
        currentMatch={null}
        matchIndex={-1}
        totalMatches={0}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('reverse-i-search');
    expect(frame).toContain("''");
  });

  test('renders search query in prompt', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery="backtest"
        currentMatch="backtest AAPL momentum"
        matchIndex={0}
        totalMatches={3}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('reverse-i-search');
    expect(frame).toContain('backtest');
  });

  test('renders current match text', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery="port"
        currentMatch="show portfolio"
        matchIndex={0}
        totalMatches={1}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('portfolio');
  });

  test('renders match counter when matches exist', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery="backtest"
        currentMatch="backtest AAPL momentum"
        matchIndex={1}
        totalMatches={3}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain('[2/3]');
  });

  test('does not render counter when no matches', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery="nonexistent"
        currentMatch={null}
        matchIndex={-1}
        totalMatches={0}
      />
    );
    const frame = lastFrame()!;
    expect(frame).not.toContain('[');
    expect(frame).not.toContain(']');
  });

  test('renders empty match display when no current match', () => {
    const { lastFrame } = render(
      <ReverseSearchBar
        searchQuery="xyz"
        currentMatch={null}
        matchIndex={-1}
        totalMatches={0}
      />
    );
    const frame = lastFrame()!;
    expect(frame).toContain("'xyz'");
    expect(frame).toContain(':');
  });
});
