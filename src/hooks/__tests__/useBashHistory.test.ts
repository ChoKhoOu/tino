import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createBashHistory } from '../useBashHistory.js';

describe('createBashHistory', () => {
  let tempDir: string;
  let historyPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `tino-bash-history-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    historyPath = join(tempDir, 'bash-history.json');
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('addToHistory', () => {
    test('adds a command to history', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls -la');
      expect(history.getEntries()).toEqual(['ls -la']);
    });

    test('adds multiple commands in order', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('pwd');
      await history.addToHistory('git status');
      expect(history.getEntries()).toEqual(['ls', 'pwd', 'git status']);
    });

    test('does not add empty commands', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('');
      await history.addToHistory('  ');
      expect(history.getEntries()).toEqual([]);
    });

    test('does not add duplicate of most recent command', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('ls');
      expect(history.getEntries()).toEqual(['ls']);
    });

    test('allows duplicate if not most recent', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('pwd');
      await history.addToHistory('ls');
      expect(history.getEntries()).toEqual(['ls', 'pwd', 'ls']);
    });

    test('trims whitespace from commands', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('  ls -la  ');
      expect(history.getEntries()).toEqual(['ls -la']);
    });
  });

  describe('FIFO eviction at max 100 entries', () => {
    test('evicts oldest entry when exceeding 100', async () => {
      const history = createBashHistory(historyPath);
      for (let i = 0; i < 101; i++) {
        await history.addToHistory(`cmd${i}`);
      }
      const entries = history.getEntries();
      expect(entries).toHaveLength(100);
      expect(entries[0]).toBe('cmd1');
      expect(entries[99]).toBe('cmd100');
    });
  });

  describe('getMatches', () => {
    test('returns matching commands most recent first', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('pwd');
      await history.addToHistory('ls -la');
      await history.addToHistory('git status');
      await history.addToHistory('ls -R');

      const matches = history.getMatches('ls');
      expect(matches).toEqual(['ls -R', 'ls -la', 'ls']);
    });

    test('returns empty array for no matches', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('pwd');
      expect(history.getMatches('ls')).toEqual([]);
    });

    test('returns empty array for empty prefix', () => {
      const history = createBashHistory(historyPath);
      expect(history.getMatches('')).toEqual([]);
    });

    test('case-sensitive matching', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('LS');
      await history.addToHistory('ls');
      expect(history.getMatches('ls')).toEqual(['ls']);
      expect(history.getMatches('LS')).toEqual(['LS']);
    });
  });

  describe('getBestMatch', () => {
    test('returns most recent match', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('ls -la');
      await history.addToHistory('ls -R');

      expect(history.getBestMatch('ls')).toBe('ls -R');
    });

    test('returns null for no match', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('pwd');
      expect(history.getBestMatch('ls')).toBeNull();
    });

    test('returns null for empty prefix', () => {
      const history = createBashHistory(historyPath);
      expect(history.getBestMatch('')).toBeNull();
    });

    test('does not return exact match (no hint needed)', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      expect(history.getBestMatch('ls')).toBeNull();
    });
  });

  describe('persistence', () => {
    test('persists history to file', async () => {
      const history = createBashHistory(historyPath);
      await history.addToHistory('ls');
      await history.addToHistory('pwd');

      const data = await Bun.file(historyPath).json();
      expect(data).toEqual(['ls', 'pwd']);
    });

    test('loads history from existing file', async () => {
      await Bun.write(historyPath, JSON.stringify(['ls', 'pwd']));

      const history = createBashHistory(historyPath);
      await history.load();

      expect(history.getEntries()).toEqual(['ls', 'pwd']);
      expect(history.getBestMatch('l')).toBe('ls');
    });

    test('handles missing file gracefully', async () => {
      const history = createBashHistory(join(tempDir, 'nonexistent.json'));
      await history.load();
      expect(history.getEntries()).toEqual([]);
    });

    test('handles corrupt file gracefully', async () => {
      await Bun.write(historyPath, 'not valid json{{{');
      const history = createBashHistory(historyPath);
      await history.load();
      expect(history.getEntries()).toEqual([]);
    });
  });
});
