import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

export function readPidFile(path: string): number | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePidFile(path: string, pid: number): void {
  try {
    writeFileSync(path, String(pid));
  } catch {
    // Non-fatal — daemon still runs without PID file
  }
}

export function removePidFile(path: string): void {
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Ignore
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
