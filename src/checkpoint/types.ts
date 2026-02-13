import type { RunEvent } from '@/domain/events.js';

export interface FileSnapshot {
  path: string;
  content?: string;
  gitRef?: string;
}

export interface ConversationRuntimeSnapshot {
  events: RunEvent[];
  answer: string;
  status: string;
}

export interface ConversationSnapshot {
  history: Array<Record<string, unknown>>;
  runtime: ConversationRuntimeSnapshot;
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  turnIndex: number;
  files: FileSnapshot[];
  conversation: ConversationSnapshot;
}
