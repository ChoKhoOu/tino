export type PermissionMode = 'default' | 'auto-accept' | 'plan' | 'delegate';
export type PermissionDecision = 'allow' | 'ask' | 'deny';

export interface PermissionModeDescription {
  title: string;
  description: string;
}

export interface PermissionModeBehavior {
  fileEditTools: PermissionDecision | 'use-config';
  readTools: PermissionDecision | 'use-config';
  writeTools: PermissionDecision | 'use-config';
}

export const PERMISSION_MODE_ORDER: PermissionMode[] = ['default', 'auto-accept', 'plan', 'delegate'];

export const PERMISSION_MODE_DESCRIPTIONS: Record<PermissionMode, PermissionModeDescription> = {
  default: {
    title: 'Default',
    description: 'Use configured permission rules and prompt as needed.',
  },
  'auto-accept': {
    title: 'Auto Accept',
    description: 'Automatically allow file edits, but keep command execution guarded.',
  },
  plan: {
    title: 'Plan',
    description: 'Read-only mode: allow read tools and deny write tools.',
  },
  delegate: {
    title: 'Delegate',
    description: 'Reserved for delegate workflows; behavior currently follows default checks.',
  },
};

export const PERMISSION_MODE_BEHAVIOR: Record<PermissionMode, PermissionModeBehavior> = {
  default: { fileEditTools: 'use-config', readTools: 'use-config', writeTools: 'use-config' },
  'auto-accept': { fileEditTools: 'allow', readTools: 'use-config', writeTools: 'use-config' },
  plan: { fileEditTools: 'deny', readTools: 'allow', writeTools: 'deny' },
  delegate: { fileEditTools: 'use-config', readTools: 'use-config', writeTools: 'use-config' },
};

const FILE_EDIT_TOOLS = new Set(['edit_file', 'write_file']);

const READ_TOOLS = new Set([
  'read_file',
  'glob',
  'grep',
  'skill',
  'question',
  'web_search',
  'market_data',
  'fundamentals',
  'macro_data',
  'quant_compute',
  'portfolio',
  'chart',
]);

const WRITE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'bash',
  'todo_write',
  'task',
  'browser',
  'strategy_lab',
  'trading_sim',
  'trading_live',
  'streaming',
  'lsp',
]);

export function getNextPermissionMode(mode: PermissionMode): PermissionMode {
  const index = PERMISSION_MODE_ORDER.indexOf(mode);
  if (index < 0) {
    return 'default';
  }
  return PERMISSION_MODE_ORDER[(index + 1) % PERMISSION_MODE_ORDER.length];
}

export function isFileEditTool(toolId: string): boolean {
  return FILE_EDIT_TOOLS.has(toolId);
}

export function isReadTool(toolId: string): boolean {
  return READ_TOOLS.has(toolId);
}

export function isWriteTool(toolId: string): boolean {
  return WRITE_TOOLS.has(toolId) || !isReadTool(toolId);
}

export function resolvePermissionModeDecision(
  mode: PermissionMode,
  toolId: string,
  baseDecision: PermissionDecision,
): PermissionDecision {
  if (mode === 'auto-accept' && isFileEditTool(toolId)) {
    return 'allow';
  }

  if (mode === 'plan') {
    return isReadTool(toolId) ? 'allow' : 'deny';
  }

  return baseDecision;
}
