import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { ENGINE_PID_FILE, ENGINE_LOG_FILE, ENGINE_PORT, ensureDir, TINO_RUN_DIR } from './paths.js';
import { isProcessAlive } from './lock-manager.js';

interface PidFileData {
  pid: number;
  port: number;
  startedAt: string;
  pythonPath: string;
  token: string;
}

export function spawnEngine(
  pythonPath: string,
  engineDir: string,
  dashboardDist?: string,
): number {
  ensureDir(TINO_RUN_DIR);
  const logFd = openSync(ENGINE_LOG_FILE, 'a');
  const engineToken = randomBytes(32).toString('hex');

  const child = spawn(
    pythonPath,
    ['-m', 'uvicorn', 'src.main:app', '--host', '127.0.0.1', '--port', String(ENGINE_PORT)],
    {
      cwd: engineDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        ...(dashboardDist ? { TINO_DASHBOARD_DIST: dashboardDist } : {}),
        TINO_ENGINE_TOKEN: engineToken,
      },
    },
  );

  child.unref();

  if (!child.pid) {
    closeSync(logFd);
    throw new Error(`Failed to spawn engine process. Check logs at ${ENGINE_LOG_FILE}`);
  }

  const pidData: PidFileData = {
    pid: child.pid,
    port: ENGINE_PORT,
    startedAt: new Date().toISOString(),
    pythonPath,
    token: engineToken,
  };
  writeFileSync(ENGINE_PID_FILE, JSON.stringify(pidData, null, 2), { mode: 0o600 });

  closeSync(logFd);

  return child.pid;
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Process ${pid} did not exit within ${timeoutMs}ms`);
}

export async function shutdownEngine(): Promise<void> {
  let pidData: PidFileData;
  try {
    pidData = JSON.parse(readFileSync(ENGINE_PID_FILE, 'utf-8')) as PidFileData;
  } catch {
    return; // No PID file — nothing to shut down
  }

  const { pid, port, token } = pidData;

  try {
    // Graceful: POST /api/shutdown
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`http://127.0.0.1:${port}/api/shutdown`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    clearTimeout(timeout);
    await waitForProcessExit(pid, 5000);
  } catch {
    // Fallback: SIGTERM
    try {
      process.kill(pid, 'SIGTERM');
      await waitForProcessExit(pid, 3000);
    } catch {
      // Last resort: SIGKILL
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process already gone
      }
    }
  } finally {
    try {
      unlinkSync(ENGINE_PID_FILE);
    } catch {
      // Ignore
    }
  }
}
