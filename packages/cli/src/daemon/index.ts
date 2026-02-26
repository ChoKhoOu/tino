export { TINO_RUN_DIR, CLI_LOCK_DIR, ENGINE_PID_FILE, ENGINE_LOG_FILE, SHUTDOWN_LOCK_FILE, ENGINE_PORT, ensureDir } from './paths.js';
export { registerCli, unregisterCli, countActiveClis, isProcessAlive } from './lock-manager.js';
export { isEngineRunning, waitForEngine } from './health-checker.js';
export { spawnEngine, shutdownEngine } from './engine-spawner.js';
export { startEngineWatchdog, setShuttingDown } from './engine-watchdog.js';
export { DaemonManager } from './manager.js';
export { findMonorepoRoot, resolveEnginePaths } from './root-finder.js';
export type { EnginePaths } from './root-finder.js';
