import lockfile from 'proper-lockfile';
import { SHUTDOWN_LOCK_FILE, TINO_RUN_DIR, ENGINE_PORT, ensureDir } from './paths.js';
import { registerCli, unregisterCli, countActiveClis } from './lock-manager.js';
import { isEngineRunning, waitForEngine } from './health-checker.js';
import { spawnEngine, shutdownEngine } from './engine-spawner.js';
import { writeFileSync } from 'node:fs';
import type { EnginePaths } from './root-finder.js';

export class DaemonManager {
  private readonly pythonPath: string;
  private readonly engineDir: string;
  private readonly dashboardDist: string | undefined;
  private readonly enginePort: number;

  constructor(paths: EnginePaths) {
    this.pythonPath = paths.pythonPath;
    this.engineDir = paths.engineDir;
    this.dashboardDist = paths.dashboardDist;
    this.enginePort = ENGINE_PORT;
  }

  registerCli(): void {
    registerCli();
  }

  unregisterCli(): void {
    unregisterCli();
  }

  async ensureEngine(): Promise<void> {
    const running = await isEngineRunning();
    if (running) return;

    spawnEngine(this.pythonPath, this.engineDir, this.dashboardDist);
    await waitForEngine();
  }

  async shutdownIfLastCli(): Promise<void> {
    ensureDir(TINO_RUN_DIR);

    // Ensure lock file exists so proper-lockfile can operate on it
    try {
      writeFileSync(SHUTDOWN_LOCK_FILE, '', { flag: 'wx', mode: 0o600 });
    } catch {
      // File already exists — fine
    }

    let release: (() => Promise<void>) | undefined;
    try {
      release = await lockfile.lock(SHUTDOWN_LOCK_FILE, { retries: 3 });
      unregisterCli();
      const activeCount = countActiveClis();
      if (activeCount === 0) {
        await shutdownEngine();
      }
    } finally {
      if (release) {
        try {
          await release();
        } catch {
          // Ignore release errors
        }
      }
    }
  }

  getEnginePort(): number {
    return this.enginePort;
  }
}
