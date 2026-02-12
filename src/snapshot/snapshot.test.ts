import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SnapshotManager } from './snapshot.js';

const TEST_BASE = join(tmpdir(), `tino-test-snapshot-${Date.now()}`);

function makeTempDir(): string {
  const dir = join(TEST_BASE, `run-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  mkdirSync(TEST_BASE, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('SnapshotManager', () => {
  describe('init', () => {
    test('creates git repo if not exists', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);

      await mgr.init();

      expect(existsSync(join(snapshotDir, '.git'))).toBe(true);
    });

    test('is idempotent — calling init twice does not error', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);

      await mgr.init();
      await mgr.init();

      expect(existsSync(join(snapshotDir, '.git'))).toBe(true);
    });
  });

  describe('createSnapshot', () => {
    test('copies file to snapshot repo and returns snapshot ID', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const srcFile = join(tmpDir, 'src', 'hello.ts');
      mkdirSync(join(tmpDir, 'src'), { recursive: true });
      writeFileSync(srcFile, 'export const x = 42;\n');

      const id = await mgr.createSnapshot(srcFile);

      expect(id).not.toBeNull();
      expect(typeof id).toBe('string');
      expect(id!.length).toBeGreaterThan(0);
    });

    test('preserves original path structure inside snapshot repo', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const srcFile = join(tmpDir, 'src', 'tools', 'edit.ts');
      mkdirSync(join(tmpDir, 'src', 'tools'), { recursive: true });
      writeFileSync(srcFile, 'const y = 1;\n');

      await mgr.createSnapshot(srcFile);

      const snappedFile = join(snapshotDir, srcFile);
      expect(existsSync(snappedFile)).toBe(true);
      expect(readFileSync(snappedFile, 'utf-8')).toBe('const y = 1;\n');
    });

    test('returns null when source file does not exist', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const id = await mgr.createSnapshot('/nonexistent/file.ts');

      expect(id).toBeNull();
    });

    test('returns null when snapshot repo is not initialized', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      // given: init() NOT called

      const srcFile = join(tmpDir, 'test.ts');
      writeFileSync(srcFile, 'data');

      const id = await mgr.createSnapshot(srcFile);

      expect(id).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    test('returns empty array when no snapshots exist', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const entries = await mgr.listSnapshots();

      expect(entries).toEqual([]);
    });

    test('returns entries after creating snapshots', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const srcFile = join(tmpDir, 'file.ts');
      writeFileSync(srcFile, 'v1');
      await mgr.createSnapshot(srcFile);

      writeFileSync(srcFile, 'v2');
      await mgr.createSnapshot(srcFile);

      const entries = await mgr.listSnapshots();

      expect(entries.length).toBe(2);
      expect(entries[0].id).toBeDefined();
      expect(entries[0].filePath).toContain('file.ts');
      expect(entries[0].timestamp).toBeDefined();
    });
  });

  describe('restoreSnapshot', () => {
    test('restores file content from a snapshot', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const srcFile = join(tmpDir, 'restore-me.ts');
      writeFileSync(srcFile, 'original content');
      const snapshotId = await mgr.createSnapshot(srcFile);

      writeFileSync(srcFile, 'modified content');
      expect(readFileSync(srcFile, 'utf-8')).toBe('modified content');

      const ok = await mgr.restoreSnapshot(snapshotId!, srcFile);

      expect(ok).toBe(true);
      expect(readFileSync(srcFile, 'utf-8')).toBe('original content');
    });

    test('returns false for invalid snapshot ID', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const ok = await mgr.restoreSnapshot('nonexistent-id', '/tmp/whatever.ts');

      expect(ok).toBe(false);
    });
  });

  describe('cleanOldSnapshots', () => {
    test('returns 0 when no snapshots to clean', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const removed = await mgr.cleanOldSnapshots(7);

      expect(removed).toBe(0);
    });

    test('does not remove recent snapshots', async () => {
      const tmpDir = makeTempDir();
      const snapshotDir = join(tmpDir, 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const srcFile = join(tmpDir, 'keep.ts');
      writeFileSync(srcFile, 'keep me');
      await mgr.createSnapshot(srcFile);

      const removed = await mgr.cleanOldSnapshots(7);

      expect(removed).toBe(0);
      const entries = await mgr.listSnapshots();
      expect(entries.length).toBe(1);
    });

    test('uses default maxAgeDays of 7', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);
      await mgr.init();

      const removed = await mgr.cleanOldSnapshots();
      expect(removed).toBe(0);
    });
  });

  describe('error resilience', () => {
    test('listSnapshots returns empty array on uninitialized repo', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);

      const entries = await mgr.listSnapshots();

      expect(entries).toEqual([]);
    });

    test('cleanOldSnapshots returns 0 on uninitialized repo', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);

      const removed = await mgr.cleanOldSnapshots();

      expect(removed).toBe(0);
    });

    test('restoreSnapshot returns false on uninitialized repo', async () => {
      const snapshotDir = join(makeTempDir(), 'snapshots');
      const mgr = new SnapshotManager(snapshotDir);

      const ok = await mgr.restoreSnapshot('abc', '/tmp/x.ts');

      expect(ok).toBe(false);
    });
  });
});
