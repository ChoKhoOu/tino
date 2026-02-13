import type { RunEvent, TokenUsage } from '@/domain/events.js';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { PermissionDecision } from '@/runtime/permission-engine.js';

export interface MockSessionRuntime {
  startRun: (input: string, signal?: AbortSignal) => AsyncGenerator<RunEvent>;
  clearHistory: () => void;
  respondToPermission: (toolId: string, allowed: boolean, alwaysAllow?: boolean) => void;
  loadFromSession: (session: unknown) => { messageCount: number };
}

export function createMockRuntime(): MockSessionRuntime {
  return {
    startRun: async function* (_input: string, _signal?: AbortSignal): AsyncGenerator<RunEvent> {
      yield { type: 'answer_start' };
      yield { type: 'answer_delta', delta: 'mock response' };
      yield {
        type: 'done',
        answer: 'mock response',
        toolCalls: [],
        iterations: 1,
        totalTime: 100,
        tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    },
    clearHistory: () => {},
    respondToPermission: (_toolId: string, _allowed: boolean, _alwaysAllow?: boolean) => {},
    loadFromSession: (_session: unknown) => ({ messageCount: 0 }),
  };
}

export interface MockPermissionEngine {
  check: (toolId: string, resource?: string) => PermissionDecision;
}

export function createMockPermissionEngine(): MockPermissionEngine {
  return {
    check: (_toolId: string, _resource?: string): PermissionDecision => 'allow',
  };
}

export function createMockHistory(count = 3): HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}-${Date.now()}`,
    query: `Test query ${i + 1}`,
    events: [],
    answer: `Test answer ${i + 1}`,
    status: 'complete' as const,
    duration: 1000 + i * 500,
    tokenUsage: {
      inputTokens: 100 + i * 50,
      outputTokens: 50 + i * 25,
      totalTokens: 150 + i * 75,
    },
  }));
}
