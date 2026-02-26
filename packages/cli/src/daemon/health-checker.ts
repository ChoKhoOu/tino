import { readFileSync } from 'node:fs';
import { ENGINE_PID_FILE } from './paths.js';
import { isProcessAlive } from './lock-manager.js';

interface PidFileData {
  pid: number;
  port: number;
  startedAt: string;
  pythonPath: string;
  token: string;
}

interface HealthResponse {
  status: string;
  engine_version?: string;
}

export async function isEngineRunning(): Promise<boolean> {
  let pidData: PidFileData;
  try {
    pidData = JSON.parse(readFileSync(ENGINE_PID_FILE, 'utf-8')) as PidFileData;
  } catch {
    return false;
  }

  if (!isProcessAlive(pidData.pid)) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`http://127.0.0.1:${pidData.port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = (await response.json()) as HealthResponse;
    return data.status === 'healthy' && typeof data.engine_version === 'string';
  } catch {
    return false;
  }
}

export async function waitForEngine(maxWaitMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isEngineRunning()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Engine did not become healthy within ${maxWaitMs}ms`);
}
