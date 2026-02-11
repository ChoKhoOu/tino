/**
 * Daemon lifecycle manager.
 * Starts, stops, health-checks, and auto-restarts the Python tino_daemon process.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

/** Default gRPC port the daemon listens on */
const DEFAULT_PORT = 50051;

/** How long to wait for graceful SIGTERM shutdown before SIGKILL (ms) */
const SIGKILL_TIMEOUT_MS = 5_000;

/** Delay between auto-restart attempts (ms) */
const RESTART_DELAY_MS = 1_000;

/** Max consecutive restart attempts before giving up */
const MAX_RESTART_ATTEMPTS = 3;

export interface DaemonManagerOptions {
  /** Project root directory (containing .tino/) */
  projectDir: string;
  /** Path to tino daemon Python package (absolute) */
  daemonPkgDir: string;
  /** gRPC port (default 50051) */
  port?: number;
  /** Enable auto-restart on crash (default true) */
  autoRestart?: boolean;
}

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  port: number;
}

export class DaemonManager {
  private readonly projectDir: string;
  private readonly daemonPkgDir: string;
  private readonly port: number;
  private readonly autoRestart: boolean;
  private readonly pidFilePath: string;

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private stopping = false;
  private restartCount = 0;

  constructor(options: DaemonManagerOptions) {
    this.projectDir = resolve(options.projectDir);
    this.daemonPkgDir = resolve(options.daemonPkgDir);
    this.port = options.port ?? DEFAULT_PORT;
    this.autoRestart = options.autoRestart ?? true;
    this.pidFilePath = existsSync(join(this.projectDir, '.tino'))
      ? join(this.projectDir, '.tino', 'daemon.pid')
      : join(homedir(), '.tino', 'daemon.pid');
  }

  /**
   * Start the daemon process.
   * Uses `uv run --python 3.12 python -m tino_daemon` in the daemon package directory.
   */
  async start(): Promise<void> {
    // Check if already running
    if (this.proc) {
      return;
    }

    // Check for stale PID file
    const stalePid = this.readPidFile();
    if (stalePid !== null) {
      if (this.isProcessAlive(stalePid)) {
        // Already running externally — adopt it
        return;
      }
      // Stale PID file — clean up
      this.removePidFile();
    }

    this.stopping = false;
    this.restartCount = 0;
    await this.spawnDaemon();
  }

  /**
   * Graceful shutdown: SIGTERM → wait → SIGKILL → remove PID file.
   */
  async stop(): Promise<void> {
    this.stopping = true;

    const pid = this.proc?.pid ?? this.readPidFile();
    if (pid === null) {
      this.proc = null;
      this.removePidFile();
      return;
    }

    // Try SIGTERM first
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already gone
      this.cleanup();
      return;
    }

    // Wait for graceful exit with timeout
    const exited = await Promise.race([
      this.waitForExit().then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), SIGKILL_TIMEOUT_MS)),
    ]);

    if (!exited) {
      // Force kill
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Already gone
      }
    }

    this.cleanup();
  }

  /**
   * Check daemon health by verifying the process is alive.
   * For full gRPC health checks, connect to localhost:{port} (not implemented yet).
   */
  healthCheck(): DaemonStatus {
    const pid = this.proc?.pid ?? this.readPidFile();
    const running = pid !== null && this.isProcessAlive(pid);
    return {
      running,
      pid: running ? pid : null,
      port: this.port,
    };
  }

  /** Get the PID file path (for testing) */
  getPidFilePath(): string {
    return this.pidFilePath;
  }

  // ------- Private -------

  private async spawnDaemon(): Promise<void> {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TINO_DAEMON_PORT: String(this.port),
      TINO_DAEMON_PID_FILE: this.pidFilePath,
    };

    this.proc = Bun.spawn(
      ['uv', 'run', '--python', '3.12', 'python', '-m', 'tino_daemon', '--port', String(this.port)],
      {
        cwd: this.daemonPkgDir,
        env,
        stdout: 'ignore',
        stderr: 'ignore',
      },
    );

    // Write PID file
    this.writePidFile(this.proc.pid);

    // Monitor for exit — auto-restart if enabled
    this.monitorProcess();
  }

  private monitorProcess(): void {
    if (!this.proc) return;

    this.proc.exited.then(() => {
      // Process exited
      this.proc = null;

      if (this.stopping) {
        // Expected shutdown — don't restart
        return;
      }

      // Unexpected crash — auto-restart if enabled
      if (this.autoRestart && this.restartCount < MAX_RESTART_ATTEMPTS) {
        this.restartCount++;
        setTimeout(() => {
          if (!this.stopping) {
            this.spawnDaemon();
          }
        }, RESTART_DELAY_MS);
      }
    });
  }

  private async waitForExit(): Promise<void> {
    if (this.proc) {
      await this.proc.exited;
    }
  }

  private cleanup(): void {
    this.proc = null;
    this.removePidFile();
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 just checks existence
      return true;
    } catch {
      return false;
    }
  }

  private readPidFile(): number | null {
    try {
      if (!existsSync(this.pidFilePath)) return null;
      const content = readFileSync(this.pidFilePath, 'utf-8').trim();
      const pid = parseInt(content, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  private writePidFile(pid: number): void {
    try {
      writeFileSync(this.pidFilePath, String(pid));
    } catch {
      // Non-fatal — daemon still runs without PID file
    }
  }

  private removePidFile(): void {
    try {
      if (existsSync(this.pidFilePath)) {
        unlinkSync(this.pidFilePath);
      }
    } catch {
      // Ignore
    }
  }
}
