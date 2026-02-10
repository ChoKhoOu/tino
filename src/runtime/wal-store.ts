import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const SEGMENT_SIZE = 50;
const WAL_DIR = join('.tino', 'wal');

export interface WALEntry {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolId?: string;
  timestamp: number;
  tokenEstimate: number;
}

export class InMemoryWAL {
  private segments: WALEntry[][] = [];
  private activeSegment: WALEntry[] = [];
  private segmentTokenCounts: number[] = [];
  private activeTokenCount = 0;
  private flushedCount = 0;

  append(entry: Omit<WALEntry, 'timestamp' | 'tokenEstimate'>): void {
    const full: WALEntry = {
      ...entry,
      timestamp: Date.now(),
      tokenEstimate: Math.ceil(entry.content.length / 4),
    };
    this.activeSegment.push(full);
    this.activeTokenCount += full.tokenEstimate;

    if (this.activeSegment.length >= SEGMENT_SIZE) {
      this.sealActive();
    }
  }

  getMessages(limit?: number): WALEntry[] {
    const all = [...this.segments.flat(), ...this.activeSegment];
    if (limit === undefined || limit >= all.length) return all;
    return all.slice(all.length - limit);
  }

  getTokenCount(): number {
    let total = this.activeTokenCount;
    for (const count of this.segmentTokenCounts) total += count;
    return total;
  }

  prune(keepCount: number): number {
    const all = this.getAllEntries();
    if (all.length <= keepCount) return 0;

    const removed = all.length - keepCount;
    const kept = all.slice(removed);

    this.segments = [];
    this.segmentTokenCounts = [];
    this.activeSegment = [];
    this.activeTokenCount = 0;
    this.flushedCount = 0;

    for (const entry of kept) {
      this.activeSegment.push(entry);
      this.activeTokenCount += entry.tokenEstimate;
      if (this.activeSegment.length >= SEGMENT_SIZE) {
        this.sealActive();
      }
    }
    return removed;
  }

  async flush(): Promise<void> {
    try {
      if (!existsSync(WAL_DIR)) mkdirSync(WAL_DIR, { recursive: true });

      for (let i = this.flushedCount; i < this.segments.length; i++) {
        const path = join(WAL_DIR, `segment-${i}.jsonl`);
        const data = this.segments[i]!.map((e) => JSON.stringify(e)).join('\n') + '\n';
        writeFileSync(path, data, 'utf-8');
      }
      this.flushedCount = this.segments.length;
    } catch (err) {
      console.error('[WAL] flush error:', err);
    }
  }

  async recover(): Promise<void> {
    try {
      if (!existsSync(WAL_DIR)) return;

      const files = readdirSync(WAL_DIR)
        .filter((f) => f.startsWith('segment-') && f.endsWith('.jsonl'))
        .sort((a, b) => {
          const numA = parseInt(a.replace('segment-', '').replace('.jsonl', ''), 10);
          const numB = parseInt(b.replace('segment-', '').replace('.jsonl', ''), 10);
          return numA - numB;
        });

      this.clear();

      for (const file of files) {
        const content = readFileSync(join(WAL_DIR, file), 'utf-8');
        const entries = content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line) as WALEntry);

        if (entries.length > 0) {
          this.segments.push(entries);
          const tokens = entries.reduce((sum, e) => sum + e.tokenEstimate, 0);
          this.segmentTokenCounts.push(tokens);
        }
      }
      this.flushedCount = this.segments.length;
    } catch (err) {
      console.error('[WAL] recover error:', err);
    }
  }

  clear(): void {
    this.segments = [];
    this.activeSegment = [];
    this.segmentTokenCounts = [];
    this.activeTokenCount = 0;
    this.flushedCount = 0;
  }

  private sealActive(): void {
    this.segments.push(this.activeSegment);
    this.segmentTokenCounts.push(this.activeTokenCount);
    this.activeSegment = [];
    this.activeTokenCount = 0;
  }

  private getAllEntries(): WALEntry[] {
    return [...this.segments.flat(), ...this.activeSegment];
  }
}
