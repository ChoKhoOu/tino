import { readdir, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { RunEvent } from '@/domain/events.js';
import type { Checkpoint, FileSnapshot } from './types.js';

export class CheckpointManager {
  private readonly rootDir: string;
  private readonly checkpointDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.checkpointDir = join(rootDir, '.tino', 'checkpoints');
  }

  async createCheckpoint(
    turnIndex: number,
    history: Array<Record<string, unknown>>,
    events: RunEvent[],
  ): Promise<Checkpoint | null> {
    try {
      await mkdir(this.checkpointDir, { recursive: true });

      const timestampMs = Date.now();
      const checkpoint: Checkpoint = {
        id: `cp_${timestampMs}_${turnIndex}`,
        timestamp: new Date(timestampMs).toISOString(),
        turnIndex,
        files: [await this.captureFileState()],
        conversation: {
          history: this.toJsonSafe(history),
          runtime: {
            events: this.toJsonSafe(events),
            answer: this.extractAnswer(events),
            status: 'done',
          },
        },
      };

      const filePath = join(this.checkpointDir, `${checkpoint.id}.json`);
      await Bun.write(filePath, JSON.stringify(checkpoint));
      await this.cleanup(50);

      return checkpoint;
    } catch {
      return null;
    }
  }

  async listCheckpoints(): Promise<Checkpoint[]> {
    try {
      if (!existsSync(this.checkpointDir)) return [];

      const names = await readdir(this.checkpointDir);
      const checkpoints = await Promise.all(
        names
          .filter((name) => name.endsWith('.json'))
          .map(async (name) => {
            const parsed = await Bun.file(join(this.checkpointDir, name)).json();
            return parsed as Checkpoint;
          }),
      );

      return checkpoints.sort((a, b) => {
        const aTime = Date.parse(a.timestamp);
        const bTime = Date.parse(b.timestamp);
        return bTime - aTime;
      });
    } catch {
      return [];
    }
  }

  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    try {
      const file = Bun.file(join(this.checkpointDir, `${id}.json`));
      if (!(await file.exists())) return null;
      const parsed = await file.json();
      return parsed as Checkpoint;
    } catch {
      return null;
    }
  }

  async deleteCheckpoint(id: string): Promise<boolean> {
    try {
      await rm(join(this.checkpointDir, `${id}.json`), { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async cleanup(maxCount: number = 50): Promise<number> {
    try {
      const checkpoints = await this.listCheckpoints();
      if (checkpoints.length <= maxCount) return 0;

      const toDelete = checkpoints.slice(maxCount);
      await Promise.all(
        toDelete.map(async (cp) => {
          await this.deleteCheckpoint(cp.id);
        }),
      );

      return toDelete.length;
    } catch {
      return 0;
    }
  }

  private async captureFileState(): Promise<FileSnapshot> {
    const ref = await this.readGitHeadRef();
    return {
      path: '.',
      gitRef: ref,
    };
  }

  private async readGitHeadRef(): Promise<string | undefined> {
    try {
      const proc = Bun.spawn(['git', 'rev-parse', 'HEAD'], {
        cwd: this.rootDir,
        stdout: 'pipe',
        stderr: 'ignore',
        stdin: 'ignore',
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) return undefined;
      const output = await new Response(proc.stdout).text();
      const ref = output.trim();
      return ref || undefined;
    } catch {
      return undefined;
    }
  }

  private extractAnswer(events: RunEvent[]): string {
    let answer = '';
    for (const event of events) {
      if (event.type === 'answer_chunk') answer += event.content;
      if (event.type === 'answer_delta') answer += event.delta;
      if (event.type === 'done') answer = event.answer || answer;
    }
    return answer;
  }

  private toJsonSafe<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
