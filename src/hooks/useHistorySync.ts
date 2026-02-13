import { useEffect, useRef } from 'react';
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
  // Keep a ref to runState to avoid re-triggering effects on every reducer dispatch.
  // We trigger sync only on meaningful state transitions via stable primitive deps.
  const runStateRef = useRef(runState);
  runStateRef.current = runState;

  const eventCount = runState.events.length;
  const status = runState.status;
  const answer = runState.answer;
  const error = runState.error;

  useEffect(() => {
    const rs = runStateRef.current;
    if (status === 'idle' && eventCount === 0) return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.status !== 'processing') return prev;
      const displayEvents = buildDisplayEvents(rs.events);
      const activeToolId = findActiveToolId(rs.events);
      const isDone = status === 'done';
      const updated: HistoryItem = {
        ...last, events: displayEvents, activeToolId,
        answer, status: isDone ? 'complete' : last.status,
      };
      if (isDone) {
        const doneEvt = rs.events.find((e) => e.type === 'done') as DoneEvent | undefined;
        if (doneEvt) { updated.duration = doneEvt.totalTime; updated.tokenUsage = doneEvt.tokenUsage; }
      }
      if (error) { updated.status = 'error'; setError(error); }
      return [...prev.slice(0, -1), updated];
    });
  }, [status, eventCount, answer, error, setHistory, setError]);

  useEffect(() => {
    if (status === 'done' && answer) updateAgentResponse(answer);
  }, [status, answer, updateAgentResponse]);
}
