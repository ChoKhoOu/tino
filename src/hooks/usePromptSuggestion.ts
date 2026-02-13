import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { RunState } from './useSessionRunner.js';
import { generatePromptSuggestion } from '@/suggestions/engine.js';

export interface UsePromptSuggestionOptions {
  runState: Pick<RunState, 'status' | 'events'>;
  history: HistoryItem[];
  input: string;
  activeSkill?: string;
}

export interface UsePromptSuggestionResult {
  suggestion: string | null;
  acceptSuggestion: () => string | null;
  dismissSuggestion: () => void;
}

export function usePromptSuggestion({
  runState,
  history,
  input,
  activeSkill,
}: UsePromptSuggestionOptions): UsePromptSuggestionResult {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const lastGeneratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (input.length > 0) {
      setSuggestion(null);
    }
  }, [input]);

  useEffect(() => {
    if (runState.status !== 'done') return;

    const doneCount = runState.events.filter((event) => event.type === 'done').length;
    if (doneCount === 0) return;

    const generationKey = `${doneCount}:${runState.events.length}`;
    if (lastGeneratedKeyRef.current === generationKey) return;
    lastGeneratedKeyRef.current = generationKey;

    let cancelled = false;

    void generatePromptSuggestion({
      events: runState.events,
      history,
      skillContext: { activeSkill },
    }).then((nextSuggestion) => {
      if (cancelled) return;
      if (!nextSuggestion) {
        setSuggestion(null);
        return;
      }
      setSuggestion(nextSuggestion.text);
    });

    return () => {
      cancelled = true;
    };
  }, [activeSkill, history, runState.events, runState.status]);

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return null;
    const accepted = suggestion;
    setSuggestion(null);
    return accepted;
  }, [suggestion]);

  const dismissSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  return { suggestion, acceptSuggestion, dismissSuggestion };
}
