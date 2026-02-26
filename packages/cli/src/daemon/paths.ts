import os, { platform } from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

if (platform() !== 'darwin') {
  console.warn('Warning: tino daemon currently only supports macOS. Some features may not work on ' + platform() + '.');
}

export const TINO_RUN_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'tino',
  'run',
);

export const CLI_LOCK_DIR = path.join(TINO_RUN_DIR, 'cli');
export const ENGINE_PID_FILE = path.join(TINO_RUN_DIR, 'engine.pid');
export const ENGINE_LOG_FILE = path.join(TINO_RUN_DIR, 'engine.log');
export const SHUTDOWN_LOCK_FILE = path.join(TINO_RUN_DIR, '.shutdown-lock');
export const ENGINE_PORT = parseInt(process.env.TINO_ENGINE_PORT || '8000', 10);

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}
