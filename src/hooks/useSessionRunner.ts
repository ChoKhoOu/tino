import { useReducer, useCallback, useRef } from 'react';
import type { SessionRuntime } from '@/runtime/session-runtime.js';
import type {
  RunEvent,
  DoneEvent,
  TokenUsage,
  ToolCallRecord,
} from '@/domain/events.js';

// ============================================================================
// State
// ============================================================================

export type RunStatus = 'idle' | 'running' | 'permission_pending' | 'done';

export interface PendingPermission {
  toolId: string;
  resource: string;
  args?: Record<string, unknown>;
}

export interface RunState {
  events: RunEvent[];
  status: RunStatus;
  answer: string;
  pendingPermission?: PendingPermission;
  error?: string;
  tokenUsage?: TokenUsage;
  totalTime?: number;
  toolCalls: ToolCallRecord[];
}

const initialState: RunState = {
  events: [],
  status: 'idle',
  answer: '',
  toolCalls: [],
};

// ============================================================================
// Reducer
// ============================================================================

type RunAction =
  | { type: 'START_RUN' }
  | { type: 'EVENT'; event: RunEvent }
  | { type: 'CANCEL' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'START_RUN':
      return { ...initialState, status: 'running' };

    case 'EVENT': {
      const event = action.event;
      const events = [...state.events, event];

      switch (event.type) {
        case 'permission_request':
          return {
            ...state,
            events,
            status: 'permission_pending',
            pendingPermission: { toolId: event.toolId, resource: event.resource, args: event.args },
          };
        case 'permission_response':
          return {
            ...state,
            events,
            status: 'running',
            pendingPermission: undefined,
          };
        case 'answer_chunk':
          return { ...state, events, answer: state.answer + event.content };
        case 'answer_delta':
          return { ...state, events, answer: state.answer + event.delta };
        case 'done': {
          const done = event as DoneEvent;
          return {
            ...state,
            events,
            status: 'done',
            answer: done.answer || state.answer,
            tokenUsage: done.tokenUsage,
            totalTime: done.totalTime,
            toolCalls: done.toolCalls,
          };
        }
        default: {
          const status = state.status === 'permission_pending' ? 'running' as const : state.status;
          return { ...state, events, status, pendingPermission: status === 'running' ? undefined : state.pendingPermission };
        }
      }
    }

    case 'CANCEL':
      return { ...state, status: 'idle' };

    case 'ERROR':
      return { ...state, status: 'idle', error: action.error };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSessionRunnerResult {
  state: RunState;
  startRun: (input: string) => Promise<void>;
  cancel: () => void;
  respondToPermission: (toolId: string, allowed: boolean, alwaysAllow?: boolean) => void;
  reset: () => void;
}

export function useSessionRunner(
  runtime: SessionRuntime,
): UseSessionRunnerResult {
  const [state, dispatch] = useReducer(runReducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  const startRun = useCallback(
    async (input: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: 'START_RUN' });

      try {
        const generator = runtime.startRun(input, controller.signal);

        for await (const event of generator) {
          if (controller.signal.aborted) break;
          dispatch({ type: 'EVENT', event });
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          dispatch({ type: 'CANCEL' });
        } else {
          dispatch({ type: 'ERROR', error: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [runtime],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'CANCEL' });
  }, []);

  const respondToPermission = useCallback((toolId: string, allowed: boolean, alwaysAllow?: boolean) => {
    runtime.respondToPermission(toolId, allowed, alwaysAllow);
  }, [runtime]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  return { state, startRun, cancel, respondToPermission, reset };
}
