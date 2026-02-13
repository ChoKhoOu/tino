import { useEffect } from 'react';
import type { RunState } from './useSessionRunner.js';
import type { HistoryItem } from '../components/index.js';
import type { DoneEvent } from '../domain/events.js';
import { buildDisplayEvents, findActiveToolId } from './useDisplayEvents.js';

export function useHistorySync(
  runState: RunState,
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  setError: (error: string | null) => void,
  updateAgentResponse: (response: string) => void
) {
  useEffect(() => {
    if (runState.status === 'idle' && runState.events.length === 0) return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      const displayEvents = buildDisplayEvents(runState.events);
      const activeToolId = findActiveToolId(runState.events);
      const isDone = runState.status === 'done';
      const updated: HistoryItem = {
        ...last, events: displayEvents, activeToolId,
        answer: runState.answer, status: isDone ? 'complete' : last.status,
      };
      if (isDone) {
        const doneEvt = runState.events.find((e) => e.type === 'done') as DoneEvent | undefined;
        if (doneEvt) { updated.duration = doneEvt.totalTime; updated.tokenUsage = doneEvt.tokenUsage; }
      }
      if (runState.error) { updated.status = 'error'; setError(runState.error); }
      return [...prev.slice(0, -1), updated];
    });
  }, [runState, setHistory, setError]);

  useEffect(() => {
    if (runState.status === 'done' && runState.answer) updateAgentResponse(runState.answer);
  }, [runState.status, runState.answer, updateAgentResponse]);
}
