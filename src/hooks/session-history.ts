import type { RunEvent, TokenUsage } from '@/domain/events.js';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { Session, SessionMessage, TodoItem } from '@/session/session.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function createSessionId(): string {
  return `ses_${crypto.randomUUID().slice(0, 8)}`;
}

export function extractTodosFromEvents(events: RunEvent[]): TodoItem[] | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type !== 'tool_end' || event.toolId !== 'todo_write') continue;

    try {
      const parsed = JSON.parse(event.result) as { todos?: TodoItem[] };
      if (Array.isArray(parsed.todos)) return parsed.todos;
    } catch {
      continue;
    }
  }

  return null;
}

export function summarizeTodos(todos: TodoItem[]): string {
  if (todos.length === 0) return 'No active todos.';

  const lines = todos.map((todo) => `- [${todo.status}] (${todo.priority}) ${todo.content}`);
  return [`Active todos (${todos.length}):`, ...lines].join('\n');
}

function historyToMessages(history: HistoryItem[]): SessionMessage[] {
  const messages: SessionMessage[] = [];
  for (const item of history) {
    messages.push({
      role: 'user',
      content: item.query,
      timestamp: nowIso(),
    });
    if (item.answer.trim()) {
      messages.push({
        role: 'assistant',
        content: item.answer,
        timestamp: nowIso(),
      });
    }
  }
  return messages;
}

export function buildSessionFromHistory(input: {
  id: string;
  title: string;
  systemPrompt: string;
  history: HistoryItem[];
  createdAt?: string;
  tokenUsage?: TokenUsage;
  todos?: TodoItem[];
}): Session {
  const timestamp = nowIso();
  const createdAt = input.createdAt ?? timestamp;
  const messages: SessionMessage[] = [
    {
      role: 'system',
      content: input.systemPrompt,
      timestamp,
    },
    ...historyToMessages(input.history),
  ];

  return {
    id: input.id,
    title: input.title,
    createdAt,
    updatedAt: timestamp,
    messages,
    tokenUsage: input.tokenUsage,
    todos: input.todos,
  };
}

export function sessionToHistoryItems(session: Session): HistoryItem[] {
  const items: HistoryItem[] = [];
  let pendingQuery: SessionMessage | null = null;

  for (const message of session.messages) {
    if (message.role === 'user') {
      pendingQuery = message;
      continue;
    }

    if (message.role !== 'assistant' || !pendingQuery) continue;

    items.push({
      id: `${Date.parse(message.timestamp) || Date.now()}-${items.length}`,
      query: pendingQuery.content,
      events: [],
      answer: message.content,
      status: 'complete',
      startTime: Date.parse(pendingQuery.timestamp) || Date.now(),
    });

    pendingQuery = null;
  }

  return items;
}
