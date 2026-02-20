import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DaemonManager } from './manager.js';

const TEST_BASE = join(tmpdir(), `tino-test-daemon-${Date.now()}`);

function createTestProject(): string {
  const projectDir = join(TEST_BASE, `proj-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(projectDir, '.tino'), { recursive: true });
  return projectDir;
}

beforeEach(() => {
  mkdirSync(TEST_BASE, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('DaemonManager', () => {
  test('constructor sets correct PID file path', () => {
    const projectDir = createTestProject();
    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
    });
    expect(manager.getPidFilePath()).toBe(join(projectDir, '.tino', 'daemon.pid'));
  });

  test('healthCheck returns not running when no process', async () => {
    const projectDir = createTestProject();
    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
    });
    const status = await manager.healthCheck();
    expect(status.running).toBe(false);
    expect(status.pid).toBeNull();
    expect(status.port).toBe(50051);
  });

  test('healthCheck uses custom port', async () => {
    const projectDir = createTestProject();
    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
      port: 9999,
    });
    const status = await manager.healthCheck();
    expect(status.port).toBe(9999);
  });

  test('healthCheck detects stale PID file as not running', async () => {
    const projectDir = createTestProject();
    // Write a PID that doesn't exist (99999999 is very unlikely to be a real PID)
    writeFileSync(join(projectDir, '.tino', 'daemon.pid'), '99999999');

    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
    });
    const status = await manager.healthCheck();
    expect(status.running).toBe(false);
    expect(status.pid).toBeNull();
  });

  test('stop is safe to call when no process is running', async () => {
    const projectDir = createTestProject();
    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
    });
    // Should not throw
    await manager.stop();
  });

  test('stop cleans up stale PID file', async () => {
    const projectDir = createTestProject();
    const pidPath = join(projectDir, '.tino', 'daemon.pid');
    writeFileSync(pidPath, '99999999');
    expect(existsSync(pidPath)).toBe(true);

    const manager = new DaemonManager({
      projectDir,
      daemonPkgDir: '/tmp/fake-daemon',
    });
    await manager.stop();
    expect(existsSync(pidPath)).toBe(false);
  });
});
