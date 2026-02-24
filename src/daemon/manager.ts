import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { DaemonClient } from '@/grpc/daemon-client.js';
import { readPidFile, writePidFile, removePidFile, isProcessAlive } from './pid-file.js';

const DEFAULT_PORT = 50051;
const SIGKILL_TIMEOUT_MS = 5_000;
const RESTART_BASE_DELAY_MS = 1_000;
const MAX_RESTART_ATTEMPTS = 5;

export interface DaemonManagerOptions {
  projectDir: string;
  daemonPkgDir: string;
  port?: number;
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
  private grpcClient: DaemonClient | null = null;

  constructor(options: DaemonManagerOptions) {
    this.projectDir = resolve(options.projectDir);
    this.daemonPkgDir = resolve(options.daemonPkgDir);
    this.port = options.port ?? DEFAULT_PORT;
    this.autoRestart = options.autoRestart ?? true;
    this.pidFilePath = existsSync(join(this.projectDir, '.tino'))
      ? join(this.projectDir, '.tino', 'daemon.pid')
      : join(homedir(), '.tino', 'daemon.pid');
  }

  async start(): Promise<void> {
    // Check if already running
    if (this.proc) {
      return;
    }

    // Check for stale PID file
    const stalePid = readPidFile(this.pidFilePath);
    if (stalePid !== null) {
      if (isProcessAlive(stalePid)) {
        // Already running externally — adopt it
        return;
      }
      // Stale PID file — clean up
      removePidFile(this.pidFilePath);
    }

    this.stopping = false;
    this.restartCount = 0;
    await this.spawnDaemon();
  }

  async stop(): Promise<void> {
    this.stopping = true;

    const pid = this.proc?.pid ?? readPidFile(this.pidFilePath);
    if (pid === null) {
      this.proc = null;
      removePidFile(this.pidFilePath);
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

  async healthCheck(): Promise<DaemonStatus> {
    const pid = this.proc?.pid ?? readPidFile(this.pidFilePath);
    const processAlive = pid !== null && isProcessAlive(pid);

    if (!processAlive) {
      return { running: false, pid: null, port: this.port };
    }

    // Try gRPC health check for authoritative status
    try {
      if (!this.grpcClient) {
        this.grpcClient = new DaemonClient({ port: this.port });
      }
      const result = await this.grpcClient.healthCheck();
      return { running: result?.healthy ?? false, pid, port: this.port };
    } catch {
      // gRPC failed but process is alive — report as running (starting up)
      return { running: processAlive, pid, port: this.port };
    }
  }

  getPidFilePath(): string {
    return this.pidFilePath;
  }

  // ------- Private -------

  private buildSpawnCommand(): string[] {
    const bundledPython = join(this.daemonPkgDir, 'runtime', 'bin', 'python3.12');
    if (existsSync(bundledPython)) {
      return [bundledPython, '-m', 'tino_daemon', '--port', String(this.port)];
    }
    return ['uv', 'run', '--python', '3.12', 'python', '-m', 'tino_daemon', '--port', String(this.port)];
  }

  private async spawnDaemon(): Promise<void> {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TINO_DAEMON_PORT: String(this.port),
      TINO_DAEMON_PID_FILE: this.pidFilePath,
    };

    this.proc = Bun.spawn(
      this.buildSpawnCommand(),
      {
        cwd: this.daemonPkgDir,
        env,
        stdout: 'ignore',
        stderr: 'ignore',
      },
    );

    // Write PID file
    writePidFile(this.pidFilePath, this.proc.pid);

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

      // Unexpected crash — auto-restart with exponential backoff
      if (this.autoRestart && this.restartCount < MAX_RESTART_ATTEMPTS) {
        const delayMs = RESTART_BASE_DELAY_MS * Math.pow(2, this.restartCount);
        this.restartCount++;
        setTimeout(() => {
          if (!this.stopping) {
            this.spawnDaemon();
          }
        }, delayMs);
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
    this.grpcClient = null;
    removePidFile(this.pidFilePath);
  }

}
