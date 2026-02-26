import { writeFileSync, unlinkSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CLI_LOCK_DIR, ensureDir } from './paths.js';

interface LockInfo {
  pid: number;
  startedAt: string;
  tty: string;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function registerCli(): void {
  ensureDir(CLI_LOCK_DIR);
  const lockFile = path.join(CLI_LOCK_DIR, `cli-${process.pid}.lock`);
  const info: LockInfo = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    tty: process.stdout.isTTY ? (process.env.TTY || String(process.pid)) : 'non-tty',
  };
  writeFileSync(lockFile, JSON.stringify(info, null, 2), { mode: 0o600 });
}

export function unregisterCli(): void {
  const lockFile = path.join(CLI_LOCK_DIR, `cli-${process.pid}.lock`);
  try {
    unlinkSync(lockFile);
  } catch {
    // Already gone — ignore
  }
}

export function countActiveClis(): number {
  ensureDir(CLI_LOCK_DIR);
  let count = 0;

  let entries: string[];
  try {
    entries = readdirSync(CLI_LOCK_DIR);
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.lock')) continue;

    const filePath = path.join(CLI_LOCK_DIR, entry);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as LockInfo;
      if (isProcessAlive(data.pid)) {
        count++;
      } else {
        // Stale lock — clean up
        try {
          unlinkSync(filePath);
        } catch {
          // Ignore cleanup failure
        }
      }
    } catch {
      // Corrupt lock file — remove
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore
      }
    }
  }

  return count;
}
