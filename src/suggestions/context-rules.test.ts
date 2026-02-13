import { describe, expect, test } from 'bun:test';
import type { RunEvent } from '@/domain/events.js';
import { getContextSuggestions } from './context-rules.js';

function end(toolId: string): RunEvent {
  return { type: 'tool_end', toolId, result: '{}', duration: 10 };
}

describe('getContextSuggestions', () => {
  test('maps market_data usage to market suggestions', () => {
    const suggestions = getContextSuggestions([end('market_data')]);
    const texts = suggestions.map((s) => s.text);

    expect(texts).toContain('Analyze the price trend');
    expect(texts).toContain('Compare with sector peers');
  });

  test('maps trading_sim usage to backtest follow-ups', () => {
    const suggestions = getContextSuggestions([end('trading_sim')]);
    const texts = suggestions.map((s) => s.text);

    expect(texts).toContain('Optimize parameters');
    expect(texts).toContain('Try different timeframe');
  });

  test('maps strategy_lab usage to strategy next steps', () => {
    const suggestions = getContextSuggestions([end('strategy_lab')]);
    const texts = suggestions.map((s) => s.text);

    expect(texts).toContain('Run a backtest');
    expect(texts).toContain('Paper trade this strategy');
  });

  test('maps fundamentals usage to valuation suggestions', () => {
    const suggestions = getContextSuggestions([end('fundamentals')]);
    const texts = suggestions.map((s) => s.text);

    expect(texts).toContain('Run a DCF valuation');
    expect(texts).toContain('Compare with competitors');
  });

  test('returns error recovery suggestions when any error appears', () => {
    const suggestions = getContextSuggestions([
      { type: 'tool_error', toolId: 'market_data', error: 'timeout' },
    ]);
    const texts = suggestions.map((s) => s.text);

    expect(texts).toContain('Try a different approach');
    expect(texts).toContain('Check the error details');
  });
});
