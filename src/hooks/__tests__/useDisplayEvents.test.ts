import { describe, test, expect } from 'bun:test';
import { buildDisplayEvents, findActiveToolId, deriveWorkingState } from '../useDisplayEvents.js';
import type { RunEvent } from '@/domain/events.js';

describe('buildDisplayEvents', () => {
  test('returns empty array for no events', () => {
    expect(buildDisplayEvents([])).toEqual([]);
  });

  test('maps thinking event to completed display event', () => {
    const events: RunEvent[] = [{ type: 'thinking', message: 'analyzing' }];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].event).toEqual(events[0]);
    expect(result[0].completed).toBe(true);
    expect(result[0].id).toContain('thinking');
  });

  test('maps tool_start to incomplete display event', () => {
    const events: RunEvent[] = [{ type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' } }];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(false);
  });

  test('pairs tool_start with tool_end', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' } },
      { type: 'tool_end', toolId: 'market_data', result: '{}', duration: 100 },
    ];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(true);
    expect(result[0].endEvent).toEqual(events[1]);
  });

  test('pairs tool_start with tool_error', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'web_search', args: { query: 'test' } },
      { type: 'tool_error', toolId: 'web_search', error: 'timeout' },
    ];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(true);
    expect(result[0].endEvent).toEqual(events[1]);
  });

  test('creates standalone error if no matching tool_start', () => {
    const events: RunEvent[] = [
      { type: 'tool_error', toolId: 'orphan_tool', error: 'no start' },
    ];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(true);
    expect(result[0].id).toContain('error');
  });

  test('maps context_cleared event', () => {
    const events: RunEvent[] = [{ type: 'context_cleared', clearedCount: 5, keptCount: 3 }];
    const result = buildDisplayEvents(events);

    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(true);
    expect(result[0].id).toContain('ctx');
  });

  test('ignores answer_start and done events', () => {
    const events: RunEvent[] = [
      { type: 'answer_start' },
      { type: 'done', answer: 'hello', toolCalls: [], iterations: 1, totalTime: 100 },
    ];
    const result = buildDisplayEvents(events);
    expect(result).toHaveLength(0);
  });
});

describe('findActiveToolId', () => {
  test('returns undefined for empty events', () => {
    expect(findActiveToolId([])).toBeUndefined();
  });

  test('returns undefined when all tools are finished', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'market_data', args: {} },
      { type: 'tool_end', toolId: 'market_data', result: '{}', duration: 100 },
    ];
    expect(findActiveToolId(events)).toBeUndefined();
  });

  test('returns active tool id when tool_start without end', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'web_search', args: {} },
    ];
    expect(findActiveToolId(events)).toBe('tool-web_search-0');
  });

  test('returns active tool when one is still running among finished', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'market_data', args: {} },
      { type: 'tool_end', toolId: 'market_data', result: '{}', duration: 50 },
      { type: 'tool_start', toolId: 'quant_compute', args: {} },
    ];
    expect(findActiveToolId(events)).toBe('tool-quant_compute-0');
  });

  test('treats tool_error as finished', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'market_data', args: {} },
      { type: 'tool_error', toolId: 'market_data', error: 'fail' },
    ];
    expect(findActiveToolId(events)).toBeUndefined();
  });
});

describe('deriveWorkingState', () => {
  test('returns idle for idle status', () => {
    expect(deriveWorkingState({ status: 'idle', events: [] })).toEqual({ status: 'idle' });
  });

  test('returns idle for done status', () => {
    expect(deriveWorkingState({ status: 'done', events: [] })).toEqual({ status: 'idle' });
  });

  test('returns thinking when running with no events', () => {
    expect(deriveWorkingState({ status: 'running', events: [] })).toEqual({ status: 'thinking' });
  });

  test('returns tool state when last event is tool_start', () => {
    const events: RunEvent[] = [
      { type: 'tool_start', toolId: 'market_data', args: {} },
    ];
    expect(deriveWorkingState({ status: 'running', events })).toEqual({ status: 'tool', toolName: 'market_data' });
  });

  test('returns answering state when last event is answer_start', () => {
    const events: RunEvent[] = [{ type: 'answer_start' }];
    const result = deriveWorkingState({ status: 'running', events });
    expect(result.status).toBe('answering');
    expect((result as { status: 'answering'; startTime: number }).startTime).toBeGreaterThan(0);
  });

  test('returns thinking for other event types', () => {
    const events: RunEvent[] = [
      { type: 'tool_end', toolId: 'market_data', result: '{}', duration: 100 },
    ];
    expect(deriveWorkingState({ status: 'running', events })).toEqual({ status: 'thinking' });
  });
});
