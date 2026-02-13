import { describe, test, expect } from 'bun:test';
import type { RunEvent } from '@/domain/events.js';
import type { Checkpoint } from '../types.js';
import { AutoCheckpointer, FILE_MODIFYING_TOOLS } from '../auto-checkpoint.js';

interface CreateCheckpointLike {
  createCheckpoint(
    turnIndex: number,
    history: Array<Record<string, unknown>>,
    events: RunEvent[],
  ): Promise<Checkpoint | null>;
}

function makeCheckpoint(turnIndex: number): Checkpoint {
  return {
    id: `cp_${turnIndex}`,
    timestamp: new Date(0).toISOString(),
    turnIndex,
    files: [{ path: '.', gitRef: 'abc123' }],
    conversation: {
      history: [],
      runtime: { events: [], answer: '', status: 'done' },
    },
  };
}

describe('AutoCheckpointer', () => {
  test('classifies file-modifying tools conservatively', () => {
    const manager: CreateCheckpointLike = {
      createCheckpoint: async () => makeCheckpoint(1),
    };
    const checkpointer = new AutoCheckpointer(manager);

    for (const token of FILE_MODIFYING_TOOLS) {
      expect(checkpointer.shouldCheckpoint(`tool_${token}_action`)).toBe(true);
    }

    expect(checkpointer.shouldCheckpoint('edit_file')).toBe(true);
    expect(checkpointer.shouldCheckpoint('write_file')).toBe(true);
    expect(checkpointer.shouldCheckpoint('delete_file')).toBe(true);
    expect(checkpointer.shouldCheckpoint('bash')).toBe(true);
    expect(checkpointer.shouldCheckpoint('read_file')).toBe(false);
    expect(checkpointer.shouldCheckpoint('search_code')).toBe(false);
  });

  test('creates checkpoint for matching tools', async () => {
    let calls = 0;
    const manager: CreateCheckpointLike = {
      createCheckpoint: async (turnIndex) => {
        calls += 1;
        return makeCheckpoint(turnIndex);
      },
    };
    const checkpointer = new AutoCheckpointer(manager, () => 1_000);

    const checkpoint = await checkpointer.maybeCheckpoint('edit_file', 7, [], []);

    expect(calls).toBe(1);
    expect(checkpoint?.turnIndex).toBe(7);
  });

  test('debounces checkpoints to once per 5 seconds', async () => {
    let now = 1_000;
    let calls = 0;
    const manager: CreateCheckpointLike = {
      createCheckpoint: async (turnIndex) => {
        calls += 1;
        return makeCheckpoint(turnIndex);
      },
    };
    const checkpointer = new AutoCheckpointer(manager, () => now);

    const first = await checkpointer.maybeCheckpoint('write_file', 1, [], []);
    now = 5_999;
    const second = await checkpointer.maybeCheckpoint('write_file', 2, [], []);
    now = 6_000;
    const third = await checkpointer.maybeCheckpoint('write_file', 3, [], []);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(third).not.toBeNull();
    expect(calls).toBe(2);
  });
});
