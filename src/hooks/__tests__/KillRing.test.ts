import { describe, test, expect } from 'bun:test';
import { KillRing } from '../useKillRing.js';

describe('KillRing class', () => {
  describe('push and yank', () => {
    test('yank returns null when ring is empty', () => {
      const kr = new KillRing();
      expect(kr.yank()).toBeNull();
    });

    test('yank returns most recently pushed text', () => {
      const kr = new KillRing();
      kr.push('hello');
      expect(kr.yank()).toBe('hello');
    });

    test('yank returns latest after multiple pushes', () => {
      const kr = new KillRing();
      kr.push('first');
      kr.push('second');
      expect(kr.yank()).toBe('second');
    });

    test('push ignores empty strings', () => {
      const kr = new KillRing();
      kr.push('');
      expect(kr.size).toBe(0);
      expect(kr.yank()).toBeNull();
    });
  });

  describe('yankPop', () => {
    test('returns null when ring is empty', () => {
      const kr = new KillRing();
      expect(kr.yankPop()).toBeNull();
    });

    test('cycles to older entry', () => {
      const kr = new KillRing();
      kr.push('aaa');
      kr.push('bbb');
      kr.yank();
      expect(kr.yankPop()).toBe('aaa');
    });

    test('wraps around circularly', () => {
      const kr = new KillRing();
      kr.push('first');
      kr.push('second');
      kr.yank();
      kr.yankPop();
      expect(kr.yankPop()).toBe('second');
    });

    test('single entry wraps to itself', () => {
      const kr = new KillRing();
      kr.push('only');
      kr.yank();
      expect(kr.yankPop()).toBe('only');
    });
  });

  describe('size', () => {
    test('starts at 0', () => {
      const kr = new KillRing();
      expect(kr.size).toBe(0);
    });

    test('increments with pushes', () => {
      const kr = new KillRing();
      kr.push('a');
      expect(kr.size).toBe(1);
      kr.push('b');
      expect(kr.size).toBe(2);
    });
  });

  describe('maxSize enforcement', () => {
    test('maxSize is 10', () => {
      const kr = new KillRing();
      expect(kr.maxSize).toBe(10);
    });

    test('evicts oldest when exceeding maxSize', () => {
      const kr = new KillRing();
      for (let i = 0; i < 11; i++) {
        kr.push(`item${i}`);
      }
      expect(kr.size).toBe(10);
      expect(kr.yank()).toBe('item10');

      const entries: string[] = [];
      kr.yank();
      for (let i = 0; i < 10; i++) {
        const entry = i === 0 ? kr.yank()! : kr.yankPop()!;
        entries.push(entry);
      }
      expect(entries).not.toContain('item0');
      expect(entries).toContain('item1');
      expect(entries).toContain('item10');
    });
  });
});
