import { describe, expect, test } from 'bun:test';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { RunEvent } from '@/domain/events.js';
import { generatePromptSuggestion } from './engine.js';

function completeHistory(query: string): HistoryItem {
  return {
    id: `${query}-id`,
    query,
    events: [],
    answer: 'done',
    status: 'complete',
  };
}

function end(toolId: string): RunEvent {
  return { type: 'tool_end', toolId, result: '{}', duration: 5 };
}

describe('generatePromptSuggestion', () => {
  test('prefers active skill suggestion over context and history', async () => {
    const suggestion = await generatePromptSuggestion({
      events: [end('market_data')],
      history: [completeHistory('Backtest AAPL')],
      skillContext: { activeSkill: 'backtest' },
    });

    expect(suggestion?.source).toBe('skill');
    expect(suggestion?.text.length).toBeGreaterThan(0);
  });

  test('uses context suggestion when no active skill exists', async () => {
    const suggestion = await generatePromptSuggestion({
      events: [end('trading_sim')],
      history: [],
      skillContext: {},
    });

    expect(suggestion?.source).toBe('context');
    expect(suggestion).not.toBeNull();
    expect(['Optimize parameters', 'Try different timeframe']).toContain(suggestion!.text);
  });

  test('falls back to history suggestion when no skill or context match', async () => {
    const suggestion = await generatePromptSuggestion({
      events: [{ type: 'thinking', message: 'done' }],
      history: [completeHistory('Compare NVDA and AMD valuation metrics')],
      skillContext: {},
    });

    expect(suggestion?.source).toBe('history');
    expect(suggestion?.text).toBe('Compare NVDA and AMD valuation metrics');
  });

  test('returns null when there is no suggestion source', async () => {
    const suggestion = await generatePromptSuggestion({
      events: [{ type: 'thinking', message: 'no-op' }],
      history: [],
      skillContext: {},
    });

    expect(suggestion).toBeNull();
  });
});
