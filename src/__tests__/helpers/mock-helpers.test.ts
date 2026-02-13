import { describe, test, expect } from 'bun:test';
import { createMockRuntime, createMockPermissionEngine, createMockHistory } from './mock-helpers.js';

// ─── createMockRuntime ──────────────────────────────────────────────────────

describe('createMockRuntime', () => {
  test('returns object with startRun method', () => {
    const runtime = createMockRuntime();
    expect(typeof runtime.startRun).toBe('function');
  });

  test('returns object with clearHistory method', () => {
    const runtime = createMockRuntime();
    expect(typeof runtime.clearHistory).toBe('function');
  });

  test('returns object with respondToPermission method', () => {
    const runtime = createMockRuntime();
    expect(typeof runtime.respondToPermission).toBe('function');
  });

  test('returns object with loadFromSession method', () => {
    const runtime = createMockRuntime();
    expect(typeof runtime.loadFromSession).toBe('function');
  });

  test('startRun returns an async generator', async () => {
    const runtime = createMockRuntime();
    const gen = runtime.startRun('test query');
    expect(gen[Symbol.asyncIterator]).toBeDefined();
  });

  test('startRun yields done event by default', async () => {
    const runtime = createMockRuntime();
    const gen = runtime.startRun('test query');
    const events = [];
    for await (const event of gen) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('done');
  });
});

// ─── createMockPermissionEngine ─────────────────────────────────────────────

describe('createMockPermissionEngine', () => {
  test('returns object with check method', () => {
    const engine = createMockPermissionEngine();
    expect(typeof engine.check).toBe('function');
  });

  test('check returns allow by default', () => {
    const engine = createMockPermissionEngine();
    expect(engine.check('any_tool')).toBe('allow');
  });

  test('check accepts optional resource parameter', () => {
    const engine = createMockPermissionEngine();
    expect(engine.check('tool', 'resource')).toBe('allow');
  });
});

// ─── createMockHistory ──────────────────────────────────────────────────────

describe('createMockHistory', () => {
  test('returns empty array when count is 0', () => {
    const history = createMockHistory(0);
    expect(history).toEqual([]);
  });

  test('returns 3 items by default', () => {
    const history = createMockHistory();
    expect(history).toHaveLength(3);
  });

  test('returns requested number of items', () => {
    const history = createMockHistory(5);
    expect(history).toHaveLength(5);
  });

  test('each item has required HistoryItem fields', () => {
    const history = createMockHistory(1);
    const item = history[0];
    expect(item.id).toBeDefined();
    expect(typeof item.id).toBe('string');
    expect(typeof item.query).toBe('string');
    expect(Array.isArray(item.events)).toBe(true);
    expect(typeof item.answer).toBe('string');
    expect(['processing', 'complete', 'error', 'interrupted']).toContain(item.status);
  });

  test('items have unique ids', () => {
    const history = createMockHistory(5);
    const ids = history.map((h) => h.id);
    expect(new Set(ids).size).toBe(5);
  });

  test('items have tokenUsage with correct shape', () => {
    const history = createMockHistory(1);
    const item = history[0];
    if (item.tokenUsage) {
      expect(typeof item.tokenUsage.inputTokens).toBe('number');
      expect(typeof item.tokenUsage.outputTokens).toBe('number');
      expect(typeof item.tokenUsage.totalTokens).toBe('number');
    }
  });
});
