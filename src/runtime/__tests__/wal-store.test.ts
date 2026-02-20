import { describe, test, expect, beforeEach } from 'bun:test';
import { InMemoryWAL, type WALEntry } from '../wal-store.js';

describe('InMemoryWAL', () => {
  let wal: InMemoryWAL;

  beforeEach(() => {
    wal = new InMemoryWAL();
  });

  // ── append ────────────────────────────────────────────────────────

  describe('append', () => {
    test('adds entry with auto-generated timestamp and tokenEstimate', () => {
      const before = Date.now();
      wal.append({ role: 'user', content: 'hello' });
      const after = Date.now();

      const msgs = wal.getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.role).toBe('user');
      expect(msgs[0]!.content).toBe('hello');
      expect(msgs[0]!.timestamp).toBeGreaterThanOrEqual(before);
      expect(msgs[0]!.timestamp).toBeLessThanOrEqual(after);
      expect(typeof msgs[0]!.tokenEstimate).toBe('number');
    });

    test('token estimate is ceil(content.length / 4)', () => {
      // 5 chars -> ceil(5/4) = 2
      wal.append({ role: 'user', content: '12345' });
      expect(wal.getMessages()[0]!.tokenEstimate).toBe(2);

      // 8 chars -> ceil(8/4) = 2
      wal.append({ role: 'assistant', content: '12345678' });
      expect(wal.getMessages()[1]!.tokenEstimate).toBe(2);

      // 1 char -> ceil(1/4) = 1
      wal.append({ role: 'user', content: 'a' });
      expect(wal.getMessages()[2]!.tokenEstimate).toBe(1);

      // 4 chars -> ceil(4/4) = 1
      wal.append({ role: 'user', content: 'abcd' });
      expect(wal.getMessages()[3]!.tokenEstimate).toBe(1);

      // 0 chars -> ceil(0/4) = 0
      wal.append({ role: 'user', content: '' });
      expect(wal.getMessages()[4]!.tokenEstimate).toBe(0);
    });

    test('preserves optional toolId field', () => {
      wal.append({ role: 'tool', content: 'result', toolId: 'my-tool' });
      expect(wal.getMessages()[0]!.toolId).toBe('my-tool');
    });

    test('seals active segment at SEGMENT_SIZE (50 entries)', () => {
      for (let i = 0; i < 50; i++) {
        wal.append({ role: 'user', content: `msg-${i}` });
      }
      // After 50 appends the active segment should have been sealed.
      // Appending one more should land in a new active segment.
      wal.append({ role: 'user', content: 'msg-50' });

      const all = wal.getMessages();
      expect(all).toHaveLength(51);
      // First 50 are in a sealed segment, entry 51 is in active.
    });
  });

  // ── getMessages ───────────────────────────────────────────────────

  describe('getMessages', () => {
    test('returns all entries across sealed segments and active', () => {
      // Fill one full segment (50) + 10 in active = 60 total
      for (let i = 0; i < 60; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      const msgs = wal.getMessages();
      expect(msgs).toHaveLength(60);
      expect(msgs[0]!.content).toBe('m0');
      expect(msgs[59]!.content).toBe('m59');
    });

    test('returns last N entries when limit < total', () => {
      for (let i = 0; i < 10; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      const last3 = wal.getMessages(3);
      expect(last3).toHaveLength(3);
      expect(last3[0]!.content).toBe('m7');
      expect(last3[1]!.content).toBe('m8');
      expect(last3[2]!.content).toBe('m9');
    });

    test('returns all entries when limit >= total', () => {
      for (let i = 0; i < 5; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      const msgs = wal.getMessages(100);
      expect(msgs).toHaveLength(5);
    });

    test('returns all entries when limit is undefined', () => {
      for (let i = 0; i < 5; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      const msgs = wal.getMessages(undefined);
      expect(msgs).toHaveLength(5);
    });

    test('returns empty array on fresh WAL', () => {
      expect(wal.getMessages()).toEqual([]);
    });
  });

  // ── getTokenCount ─────────────────────────────────────────────────

  describe('getTokenCount', () => {
    test('returns 0 on fresh WAL', () => {
      expect(wal.getTokenCount()).toBe(0);
    });

    test('sums token estimates across sealed segments and active', () => {
      // Each 'abcd' is 4 chars -> ceil(4/4) = 1 token
      for (let i = 0; i < 60; i++) {
        wal.append({ role: 'user', content: 'abcd' });
      }
      // 60 entries * 1 token each = 60
      expect(wal.getTokenCount()).toBe(60);
    });

    test('correctly tracks tokens with varying content lengths', () => {
      wal.append({ role: 'user', content: 'a' });        // ceil(1/4) = 1
      wal.append({ role: 'user', content: '12345678' }); // ceil(8/4) = 2
      wal.append({ role: 'user', content: '123456789' });// ceil(9/4) = 3
      expect(wal.getTokenCount()).toBe(6);
    });
  });

  // ── prune ─────────────────────────────────────────────────────────

  describe('prune', () => {
    test('keeps last N entries and returns removed count', () => {
      for (let i = 0; i < 10; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      const removed = wal.prune(3);
      expect(removed).toBe(7);

      const msgs = wal.getMessages();
      expect(msgs).toHaveLength(3);
      expect(msgs[0]!.content).toBe('m7');
      expect(msgs[1]!.content).toBe('m8');
      expect(msgs[2]!.content).toBe('m9');
    });

    test('returns 0 when keepCount >= total entries', () => {
      for (let i = 0; i < 5; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      expect(wal.prune(5)).toBe(0);
      expect(wal.prune(100)).toBe(0);
      expect(wal.getMessages()).toHaveLength(5);
    });

    test('re-segments properly after pruning large WAL', () => {
      // Create 120 entries -> 2 sealed segments (50 each) + 20 active
      for (let i = 0; i < 120; i++) {
        wal.append({ role: 'user', content: 'abcd' });
      }
      expect(wal.getMessages()).toHaveLength(120);

      // Keep 60 -> should result in 1 sealed segment (50) + 10 active
      const removed = wal.prune(60);
      expect(removed).toBe(60);
      expect(wal.getMessages()).toHaveLength(60);

      // Token count should be recalculated correctly
      // 60 entries * ceil(4/4) = 60 tokens
      expect(wal.getTokenCount()).toBe(60);
    });

    test('updates token count after pruning', () => {
      // 'abcdefgh' = 8 chars -> ceil(8/4) = 2 tokens each
      for (let i = 0; i < 10; i++) {
        wal.append({ role: 'user', content: 'abcdefgh' });
      }
      expect(wal.getTokenCount()).toBe(20); // 10 * 2

      wal.prune(5);
      expect(wal.getTokenCount()).toBe(10); // 5 * 2
    });

    test('pruning to 0 removes everything', () => {
      for (let i = 0; i < 5; i++) {
        wal.append({ role: 'user', content: 'test' });
      }
      const removed = wal.prune(0);
      expect(removed).toBe(5);
      expect(wal.getMessages()).toHaveLength(0);
      expect(wal.getTokenCount()).toBe(0);
    });
  });

  // ── clear ─────────────────────────────────────────────────────────

  describe('clear', () => {
    test('resets all state to empty', () => {
      // Fill with enough entries to create sealed segments
      for (let i = 0; i < 60; i++) {
        wal.append({ role: 'user', content: `m${i}` });
      }
      expect(wal.getMessages()).toHaveLength(60);
      expect(wal.getTokenCount()).toBeGreaterThan(0);

      wal.clear();

      expect(wal.getMessages()).toHaveLength(0);
      expect(wal.getTokenCount()).toBe(0);
    });

    test('WAL is usable after clear', () => {
      wal.append({ role: 'user', content: 'before' });
      wal.clear();
      wal.append({ role: 'user', content: 'after' });

      const msgs = wal.getMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0]!.content).toBe('after');
    });
  });

  // ── flush / recover ───────────────────────────────────────────────
  // WAL_DIR is a module-level const (.tino/wal) that cannot be easily
  // overridden without modifying production code. Filesystem round-trip
  // tests are skipped to avoid side effects on the working directory.
  // TODO: Make WAL_DIR configurable (constructor param or env var) to
  // enable isolated flush/recover tests with mkdtempSync.
});
