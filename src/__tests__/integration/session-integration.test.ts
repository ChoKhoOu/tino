import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync } from 'node:fs';
import { SessionStore } from '../../session/session-store.js';
import type { Session } from '../../session/session.js';

let testDir: string;
let store: SessionStore;

function makeSession(id: string, title: string, messages: Session['messages'] = []): Session {
  const now = new Date().toISOString();
  return { id, title, messages, createdAt: now, updatedAt: now };
}

function freshStore(): SessionStore {
  testDir = join(tmpdir(), `tino-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
  store = new SessionStore(testDir);
  return store;
}

afterEach(() => {
  try { rmSync(testDir, { recursive: true, force: true }); } catch {}
});

describe('session integration', () => {
  test('save and load round-trip preserves session data', async () => {
    const s = freshStore();
    const session = makeSession('ses_001', 'Test Session', [
      { role: 'user', content: 'hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'hi', timestamp: new Date().toISOString() },
    ]);

    await s.save(session);
    const loaded = await s.load('ses_001');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('ses_001');
    expect(loaded!.title).toBe('Test Session');
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0].content).toBe('hello');
    expect(loaded!.messages[1].content).toBe('hi');
  });

  test('load returns null for nonexistent session', async () => {
    const s = freshStore();
    const loaded = await s.load('nonexistent');
    expect(loaded).toBeNull();
  });

  test('list returns metadata for all saved sessions', async () => {
    const s = freshStore();
    await s.save(makeSession('ses_a', 'Alpha'));
    await s.save(makeSession('ses_b', 'Beta'));
    await s.save(makeSession('ses_c', 'Gamma'));

    const list = await s.list();
    expect(list).toHaveLength(3);

    const ids = list.map((m) => m.id).sort();
    expect(ids).toEqual(['ses_a', 'ses_b', 'ses_c']);
  });

  test('delete removes session and returns true', async () => {
    const s = freshStore();
    await s.save(makeSession('ses_del', 'To Delete'));

    const deleted = await s.delete('ses_del');
    expect(deleted).toBe(true);

    const loaded = await s.load('ses_del');
    expect(loaded).toBeNull();
  });

  test('delete returns false for nonexistent session', async () => {
    const s = freshStore();
    const deleted = await s.delete('nope');
    expect(deleted).toBe(false);
  });

  test('fork creates independent copy with new ID', async () => {
    const s = freshStore();
    const original = makeSession('ses_orig', 'Original', [
      { role: 'user', content: 'data', timestamp: new Date().toISOString() },
    ]);
    await s.save(original);

    const newId = await s.fork('ses_orig');
    expect(newId).not.toBeNull();
    expect(newId).not.toBe('ses_orig');

    const forked = await s.load(newId!);
    expect(forked).not.toBeNull();
    expect(forked!.title).toContain('(fork)');
    expect(forked!.messages).toHaveLength(1);
    expect(forked!.messages[0].content).toBe('data');

    const originalStillExists = await s.load('ses_orig');
    expect(originalStillExists).not.toBeNull();
  });

  test('rename updates session title', async () => {
    const s = freshStore();
    await s.save(makeSession('ses_ren', 'Old Title'));

    const renamed = await s.rename('ses_ren', 'New Title');
    expect(renamed).toBe(true);

    const loaded = await s.load('ses_ren');
    expect(loaded!.title).toBe('New Title');
  });

  test('appendMessage adds to existing session', async () => {
    const s = freshStore();
    await s.save(makeSession('ses_append', 'Append Test'));

    await s.appendMessage('ses_append', {
      role: 'user',
      content: 'appended',
      timestamp: new Date().toISOString(),
    });

    const loaded = await s.load('ses_append');
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe('appended');
  });
});
