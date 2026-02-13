export type SuggestionSource = 'skill' | 'context' | 'history';

export interface PromptSuggestion {
  text: string;
  source: SuggestionSource;
  confidence: number;
}

export interface SuggestionSkillContext {
  activeSkill?: string;
}
