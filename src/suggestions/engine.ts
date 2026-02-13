import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { RunEvent } from '@/domain/events.js';
import { getContextSuggestions } from './context-rules.js';
import type { PromptSuggestion, SuggestionSkillContext } from './types.js';

export interface SuggestionEngineInput {
  events: RunEvent[];
  history: HistoryItem[];
  skillContext: SuggestionSkillContext;
}

const SKILL_SUGGESTIONS: Record<string, string> = {
  backtest: 'Optimize parameters',
  'comprehensive-research': 'Summarize the key investment risks',
  dcf: 'Run a DCF valuation',
  'factor-analysis': 'Check factor exposures by regime',
  'options-analysis': 'Stress-test Greeks under volatility shifts',
  'paper-trade': 'Paper trade this strategy',
  'live-trade': 'Review risk controls before going live',
  'strategy-generation': 'Run a backtest',
};

function getSkillSuggestion(skillContext: SuggestionSkillContext): PromptSuggestion | null {
  const skillName = skillContext.activeSkill?.trim().toLowerCase();
  if (!skillName) return null;

  const text = SKILL_SUGGESTIONS[skillName];
  if (!text) return null;

  return { text, source: 'skill', confidence: 0.98 };
}

function getHistorySuggestion(history: HistoryItem[]): PromptSuggestion | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const query = history[i]?.query?.trim();
    if (!query) continue;
    return { text: query, source: 'history', confidence: 0.55 };
  }
  return null;
}

export async function generatePromptSuggestion(input: SuggestionEngineInput): Promise<PromptSuggestion | null> {
  await Promise.resolve();

  const skillSuggestion = getSkillSuggestion(input.skillContext);
  if (skillSuggestion) return skillSuggestion;

  const contextSuggestions = getContextSuggestions(input.events);
  if (contextSuggestions.length > 0) return contextSuggestions[0] ?? null;

  return getHistorySuggestion(input.history);
}
