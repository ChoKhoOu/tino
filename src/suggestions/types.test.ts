import { describe, expect, test } from 'bun:test';
import type {
  PromptSuggestion,
  SuggestionSource,
  SuggestionSkillContext,
} from './types.js';

describe('suggestion types', () => {
  test('supports all suggestion sources', () => {
    const sources: SuggestionSource[] = ['skill', 'context', 'history'];
    expect(sources).toHaveLength(3);
  });

  test('represents a prompt suggestion object', () => {
    const suggestion: PromptSuggestion = {
      text: 'Analyze the price trend',
      source: 'context',
      confidence: 0.9,
    };

    expect(suggestion.text).toBe('Analyze the price trend');
    expect(suggestion.source).toBe('context');
    expect(suggestion.confidence).toBeGreaterThan(0);
  });

  test('represents optional skill context', () => {
    const ctx: SuggestionSkillContext = {
      activeSkill: 'backtest',
    };

    expect(ctx.activeSkill).toBe('backtest');
  });
});
