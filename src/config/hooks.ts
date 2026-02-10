import { existsSync, readFileSync } from 'fs';

const HOOKS_FILE = '.tino/hooks.json';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'Stop';

export interface HookDefinition {
  event: HookEvent;
  type: 'command' | 'function';
  command?: string;
}

export function loadHooks(): HookDefinition[] {
  if (!existsSync(HOOKS_FILE)) {
    return [];
  }

  try {
    const content = readFileSync(HOOKS_FILE, 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}
