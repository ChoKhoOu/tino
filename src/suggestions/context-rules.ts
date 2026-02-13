import type { RunEvent } from '@/domain/events.js';
import type { PromptSuggestion } from './types.js';

type Rule = {
  toolId: string;
  suggestions: string[];
};

const TOOL_RULES: Rule[] = [
  {
    toolId: 'market_data',
    suggestions: ['Analyze the price trend', 'Compare with sector peers'],
  },
  {
    toolId: 'trading_sim',
    suggestions: ['Optimize parameters', 'Try different timeframe'],
  },
  {
    toolId: 'strategy_lab',
    suggestions: ['Run a backtest', 'Paper trade this strategy'],
  },
  {
    toolId: 'fundamentals',
    suggestions: ['Run a DCF valuation', 'Compare with competitors'],
  },
];

const ERROR_SUGGESTIONS = ['Try a different approach', 'Check the error details'];

function toSuggestions(texts: string[]): PromptSuggestion[] {
  return texts.map((text, index) => ({
    text,
    source: 'context',
    confidence: 0.9 - index * 0.1,
  }));
}

export function getContextSuggestions(events: RunEvent[]): PromptSuggestion[] {
  if (events.some((event) => event.type === 'tool_error')) {
    return toSuggestions(ERROR_SUGGESTIONS);
  }

  const toolEndEvents = events.filter((event): event is Extract<RunEvent, { type: 'tool_end' }> => {
    return event.type === 'tool_end';
  });

  for (let i = toolEndEvents.length - 1; i >= 0; i -= 1) {
    const rule = TOOL_RULES.find((candidate) => candidate.toolId === toolEndEvents[i].toolId);
    if (rule) {
      return toSuggestions(rule.suggestions);
    }
  }

  return [];
}
