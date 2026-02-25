import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { DaemonClient } from '@/grpc/daemon-client.js';
import { readPidFile, writePidFile, removePidFile, isProcessAlive } from './pid-file.js';

const DEFAULT_PORT = 50051;
const SIGKILL_TIMEOUT_MS = 5_000;
const RESTART_BASE_DELAY_MS = 1_000;
const MAX_RESTART_ATTEMPTS = 5;
const DOCKER_IMAGE = 'ghcr.io/ouzhuohao/tino/daemon:latest';
const DOCKER_CONTAINER_NAME = 'tino-daemon';

export type DaemonBackend = 'local' | 'docker';

export interface DaemonManagerOptions {
  projectDir: string;
  daemonPkgDir: string;
  port?: number;
  autoRestart?: boolean;
  backend?: DaemonBackend;
  dockerImage?: string;
}

export interface DaemonStatus {
  running: boolean;
  pid: number | null;
  port: number;
  backend: DaemonBackend;
}

export class DaemonManager {
  private readonly projectDir: string;
  private readonly daemonPkgDir: string;
  private readonly port: number;
  private readonly autoRestart: boolean;
  private readonly pidFilePath: string;
  private readonly backend: DaemonBackend;
  private readonly dockerImage: string;

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private stopping = false;
  private restartCount = 0;
  private grpcClient: DaemonClient | null = null;

  constructor(options: DaemonManagerOptions) {
    this.projectDir = resolve(options.projectDir);
    this.daemonPkgDir = resolve(options.daemonPkgDir);
    this.port = options.port ?? DEFAULT_PORT;
    this.autoRestart = options.autoRestart ?? true;
    this.backend = options.backend ?? 'local';
    this.dockerImage = options.dockerImage ?? DOCKER_IMAGE;
    this.pidFilePath = existsSync(join(this.projectDir, '.tino'))
      ? join(this.projectDir, '.tino', 'daemon.pid')
      : join(homedir(), '.tino', 'daemon.pid');
  }

  async start(): Promise<void> {
    if (this.backend === 'docker') {
      await this.startDocker();
      return;
    }

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
    if (this.backend === 'docker') {
      await this.stopDocker();
      return;
    }

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
    if (this.backend === 'docker') {
      return this.healthCheckDocker();
    }

    const pid = this.proc?.pid ?? readPidFile(this.pidFilePath);
    const processAlive = pid !== null && isProcessAlive(pid);

    if (!processAlive) {
      return { running: false, pid: null, port: this.port, backend: 'local' };
    }

    // Try gRPC health check for authoritative status
    try {
      if (!this.grpcClient) {
        this.grpcClient = new DaemonClient({ port: this.port });
      }
      const result = await this.grpcClient.healthCheck();
      return { running: result?.healthy ?? false, pid, port: this.port, backend: 'local' };
    } catch {
      // gRPC failed but process is alive — report as running (starting up)
      return { running: processAlive, pid, port: this.port, backend: 'local' };
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

  // ------- Docker backend -------

  private async startDocker(): Promise<void> {
    // Check if container is already running
    const inspectResult = Bun.spawnSync(
      ['docker', 'inspect', '--format', '{{.State.Running}}', DOCKER_CONTAINER_NAME],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    if (inspectResult.exitCode === 0 && inspectResult.stdout.toString().trim() === 'true') {
      return; // Already running
    }

    // Remove stopped container if it exists
    Bun.spawnSync(['docker', 'rm', '-f', DOCKER_CONTAINER_NAME], { stdout: 'ignore', stderr: 'ignore' });

    const dataDir = join(homedir(), '.tino', 'data');
    const args = [
      'docker', 'run', '-d',
      '--name', DOCKER_CONTAINER_NAME,
      '-p', `${this.port}:50051`,
      '-v', `${dataDir}:/home/tino/.tino/data`,
      '-e', `TINO_DAEMON_PORT=50051`,
      '--restart', 'unless-stopped',
      this.dockerImage,
    ];

    const result = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start Docker container: ${result.stderr.toString()}`);
    }
  }

  private async stopDocker(): Promise<void> {
    Bun.spawnSync(
      ['docker', 'stop', DOCKER_CONTAINER_NAME],
      { stdout: 'ignore', stderr: 'ignore' },
    );
    Bun.spawnSync(
      ['docker', 'rm', DOCKER_CONTAINER_NAME],
      { stdout: 'ignore', stderr: 'ignore' },
    );
    this.grpcClient = null;
  }

  private async healthCheckDocker(): Promise<DaemonStatus> {
    const result = Bun.spawnSync(
      ['docker', 'inspect', '--format', '{{.State.Running}}', DOCKER_CONTAINER_NAME],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    const containerRunning = result.exitCode === 0 && result.stdout.toString().trim() === 'true';

    if (!containerRunning) {
      return { running: false, pid: null, port: this.port, backend: 'docker' };
    }

    // Try gRPC health check for authoritative status
    try {
      if (!this.grpcClient) {
        this.grpcClient = new DaemonClient({ port: this.port });
      }
      const grpcResult = await this.grpcClient.healthCheck();
      return { running: grpcResult?.healthy ?? false, pid: null, port: this.port, backend: 'docker' };
    } catch {
      // Container running but gRPC not ready — still starting up
      return { running: true, pid: null, port: this.port, backend: 'docker' };
    }
  }

  static isDockerAvailable(): boolean {
    try {
      const result = Bun.spawnSync(['docker', 'info'], { stdout: 'ignore', stderr: 'ignore' });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

}
