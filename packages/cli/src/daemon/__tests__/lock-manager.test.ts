import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;

vi.mock('../paths.js', () => {
  // Lazily resolve so each test gets the current tmpDir
  return {
    get CLI_LOCK_DIR() {
      return tmpDir;
    },
    ensureDir(dir: string) {
      mkdirSync(dir, { recursive: true });
    },
  };
});

// Dynamic import so the mock is in place before the module loads
async function loadModule() {
  // Clear module cache to pick up fresh mock each test
  vi.resetModules();
  return await import('../lock-manager.js');
}

describe('lock-manager', () => {
  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `tino-lock-test-${process.pid}-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('registerCli', () => {
    it('creates a lock file named cli-<PID>.lock with correct JSON', async () => {
      const { registerCli } = await loadModule();
      registerCli();

      const lockFile = path.join(tmpDir, `cli-${process.pid}.lock`);
      const data = JSON.parse(readFileSync(lockFile, 'utf-8'));

      expect(data).toHaveProperty('pid', process.pid);
      expect(data).toHaveProperty('startedAt');
      expect(typeof data.startedAt).toBe('string');
      expect(data).toHaveProperty('tty');
    });
  });

  describe('unregisterCli', () => {
    it('removes the lock file', async () => {
      const { registerCli, unregisterCli } = await loadModule();
      registerCli();
      unregisterCli();

      const files = readdirSync(tmpDir);
      expect(files.filter((f: string) => f.endsWith('.lock'))).toHaveLength(0);
    });

    it('does not throw if file already gone', async () => {
      const { unregisterCli } = await loadModule();
      // Never registered, so no file exists
      expect(() => unregisterCli()).not.toThrow();
    });
  });

  describe('countActiveClis', () => {
    it('returns 1 after registerCli()', async () => {
      const { registerCli, countActiveClis } = await loadModule();
      registerCli();

      expect(countActiveClis()).toBe(1);
    });

    it('returns 0 after registerCli() + unregisterCli()', async () => {
      const { registerCli, unregisterCli, countActiveClis } = await loadModule();
      registerCli();
      unregisterCli();

      expect(countActiveClis()).toBe(0);
    });

    it('cleans up stale lock files with non-existent PID', async () => {
      const { countActiveClis } = await loadModule();

      // Create a fake lock with a PID that almost certainly doesn't exist
      const fakePid = 99999999;
      const fakeLock = path.join(tmpDir, `cli-${fakePid}.lock`);
      writeFileSync(
        fakeLock,
        JSON.stringify({ pid: fakePid, startedAt: new Date().toISOString(), tty: 'fake' }),
      );

      const count = countActiveClis();
      expect(count).toBe(0);

      // Stale lock file should have been removed
      const remaining = readdirSync(tmpDir).filter((f: string) => f.endsWith('.lock'));
      expect(remaining).toHaveLength(0);
    });
  });

  describe('isProcessAlive', () => {
    it('returns true for current process PID', async () => {
      const { isProcessAlive } = await loadModule();
      expect(isProcessAlive(process.pid)).toBe(true);
    });

    it('returns false for a very large PID (99999999)', async () => {
      const { isProcessAlive } = await loadModule();
      expect(isProcessAlive(99999999)).toBe(false);
    });
  });
});
