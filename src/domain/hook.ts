export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'Stop';

export interface HookContext {
  event: HookEvent;
  toolId?: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface HookResult {
  allow?: boolean;
  message?: string;
}

export interface HookDefinition {
  event: HookEvent;
  type: 'command' | 'function';
  command?: string;
  fn?: (ctx: HookContext) => Promise<HookResult>;
}
