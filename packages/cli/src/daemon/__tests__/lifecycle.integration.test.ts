import { describe, it, expect, afterAll } from 'vitest';
import { spawnEngine, shutdownEngine } from '../engine-spawner.js';
import { isEngineRunning, waitForEngine } from '../health-checker.js';
import { findMonorepoRoot, resolveEnginePaths } from '../root-finder.js';
import { ENGINE_PID_FILE, ENGINE_PORT } from '../paths.js';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';

/**
 * Check whether a TCP port is already in use.
 * Resolves `true` when something is listening, `false` otherwise.
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

let engineSpawned = false;

describe('daemon lifecycle integration', { timeout: 30_000 }, () => {
  // Always clean up — even on test failure
  afterAll(async () => {
    if (engineSpawned) {
      try {
        await shutdownEngine();
      } catch {
        // best-effort cleanup
      }
    }
  });

  it('spawn → health check → shutdown → exits cleanly', async () => {
    // ── Prerequisites ────────────────────────────────────────────────────
    const root = findMonorepoRoot();
    const { pythonPath, engineDir, dashboardDist } = resolveEnginePaths(root);

    // Skip if the Python environment has not been set up
    if (!existsSync(pythonPath)) {
      console.log(`Skipping: Python not found at ${pythonPath}`);
      return;
    }

    // Skip if port is already occupied
    if (await isPortInUse(ENGINE_PORT)) {
      console.log(`Skipping: port ${ENGINE_PORT} is already in use`);
      return;
    }

    // ── 1. Spawn engine ──────────────────────────────────────────────────
    const pid = spawnEngine(pythonPath, engineDir, dashboardDist);
    engineSpawned = true;
    expect(pid).toBeGreaterThan(0);

    // ── 2. Wait for engine to become healthy ─────────────────────────────
    await waitForEngine(20_000);

    // ── 3. isEngineRunning should return true ────────────────────────────
    const running = await isEngineRunning();
    expect(running).toBe(true);

    // ── 4. Direct HTTP health check ──────────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`http://127.0.0.1:${ENGINE_PORT}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; engine_version?: string };
    expect(body.status).toBe('healthy');
    expect(typeof body.engine_version).toBe('string');

    // ── 5. Graceful shutdown ─────────────────────────────────────────────
    await shutdownEngine();
    engineSpawned = false;

    // ── 6. Engine should no longer be running ────────────────────────────
    const stillRunning = await isEngineRunning();
    expect(stillRunning).toBe(false);

    // ── 7. PID file should be cleaned up ─────────────────────────────────
    expect(existsSync(ENGINE_PID_FILE)).toBe(false);
  });
});
