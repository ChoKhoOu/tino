import type { RunEvent } from '@/domain/events.js';
import type { DisplayEvent } from '@/components/AgentEventView.js';
import type { WorkingState } from '@/components/WorkingIndicator.js';

// Pairs tool_start with tool_end/tool_error into unified DisplayEvent entries
export function buildDisplayEvents(events: RunEvent[]): DisplayEvent[] {
  const display: DisplayEvent[] = [];
  const activeTools = new Map<string, number>();

  for (const event of events) {
    switch (event.type) {
      case 'thinking':
        display.push({ id: `thinking-${display.length}`, event, completed: true });
        break;
      case 'tool_start': {
        const id = `tool-${event.toolId}-${display.length}`;
        display.push({ id, event, completed: false });
        activeTools.set(event.toolId, display.length - 1);
        break;
      }
      case 'tool_end': {
        const idx = activeTools.get(event.toolId);
        if (idx !== undefined) {
          display[idx] = { ...display[idx], completed: true, endEvent: event };
          activeTools.delete(event.toolId);
        }
        break;
      }
      case 'tool_error': {
        const idx = activeTools.get(event.toolId);
        if (idx !== undefined) {
          display[idx] = { ...display[idx], completed: true, endEvent: event };
          activeTools.delete(event.toolId);
        } else {
          display.push({ id: `error-${display.length}`, event, completed: true });
        }
        break;
      }
      case 'context_cleared':
        display.push({ id: `ctx-${display.length}`, event, completed: true });
        break;
      default:
        break;
    }
  }

  return display;
}

export function findActiveToolId(events: RunEvent[]): string | undefined {
  const started = new Set<string>();
  const finished = new Set<string>();

  for (const e of events) {
    if (e.type === 'tool_start') started.add(e.toolId);
    if (e.type === 'tool_end' || e.type === 'tool_error') finished.add(e.toolId);
  }

  for (const id of started) {
    if (!finished.has(id)) return `tool-${id}-0`;
  }
  return undefined;
}

export function deriveWorkingState(runState: { status: string; events: RunEvent[] }): WorkingState {
  if (runState.status === 'idle' || runState.status === 'done') return { status: 'idle' };

  const lastEvent = runState.events[runState.events.length - 1];
  if (!lastEvent) return { status: 'thinking' };

  if (lastEvent.type === 'tool_start') return { status: 'tool', toolName: lastEvent.toolId };
  if (lastEvent.type === 'answer_start') return { status: 'answering', startTime: Date.now() };
  return { status: 'thinking' };
}
