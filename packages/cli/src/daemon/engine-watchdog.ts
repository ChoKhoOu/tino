import lockfile from 'proper-lockfile';
import { isEngineRunning, waitForEngine } from './health-checker.js';
import { spawnEngine } from './engine-spawner.js';
import { SHUTDOWN_LOCK_FILE, TINO_RUN_DIR, ensureDir } from './paths.js';

interface WatchdogConfig {
  pythonPath: string;
  engineDir: string;
  dashboardDist?: string;
}

let _shuttingDown = false;

export function setShuttingDown(value: boolean): void {
  _shuttingDown = value;
}

export function startEngineWatchdog(
  config: WatchdogConfig,
  onCrash: (error: Error) => void,
  onRecover: () => void,
  intervalMs = 10000,
  onReconnecting?: () => void,
): () => void {
  const timer = setInterval(async () => {
    if (_shuttingDown) return;
    try {
      const running = await isEngineRunning();
      if (!running) {
        onReconnecting?.();
        ensureDir(TINO_RUN_DIR);
        let release: (() => Promise<void>) | undefined;
        try {
          release = await lockfile.lock(SHUTDOWN_LOCK_FILE, {
            retries: { retries: 3, minTimeout: 200 },
          });

          // Double-check after acquiring lock — another watchdog may have already restarted
          const stillDown = !(await isEngineRunning());
          if (stillDown) {
            spawnEngine(config.pythonPath, config.engineDir, config.dashboardDist);
            await waitForEngine();
            onRecover();
          } else {
            // Engine was restarted by another instance, just recover
            onRecover();
          }
        } catch (err) {
          onCrash(err instanceof Error ? err : new Error(String(err)));
        } finally {
          if (release) {
            try { await release(); } catch { /* lock release best-effort */ }
          }
        }
      }
    } catch (err) {
      onCrash(err instanceof Error ? err : new Error(String(err)));
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
