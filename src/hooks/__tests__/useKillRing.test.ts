import { describe, test, expect } from 'bun:test';
import { createKillRing } from '../useKillRing.js';

describe('createKillRing', () => {
  describe('killToEnd', () => {
    test('removes text from cursor to end of line', () => {
      const kr = createKillRing();
      const out = kr.killToEnd('hello world', 5);
      expect(out.newText).toBe('hello');
      expect(out.newCursor).toBe(5);
      expect(kr.getRing()).toEqual([' world']);
    });

    test('kills to end of current line only in multi-line text', () => {
      const kr = createKillRing();
      const out = kr.killToEnd('hello\nworld', 3);
      expect(out.newText).toBe('hel\nworld');
      expect(out.newCursor).toBe(3);
      expect(kr.getRing()).toEqual(['lo']);
    });

    test('at end of line kills the newline character', () => {
      const kr = createKillRing();
      const out = kr.killToEnd('hello\nworld', 5);
      expect(out.newText).toBe('helloworld');
      expect(out.newCursor).toBe(5);
      expect(kr.getRing()).toEqual(['\n']);
    });

    test('at end of text does nothing', () => {
      const kr = createKillRing();
      const out = kr.killToEnd('hello', 5);
      expect(out.newText).toBe('hello');
      expect(out.newCursor).toBe(5);
      expect(kr.getRing()).toEqual([]);
    });

    test('at start of line kills entire line content', () => {
      const kr = createKillRing();
      const out = kr.killToEnd('hello world', 0);
      expect(out.newText).toBe('');
      expect(out.newCursor).toBe(0);
      expect(kr.getRing()).toEqual(['hello world']);
    });
  });

  describe('killLine', () => {
    test('removes entire text', () => {
      const kr = createKillRing();
      const out = kr.killLine('hello world');
      expect(out.newText).toBe('');
      expect(out.newCursor).toBe(0);
      expect(kr.getRing()).toEqual(['hello world']);
    });

    test('empty text does nothing', () => {
      const kr = createKillRing();
      const out = kr.killLine('');
      expect(out.newText).toBe('');
      expect(out.newCursor).toBe(0);
      expect(kr.getRing()).toEqual([]);
    });
  });

  describe('yank', () => {
    test('inserts most recent kill at cursor position', () => {
      const kr = createKillRing();
      kr.killToEnd('hello world', 5);
      const out = kr.yank('hello', 0);
      expect(out.newText).toBe(' worldhello');
      expect(out.newCursor).toBe(6);
    });

    test('inserts at end of text', () => {
      const kr = createKillRing();
      kr.killLine('world');
      const out = kr.yank('hello ', 6);
      expect(out.newText).toBe('hello world');
      expect(out.newCursor).toBe(11);
    });

    test('returns unchanged text when ring is empty', () => {
      const kr = createKillRing();
      const out = kr.yank('hello', 3);
      expect(out.newText).toBe('hello');
      expect(out.newCursor).toBe(3);
    });
  });

  describe('yankPop', () => {
    test('replaces last yank with older kill', () => {
      const kr = createKillRing();
      kr.killLine('aaa');
      kr.killLine('bbb');

      const yanked = kr.yank('XY', 0);
      expect(yanked.newText).toBe('bbbXY');

      const popped = kr.yankPop('bbbXY', 3, 3);
      expect(popped.newText).toBe('aaaXY');
      expect(popped.newCursor).toBe(3);
    });

    test('wraps around to newest after cycling through all', () => {
      const kr = createKillRing();
      kr.killLine('first');
      kr.killLine('second');

      const y1 = kr.yank('', 0);
      expect(y1.newText).toBe('second');

      const p1 = kr.yankPop('second', 6, 6);
      expect(p1.newText).toBe('first');

      const p2 = kr.yankPop('first', 5, 5);
      expect(p2.newText).toBe('second');
    });

    test('returns unchanged when ring is empty', () => {
      const kr = createKillRing();
      const out = kr.yankPop('hello', 3, 0);
      expect(out.newText).toBe('hello');
      expect(out.newCursor).toBe(3);
    });
  });

  describe('ring capacity', () => {
    test('max 10 entries, oldest dropped', () => {
      const kr = createKillRing();
      for (let i = 0; i < 11; i++) {
        kr.killLine(`item${i}`);
      }
      const ring = kr.getRing();
      expect(ring).toHaveLength(10);
      expect(ring).not.toContain('item0');
      expect(ring).toContain('item1');
      expect(ring).toContain('item10');
    });

    test('yank returns most recent after overflow', () => {
      const kr = createKillRing();
      for (let i = 0; i < 11; i++) {
        kr.killLine(`item${i}`);
      }
      const out = kr.yank('', 0);
      expect(out.newText).toBe('item10');
    });
  });

  describe('empty kills are not stored', () => {
    test('killToEnd at end of text does not add to ring', () => {
      const kr = createKillRing();
      kr.killToEnd('hello', 5);
      expect(kr.getRing()).toEqual([]);
    });

    test('killLine on empty text does not add to ring', () => {
      const kr = createKillRing();
      kr.killLine('');
      expect(kr.getRing()).toEqual([]);
    });
  });
});
