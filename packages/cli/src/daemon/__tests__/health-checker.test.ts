import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpPidFile: string;
let tmpDir: string;

vi.mock('../paths.js', () => {
  return {
    get ENGINE_PID_FILE() {
      return tmpPidFile;
    },
    get CLI_LOCK_DIR() {
      return path.join(tmpDir, 'cli');
    },
    ensureDir(dir: string) {
      mkdirSync(dir, { recursive: true });
    },
  };
});

async function loadModule() {
  vi.resetModules();
  return await import('../health-checker.js');
}

describe('health-checker', () => {
  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `tino-health-test-${process.pid}-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    tmpPidFile = path.join(tmpDir, 'engine.pid');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('isEngineRunning', () => {
    it('returns false when no PID file exists', async () => {
      const { isEngineRunning } = await loadModule();
      const result = await isEngineRunning();
      expect(result).toBe(false);
    });

    it('returns false when PID file has dead PID', async () => {
      writeFileSync(
        tmpPidFile,
        JSON.stringify({
          pid: 99999999,
          port: 8000,
          startedAt: new Date().toISOString(),
          pythonPath: '/usr/bin/python3',
          token: 'test-token',
        }),
      );

      const { isEngineRunning } = await loadModule();
      const result = await isEngineRunning();
      expect(result).toBe(false);
    });
  });

  describe('waitForEngine', () => {
    it('throws after timeout when engine never starts', async () => {
      const { waitForEngine } = await loadModule();
      // Use a short timeout to keep the test fast
      await expect(waitForEngine(1000)).rejects.toThrow(
        'Engine did not become healthy within 1000ms',
      );
    });
  });
});
