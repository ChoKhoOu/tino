import { describe, expect, test, mock } from 'bun:test';
import type { AnswerDeltaEvent, RunEvent } from '@/domain/events.js';
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

function makeRuntime(streamResults: MockResult[]) {
  let callIndex = 0;

  const mockStreamText = mock(() => {
    const result = streamResults[callIndex++];
    if (!result) throw new Error('No more mock stream results');
    return result;
  });

  mock.module('ai', () => ({ streamText: mockStreamText }));

  const broker = new ModelBroker();
  const registry = new ToolRegistry();
  const permissions = new PermissionEngine({ rules: [{ tool: '*', action: 'allow' }], defaultAction: 'ask' });
  const hooks = new HookRunner([]);

  const runtime = new SessionRuntime({
    broker, registry, permissions, hooks,
    systemPrompt: 'You are a test assistant.',
  });

  return { runtime, mockStreamText };
}

async function collectEvents(gen: AsyncGenerator<RunEvent>): Promise<RunEvent[]> {
  const events: RunEvent[] = [];
  let result = await gen.next();
  while (!result.done) {
    events.push(result.value);
    result = await gen.next();
  }
  return events;
}

const isDelta = (e: RunEvent): e is AnswerDeltaEvent => e.type === 'answer_delta';

describe('SessionRuntime answer_delta streaming', () => {
  test('emits answer_start before first answer_delta when model returns text without tool calls', async () => {
    const { runtime } = makeRuntime([
      createMockStreamResult([
        { type: 'text-delta', text: 'Hello' },
        { type: 'text-delta', text: ' world' },
      ]),
    ]);

    const events = await collectEvents(runtime.startRun('hi'));

    const answerStartIdx = events.findIndex((e) => e.type === 'answer_start');
    const firstDeltaIdx = events.findIndex(isDelta);

    expect(answerStartIdx).toBeGreaterThanOrEqual(0);
    expect(firstDeltaIdx).toBeGreaterThanOrEqual(0);
    expect(answerStartIdx).toBeLessThan(firstDeltaIdx);
  });

  test('emits answer_delta events with incremental text fragments', async () => {
    const { runtime } = makeRuntime([
      createMockStreamResult([
        { type: 'text-delta', text: 'Hello' },
        { type: 'text-delta', text: ' world' },
        { type: 'text-delta', text: '!' },
      ]),
    ]);

    const events = await collectEvents(runtime.startRun('hi'));
    const deltas = events.filter(isDelta);

    expect(deltas).toHaveLength(3);
    expect(deltas[0].delta).toBe('Hello');
    expect(deltas[1].delta).toBe(' world');
    expect(deltas[2].delta).toBe('!');
  });

  test('final answer in done event equals concatenation of all deltas', async () => {
    const { runtime } = makeRuntime([
      createMockStreamResult([
        { type: 'text-delta', text: 'foo' },
        { type: 'text-delta', text: 'bar' },
        { type: 'text-delta', text: 'baz' },
      ]),
    ]);

    const events = await collectEvents(runtime.startRun('hi'));

    const deltas = events.filter(isDelta);
    const concatenated = deltas.map((d) => d.delta).join('');

    const done = events.find((e) => e.type === 'done') as Extract<RunEvent, { type: 'done' }>;
    expect(done).toBeDefined();
    expect(done.answer).toBe(concatenated);
    expect(done.answer).toBe('foobarbaz');
  });

  test('emits thinking event instead of deltas when tool calls follow text', async () => {
    const { runtime } = makeRuntime([
      createMockStreamResult([
        { type: 'text-delta', text: 'Let me search...' },
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'test' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'Found it!' },
      ]),
    ]);

    const events = await collectEvents(runtime.startRun('search for test'));

    const thinkingEvents = events.filter((e) => e.type === 'thinking');
    expect(thinkingEvents.length).toBeGreaterThanOrEqual(1);

    const deltas = events.filter(isDelta);
    const deltaText = deltas.map((d) => d.delta).join('');
    expect(deltaText).toBe('Found it!');
  });

  test('answer_start is emitted exactly once before first answer_delta', async () => {
    const { runtime } = makeRuntime([
      createMockStreamResult([
        { type: 'text-delta', text: 'Thinking...' },
        { type: 'tool-call', toolCallId: 'tc1', toolName: 'web_search', input: { query: 'x' } },
      ]),
      createMockStreamResult([
        { type: 'text-delta', text: 'Answer' },
      ]),
    ]);

    const events = await collectEvents(runtime.startRun('q'));

    const answerStarts = events.filter((e) => e.type === 'answer_start');
    expect(answerStarts).toHaveLength(1);

    const answerStartIdx = events.findIndex((e) => e.type === 'answer_start');
    const firstDeltaIdx = events.findIndex(isDelta);
    expect(answerStartIdx).toBeLessThan(firstDeltaIdx);
  });
});
