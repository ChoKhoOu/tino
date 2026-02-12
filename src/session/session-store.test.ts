import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SessionStore } from './session-store.js';
import type { Session, SessionMessage, SessionMetadata } from './session.js';

const TEST_BASE = join(tmpdir(), `tino-session-test-${Date.now()}`);

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

describe('SessionStore', () => {
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

  describe('save and load', () => {
    test('saves session to JSON file and loads it back', async () => {
      const session = makeSession({ title: 'My Trading Session' });

      await store.save(session);
      const loaded = await store.load(session.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(session.id);
      expect(loaded!.title).toBe('My Trading Session');
      expect(loaded!.messages).toEqual([]);
      expect(loaded!.createdAt).toBe(session.createdAt);
      expect(loaded!.updatedAt).toBe(session.updatedAt);
    });

    test('preserves tokenUsage and todos', async () => {
      const session = makeSession({
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        todos: [{ id: '1', content: 'Buy AAPL', status: 'pending', priority: 'high' }],
      });

      await store.save(session);
      const loaded = await store.load(session.id);

      expect(loaded!.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
      expect(loaded!.todos).toHaveLength(1);
      expect(loaded!.todos![0].content).toBe('Buy AAPL');
    });

    test('overwrites existing session on re-save', async () => {
      const session = makeSession({ title: 'Original' });
      await store.save(session);

      session.title = 'Updated';
      await store.save(session);

      const loaded = await store.load(session.id);
      expect(loaded!.title).toBe('Updated');
    });
  });

  describe('load', () => {
    test('returns null for non-existent session', async () => {
      const loaded = await store.load('ses_nonexistent');
      expect(loaded).toBeNull();
    });

    test('returns null for corrupted JSON file', async () => {
      const filePath = join(testDir, 'ses_corrupt.json');
      writeFileSync(filePath, '{invalid json!!!', 'utf-8');

      const loaded = await store.load('ses_corrupt');
      expect(loaded).toBeNull();
    });
  });

  describe('list', () => {
    test('returns empty array when no sessions exist', async () => {
      const list = await store.list();
      expect(list).toEqual([]);
    });

    test('returns metadata for all sessions', async () => {
      const s1 = makeSession({ title: 'Session A', messages: [makeMessage()] });
      const s2 = makeSession({
        title: 'Session B',
        messages: [makeMessage(), makeMessage({ role: 'assistant', content: 'Hi' })],
      });

      await store.save(s1);
      await store.save(s2);

      const list = await store.list();
      expect(list).toHaveLength(2);

      const ids = list.map((m: SessionMetadata) => m.id).sort();
      expect(ids).toContain(s1.id);
      expect(ids).toContain(s2.id);

      const meta1 = list.find((m: SessionMetadata) => m.id === s1.id)!;
      expect(meta1.title).toBe('Session A');
      expect(meta1.messageCount).toBe(1);

      const meta2 = list.find((m: SessionMetadata) => m.id === s2.id)!;
      expect(meta2.title).toBe('Session B');
      expect(meta2.messageCount).toBe(2);
    });

    test('skips corrupted files in listing', async () => {
      const valid = makeSession({ title: 'Valid' });
      await store.save(valid);

      writeFileSync(join(testDir, 'ses_bad.json'), 'not json', 'utf-8');

      const list = await store.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(valid.id);
    });
  });

  describe('delete', () => {
    test('removes session file and returns true', async () => {
      const session = makeSession();
      await store.save(session);

      const result = await store.delete(session.id);
      expect(result).toBe(true);

      const loaded = await store.load(session.id);
      expect(loaded).toBeNull();
    });

    test('returns false for non-existent session', async () => {
      const result = await store.delete('ses_ghost');
      expect(result).toBe(false);
    });
  });

  describe('appendMessage', () => {
    test('appends message and updates updatedAt', async () => {
      const session = makeSession({ title: 'Append Test' });
      const originalUpdatedAt = session.updatedAt;
      await store.save(session);

      await new Promise((r) => setTimeout(r, 10));

      const msg = makeMessage({ content: 'New message' });
      await store.appendMessage(session.id, msg);

      const loaded = await store.load(session.id);
      expect(loaded!.messages).toHaveLength(1);
      expect(loaded!.messages[0].content).toBe('New message');
      expect(loaded!.updatedAt).not.toBe(originalUpdatedAt);
    });

    test('appends multiple messages in order', async () => {
      const session = makeSession();
      await store.save(session);

      await store.appendMessage(session.id, makeMessage({ content: 'First' }));
      await store.appendMessage(session.id, makeMessage({ content: 'Second' }));
      await store.appendMessage(session.id, makeMessage({ content: 'Third' }));

      const loaded = await store.load(session.id);
      expect(loaded!.messages).toHaveLength(3);
      expect(loaded!.messages[0].content).toBe('First');
      expect(loaded!.messages[1].content).toBe('Second');
      expect(loaded!.messages[2].content).toBe('Third');
    });

    test('does not throw when session does not exist', async () => {
      const msg = makeMessage({ content: 'Orphan' });
      await store.appendMessage('ses_missing', msg);
    });
  });

  describe('auto-create directory', () => {
    test('creates base directory if it does not exist', async () => {
      const newDir = join(TEST_BASE, 'fresh-dir', 'sessions');
      const freshStore = new SessionStore(newDir);

      const session = makeSession();
      await freshStore.save(session);

      expect(existsSync(newDir)).toBe(true);
      const loaded = await freshStore.load(session.id);
      expect(loaded).not.toBeNull();
    });
  });

  describe('non-fatal I/O', () => {
    test('save does not throw on permission error', async () => {
      const badStore = new SessionStore('/proc/nonexistent/impossible');
      const session = makeSession();
      await badStore.save(session);
    });

    test('list does not throw on missing directory', async () => {
      const badStore = new SessionStore('/tmp/tino-nonexistent-dir-xyz');
      const list = await badStore.list();
      expect(list).toEqual([]);
    });
  });
});
