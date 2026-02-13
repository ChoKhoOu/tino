import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { RunEvent } from '@/domain/events.js';
import { CheckpointManager } from '../manager.js';

function makeEvents(turn: number): RunEvent[] {
  return [
    { type: 'thinking', message: `Thinking ${turn}` },
    { type: 'answer_delta', delta: `Result ${turn}` },
  ];
}

function makeHistory(turn: number): Array<Record<string, unknown>> {
  return [
    {
      id: `h_${turn}`,
      query: `Question ${turn}`,
      answer: `Answer ${turn}`,
      status: 'complete',
      events: makeEvents(turn),
    },
  ];
}

describe('CheckpointManager', () => {
  let rootDir: string;
  let manager: CheckpointManager;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'tino-checkpoint-test-'));
    manager = new CheckpointManager(rootDir);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  test('creates checkpoint file with file and conversation state', async () => {
    const checkpoint = await manager.createCheckpoint(3, makeHistory(3), makeEvents(3));

    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.id).toMatch(/^cp_\d+_3$/);
    expect(checkpoint?.turnIndex).toBe(3);
    expect(checkpoint?.files.length).toBeGreaterThan(0);
    expect(checkpoint?.conversation.runtime.answer).toBe('Result 3');
    expect(checkpoint?.conversation.runtime.status).toBe('done');

    const path = join(rootDir, '.tino', 'checkpoints', `${checkpoint?.id}.json`);
    expect(existsSync(path)).toBe(true);
  });

  test('lists checkpoints sorted by newest first', async () => {
    const older = await manager.createCheckpoint(1, makeHistory(1), makeEvents(1));
    const newer = await manager.createCheckpoint(2, makeHistory(2), makeEvents(2));

    expect(older).not.toBeNull();
    expect(newer).not.toBeNull();
    if (!older || !newer) throw new Error('Expected checkpoints to be created');

    const checkpoints = await manager.listCheckpoints();
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]?.id).toBe(newer.id);
    expect(checkpoints[1]?.id).toBe(older.id);
  });

  test('retrieves and deletes a specific checkpoint', async () => {
    const created = await manager.createCheckpoint(5, makeHistory(5), makeEvents(5));
    expect(created).not.toBeNull();

    const found = await manager.getCheckpoint(created!.id);
    expect(found?.id).toBe(created?.id);

    const deleted = await manager.deleteCheckpoint(created!.id);
    expect(deleted).toBe(true);
    expect(await manager.getCheckpoint(created!.id)).toBeNull();
  });

  test('cleanup removes oldest checkpoints beyond maxCount', async () => {
    for (let i = 0; i < 4; i += 1) {
      await manager.createCheckpoint(i, makeHistory(i), makeEvents(i));
    }

    const removed = await manager.cleanup(2);
    expect(removed).toBe(2);

    const checkpoints = await manager.listCheckpoints();
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints.every((cp) => cp.turnIndex >= 2)).toBe(true);
  });

  test('auto-cleans to 50 checkpoints after create', async () => {
    for (let i = 0; i < 55; i += 1) {
      await manager.createCheckpoint(i, makeHistory(i), makeEvents(i));
    }

    const checkpoints = await manager.listCheckpoints();
    expect(checkpoints).toHaveLength(50);
    expect(checkpoints.some((cp) => cp.turnIndex === 0)).toBe(false);
    expect(checkpoints.some((cp) => cp.turnIndex === 54)).toBe(true);
  });
});
