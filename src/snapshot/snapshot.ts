import { existsSync } from 'fs';
import { mkdir, copyFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

export interface SnapshotEntry {
  id: string;
  filePath: string;
  timestamp: string;
}

async function git(args: string[], cwd: string): Promise<{ ok: boolean; stdout: string }> {
  try {
    const proc = Bun.spawn(['git', ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    });
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    return { ok: exitCode === 0, stdout: stdout.trim() };
  } catch {
    return { ok: false, stdout: '' };
  }
}

export class SnapshotManager {
  private readonly dir: string;

  constructor(snapshotDir?: string) {
    this.dir = snapshotDir ?? join(process.cwd(), '.tino', 'snapshots');
  }

  async init(): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      if (!existsSync(join(this.dir, '.git'))) {
        await git(['init', '--initial-branch=main'], this.dir);
        await git(['config', 'user.email', 'tino-snapshot@local'], this.dir);
        await git(['config', 'user.name', 'Tino Snapshot'], this.dir);
      }
    } catch {}
  }

  async createSnapshot(filePath: string): Promise<string | null> {
    try {
      if (!existsSync(join(this.dir, '.git'))) return null;
      if (!existsSync(filePath)) return null;

      const destPath = join(this.dir, filePath);
      await mkdir(dirname(destPath), { recursive: true });
      await copyFile(filePath, destPath);

      const timestamp = new Date().toISOString();
      await git(['add', '-A'], this.dir);
      const msg = `snapshot: ${filePath} at ${timestamp}`;
      const result = await git(['commit', '-m', msg, '--allow-empty-message'], this.dir);
      if (!result.ok) return null;

      const log = await git(['log', '-1', '--format=%H'], this.dir);
      return log.ok ? log.stdout : null;
    } catch {
      return null;
    }
  }

  async listSnapshots(): Promise<SnapshotEntry[]> {
    try {
      if (!existsSync(join(this.dir, '.git'))) return [];

      const result = await git(
        ['log', '--format=%H||%s||%aI', '--no-merges'],
        this.dir,
      );
      if (!result.ok || !result.stdout) return [];

      return result.stdout.split('\n').filter(Boolean).map((line) => {
        const [id, subject, timestamp] = line.split('||');
        const fileMatch = subject.match(/^snapshot: (.+) at /);
        return {
          id,
          filePath: fileMatch?.[1] ?? '',
          timestamp,
        };
      });
    } catch {
      return [];
    }
  }

  async restoreSnapshot(snapshotId: string, filePath: string): Promise<boolean> {
    try {
      if (!existsSync(join(this.dir, '.git'))) return false;

      const relPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const result = await git(['show', `${snapshotId}:${relPath}`], this.dir);
      if (!result.ok) return false;

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, result.stdout);
      return true;
    } catch {
      return false;
    }
  }

  async cleanOldSnapshots(maxAgeDays: number = 7): Promise<number> {
    try {
      if (!existsSync(join(this.dir, '.git'))) return 0;

      const entries = await this.listSnapshots();
      if (entries.length === 0) return 0;

      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      const oldEntries = entries.filter((e) => new Date(e.timestamp).getTime() < cutoff);
      if (oldEntries.length === 0) return 0;

      const keepCount = entries.length - oldEntries.length;
      if (keepCount <= 0) {
        await git(['checkout', '--orphan', 'temp-clean'], this.dir);
        await git(['commit', '--allow-empty', '-m', 'clean slate'], this.dir);
        await git(['branch', '-D', 'main'], this.dir);
        await git(['branch', '-D', 'master'], this.dir);
        await git(['branch', '-m', 'main'], this.dir);
      }

      return oldEntries.length;
    } catch {
      return 0;
    }
  }
}
