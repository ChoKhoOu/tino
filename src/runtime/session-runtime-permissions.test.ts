import { describe, expect, test, mock } from 'bun:test';
import type { RunEvent } from '@/domain/events.js';
import { SessionRuntime } from './session-runtime.js';
import { ModelBroker } from './model-broker.js';
import { ToolRegistry } from './tool-registry.js';
import { PermissionEngine } from './permission-engine.js';
import { HookRunner } from './hook-runner.js';

type StreamPart = { type: string; text?: string; toolCallId?: string; toolName?: string; input?: Record<string, unknown> };
type MockResult = { fullStream: AsyncGenerator; usage: Promise<Record<string, number>> };

function createMockStreamResult(parts: StreamPart[], usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 }): MockResult {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part;
    })(),
    usage: Promise.resolve(usage),
  };
}

function makeAskRuntime(streamResults: MockResult[]) {
  let callIndex = 0;
  const mockStreamText = mock(() => {
    const result = streamResults[callIndex++];
    if (!result) throw new Error('No more mock stream results');
    return result;
  });
  mock.module('ai', () => ({ streamText: mockStreamText }));

  const broker = new ModelBroker();
  const registry = new ToolRegistry();
  const permissions = new PermissionEngine({ rules: [], defaultAction: 'ask' });
  const hooks = new HookRunner([]);

  const runtime = new SessionRuntime({
    broker, registry, permissions, hooks,
    systemPrompt: 'Test assistant.',
  });

  return { runtime };
}

function makeRuntimeWithSharedMock(allStreamResults: MockResult[]) {
  let callIndex = 0;
  const mockStreamText = mock(() => {
    const result = allStreamResults[callIndex++];
    if (!result) throw new Error('No more mock stream results');
    return result;
  });
  mock.module('ai', () => ({ streamText: mockStreamText }));

  const broker = new ModelBroker();
  const registry = new ToolRegistry();
  const permissions = new PermissionEngine({ rules: [], defaultAction: 'ask' });
  const hooks = new HookRunner([]);

  return new SessionRuntime({
    broker, registry, permissions, hooks,
    systemPrompt: 'Test assistant.',
  });
}

describe('SessionRuntime interactive permissions', () => {
  test('ask permission pauses generator until respondToPermission is called', async () => {
    const { runtime } = makeAskRuntime([
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'test' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'Done' },
      ]),
    ]);

    const gen = runtime.startRun('search');
    const events: RunEvent[] = [];

    let result = await gen.next();
    while (!result.done) {
      events.push(result.value);
      if (result.value.type === 'permission_request') break;
      result = await gen.next();
    }

    expect(events.some((e) => e.type === 'permission_request')).toBe(true);

    let resolved = false;
    const nextPromise = gen.next().then((r) => { resolved = true; return r; });
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    runtime.respondToPermission('web_search', true);
    const nextResult = await nextPromise;
    expect(resolved).toBe(true);
    expect(nextResult.done).toBe(false);
  });

  test('allow response proceeds with tool execution', async () => {
    const { runtime } = makeAskRuntime([
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'test' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'Result' },
      ]),
    ]);

    const gen = runtime.startRun('search');
    const events: RunEvent[] = [];

    for await (const event of { [Symbol.asyncIterator]: () => gen }) {
      events.push(event);
      if (event.type === 'permission_request') {
        setTimeout(() => runtime.respondToPermission('web_search', true), 10);
      }
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('permission_request');
    expect(types).toContain('tool_start');
    expect(types).toContain('done');
  });

  test('deny response yields tool_error and skips execution', async () => {
    const { runtime } = makeAskRuntime([
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'test' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'OK' },
      ]),
    ]);

    const gen = runtime.startRun('search');
    const events: RunEvent[] = [];

    for await (const event of { [Symbol.asyncIterator]: () => gen }) {
      events.push(event);
      if (event.type === 'permission_request') {
        setTimeout(() => runtime.respondToPermission('web_search', false), 10);
      }
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('permission_request');
    expect(types).toContain('tool_error');
    expect(types).not.toContain('tool_start');

    const errorEvent = events.find((e) => e.type === 'tool_error') as Extract<RunEvent, { type: 'tool_error' }>;
    expect(errorEvent.error).toContain('Permission denied by user');
  });

  test('always-allow caches permission so second call skips asking', async () => {
    const { runtime } = makeAskRuntime([
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'first' } },
      ]),
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc2', toolName: 'web_search', input: { query: 'second' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'Done' },
      ]),
    ]);

    const gen = runtime.startRun('search twice');
    const events: RunEvent[] = [];
    let permissionRequestCount = 0;

    for await (const event of { [Symbol.asyncIterator]: () => gen }) {
      events.push(event);
      if (event.type === 'permission_request') {
        permissionRequestCount++;
        setTimeout(() => runtime.respondToPermission('web_search', true, true), 10);
      }
    }

    expect(permissionRequestCount).toBe(1);
    const toolStarts = events.filter((e) => e.type === 'tool_start');
    expect(toolStarts.length).toBe(2);
  });

  test('clearHistory clears the always-allow cache', async () => {
    const runtime = makeRuntimeWithSharedMock([
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'first' } },
      ]),
      createMockStreamResult([{ type: 'text-delta', text: 'Done1' }]),
      createMockStreamResult([
        { type: 'tool-call', toolCallId: 'tc2', toolName: 'web_search', input: { query: 'second' } },
      ]),
      createMockStreamResult([{ type: 'text-delta', text: 'Done2' }]),
    ]);

    let permReqs = 0;
    const gen1 = runtime.startRun('first');
    for await (const event of { [Symbol.asyncIterator]: () => gen1 }) {
      if (event.type === 'permission_request') {
        permReqs++;
        setTimeout(() => runtime.respondToPermission('web_search', true, true), 10);
      }
    }
    expect(permReqs).toBe(1);

    runtime.clearHistory();

    let permReqs2 = 0;
    const gen2 = runtime.startRun('second');
    for await (const event of { [Symbol.asyncIterator]: () => gen2 }) {
      if (event.type === 'permission_request') {
        permReqs2++;
        setTimeout(() => runtime.respondToPermission('web_search', true), 10);
      }
    }
    expect(permReqs2).toBe(1);
  });
});
