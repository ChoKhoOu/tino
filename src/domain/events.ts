import type { PermissionRule } from './permission.js';

export const SCHEMA_VERSION = 1 as const;

export interface ToolCallRecord {
  toolId: string;
  args: Record<string, unknown>;
  result: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ThinkingEvent {
  type: 'thinking';
  message: string;
}

export interface ToolStartEvent {
  type: 'tool_start';
  toolId: string;
  args: Record<string, unknown>;
}

export interface ToolProgressEvent {
  type: 'tool_progress';
  toolId: string;
  message: string;
}

export interface ToolEndEvent {
  type: 'tool_end';
  toolId: string;
  result: string;
  duration: number;
}

export interface ToolErrorEvent {
  type: 'tool_error';
  toolId: string;
  error: string;
}

export interface PermissionRequestEvent {
  type: 'permission_request';
  toolId: string;
  resource: string;
  rule: PermissionRule;
}

export interface PermissionResponseEvent {
  type: 'permission_response';
  toolId: string;
  allowed: boolean;
}

export interface ContextClearedEvent {
  type: 'context_cleared';
  clearedCount: number;
  keptCount: number;
}

export interface AnswerStartEvent {
  type: 'answer_start';
}

export interface AnswerDeltaEvent {
  type: 'answer_delta';
  delta: string;
}

export interface AnswerChunkEvent {
  type: 'answer_chunk';
  content: string;
}

export interface DoneEvent {
  type: 'done';
  answer: string;
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalTime: number;
  tokenUsage?: TokenUsage;
}

export type RunEvent =
  | ThinkingEvent
  | ToolStartEvent
  | ToolProgressEvent
  | ToolEndEvent
  | ToolErrorEvent
  | PermissionRequestEvent
  | PermissionResponseEvent
  | ContextClearedEvent
  | AnswerStartEvent
  | AnswerDeltaEvent
  | AnswerChunkEvent
  | DoneEvent;

export interface RunResult {
  answer: string;
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalTime: number;
  tokenUsage?: TokenUsage;
}

export function isRunEvent<T extends RunEvent['type']>(
  event: RunEvent,
  type: T,
): event is Extract<RunEvent, { type: T }> {
  return event.type === type;
}
