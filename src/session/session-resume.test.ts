import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SessionStore } from './session-store.js';
import { SessionRuntime } from '../runtime/session-runtime.js';
import { ModelBroker } from '../runtime/model-broker.js';
import { ToolRegistry } from '../runtime/tool-registry.js';
import { PermissionEngine } from '../runtime/permission-engine.js';
import { HookRunner } from '../runtime/hook-runner.js';
import type { RunEvent } from '../domain/events.js';
import type { Session, SessionMessage } from './session.js';

const TEST_BASE = join(tmpdir(), `tino-resume-test-${Date.now()}`);

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    id: `ses_${crypto.randomUUID().slice(0, 8)}`,
    title: 'Test Session',
    messages: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<SessionMessage> = {}): SessionMessage {
  return {
    role: 'user',
    content: 'Hello',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('SessionStore.fork', () => {
  let store: SessionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(TEST_BASE, `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(testDir, { recursive: true });
    store = new SessionStore(testDir);
  });

  afterEach(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  test('creates independent copy with new ID', async () => {
    const original = makeSession({
      title: 'Original',
      messages: [
        makeMessage({ role: 'system', content: 'System prompt' }),
        makeMessage({ role: 'user', content: 'Hello' }),
        makeMessage({ role: 'assistant', content: 'Hi there' }),
      ],
    });
    await store.save(original);

    const newId = await store.fork(original.id);
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(original.id);

    const forked = await store.load(newId!);
    expect(forked).not.toBeNull();
    expect(forked!.messages).toHaveLength(3);
    expect(forked!.messages[0].content).toBe('System prompt');
    expect(forked!.messages[1].content).toBe('Hello');
    expect(forked!.messages[2].content).toBe('Hi there');
  });

  test('forked session has new timestamps', async () => {
    const original = makeSession({
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    await store.save(original);

    const newId = await store.fork(original.id);
    const forked = await store.load(newId!);
    expect(forked!.createdAt).not.toBe('2025-01-01T00:00:00.000Z');
  });

  test('forked session title has (fork) suffix', async () => {
    const original = makeSession({ title: 'My Session' });
    await store.save(original);

    const newId = await store.fork(original.id);
    const forked = await store.load(newId!);
    expect(forked!.title).toBe('My Session (fork)');
  });

  test('modifying forked session does not affect original', async () => {
    const original = makeSession({
      messages: [makeMessage({ content: 'Original message' })],
    });
    await store.save(original);

    const newId = await store.fork(original.id);
    await store.appendMessage(newId!, makeMessage({ content: 'New message' }));

    const loaded = await store.load(original.id);
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe('Original message');
  });

  test('returns null for non-existent session', async () => {
    const newId = await store.fork('ses_nonexistent');
    expect(newId).toBeNull();
  });
});

describe('SessionStore.rename', () => {
  let store: SessionStore;
  let testDir: string;

  beforeEach(() => {
    testDir = join(TEST_BASE, `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(testDir, { recursive: true });
    store = new SessionStore(testDir);
  });

  afterEach(() => {
    rmSync(TEST_BASE, { recursive: true, force: true });
  });

  test('updates session title', async () => {
    const session = makeSession({ title: 'Old Title' });
    await store.save(session);

    const result = await store.rename(session.id, 'New Title');
    expect(result).toBe(true);

    const loaded = await store.load(session.id);
    expect(loaded!.title).toBe('New Title');
  });

  test('updates updatedAt timestamp', async () => {
    const session = makeSession({ updatedAt: '2025-01-01T00:00:00.000Z' });
    await store.save(session);

    await store.rename(session.id, 'Renamed');
    const loaded = await store.load(session.id);
    expect(loaded!.updatedAt).not.toBe('2025-01-01T00:00:00.000Z');
  });

  test('returns false for non-existent session', async () => {
    const result = await store.rename('ses_ghost', 'New Name');
    expect(result).toBe(false);
  });

  test('preserves messages and other data', async () => {
    const session = makeSession({
      title: 'Original',
      messages: [makeMessage({ content: 'Keep me' })],
      tokenUsage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
    });
    await store.save(session);

    await store.rename(session.id, 'Renamed');
    const loaded = await store.load(session.id);
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe('Keep me');
    expect(loaded!.tokenUsage).toEqual({ inputTokens: 50, outputTokens: 25, totalTokens: 75 });
  });
});

describe('SessionRuntime.loadFromSession', () => {
  function makeRuntimeWithMock() {
    const mockStreamText = mock(() => ({
      fullStream: (async function* () {
        yield { type: 'text-delta', text: 'Resumed response' };
      })(),
      usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
    }));

    mock.module('ai', () => ({ streamText: mockStreamText }));

    const runtime = new SessionRuntime({
      broker: new ModelBroker(),
      registry: new ToolRegistry(),
      permissions: new PermissionEngine({ rules: [{ tool: '*', action: 'allow' }], defaultAction: 'ask' }),
      hooks: new HookRunner([]),
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

  test('restores session messages and allows continuation', async () => {
    const session = makeSession({
      messages: [
        makeMessage({ role: 'system', content: 'You are a test assistant.' }),
        makeMessage({ role: 'user', content: 'Hello' }),
        makeMessage({ role: 'assistant', content: 'Hi there!' }),
      ],
    });

    const { runtime } = makeRuntimeWithMock();
    const loaded = runtime.loadFromSession(session);
    expect(loaded.messageCount).toBe(3);

    const events = await collectEvents(runtime.startRun('Continue'));
    const answerEvents = events.filter((e) => e.type === 'answer_delta');
    expect(answerEvents.length).toBeGreaterThan(0);
  });

  test('sets initialized=true so system prompt is not duplicated', async () => {
    const session = makeSession({
      messages: [
        makeMessage({ role: 'system', content: 'Original prompt' }),
        makeMessage({ role: 'user', content: 'First question' }),
      ],
    });

    const { runtime } = makeRuntimeWithMock();
    runtime.loadFromSession(session);

    const events = await collectEvents(runtime.startRun('Second question'));
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  test('clears previous state before loading', async () => {
    const { runtime } = makeRuntimeWithMock();

    await collectEvents(runtime.startRun('First run'));

    const session = makeSession({
      messages: [
        makeMessage({ role: 'system', content: 'New prompt' }),
        makeMessage({ role: 'user', content: 'New question' }),
      ],
    });

    const loaded = runtime.loadFromSession(session);
    expect(loaded.messageCount).toBe(2);

    const events = await collectEvents(runtime.startRun('Continue'));
    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  test('returns zero messageCount for empty session', () => {
    const { runtime } = makeRuntimeWithMock();
    const session = makeSession({ messages: [] });
    const loaded = runtime.loadFromSession(session);
    expect(loaded.messageCount).toBe(0);
  });
});