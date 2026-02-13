import type { RunEvent } from '@/domain/events.js';
import type { Checkpoint } from './types.js';
import type { CheckpointManager } from './manager.js';

export const FILE_MODIFYING_TOOLS = ['edit', 'write', 'delete', 'bash'] as const;

const DEBOUNCE_MS = 5_000;

type CheckpointCreator = Pick<CheckpointManager, 'createCheckpoint'>;

export class AutoCheckpointer {
  private readonly manager: CheckpointCreator;
  private readonly now: () => number;
  private lastCheckpointAt: number | null;

  constructor(manager: CheckpointCreator, now: () => number = Date.now) {
    this.manager = manager;
    this.now = now;
    this.lastCheckpointAt = null;
  }

  shouldCheckpoint(toolId: string): boolean {
    const normalizedToolId = toolId.toLowerCase();
    return FILE_MODIFYING_TOOLS.some((token) => normalizedToolId.includes(token));
  }

  async maybeCheckpoint(
    toolId: string,
    turnIndex: number,
    history: Array<Record<string, unknown>>,
    events: RunEvent[],
  ): Promise<Checkpoint | null> {
    if (!this.shouldCheckpoint(toolId)) {
      return null;
    }

    const nowMs = this.now();
    if (this.lastCheckpointAt !== null && nowMs - this.lastCheckpointAt < DEBOUNCE_MS) {
      return null;
    }

    this.lastCheckpointAt = nowMs;
    return this.manager.createCheckpoint(turnIndex, history, events);
  }
}
