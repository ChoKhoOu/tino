import type { SlashAction } from '@/commands/slash.js';

interface CompactResult {
  removed: number;
  kept: number;
}

export interface ExtendedSlashDeps {
  compact: () => CompactResult | null;
  getContextSummary: () => string;
  getCostSummary: () => string;
  getTodosSummary: () => string;
  rewind: () => boolean;
  getStatusSummary: () => string;
  getPermissionsSummary: () => string;
  getMcpSummary: () => string;
  getConfigSummary: () => string;
  renameSession: (name: string) => Promise<boolean>;
  resumeSession: (sessionId?: string) => Promise<string>;
  exportSession: (target?: string) => Promise<string>;
}

export async function runExtendedSlashAction(
  action: SlashAction,
  args: string[],
  deps: ExtendedSlashDeps,
): Promise<string | null> {
  switch (action) {
    case 'compact': {
      const result = deps.compact();
      if (!result) {
        return 'Context compaction is available during active sessions only.';
      }
      return `Context compacted. Removed ${result.removed} messages, kept ${result.kept}.`;
    }
    case 'context':
      return deps.getContextSummary();
    case 'cost':
      return deps.getCostSummary();
    case 'todos':
      return deps.getTodosSummary();
    case 'rewind':
      return deps.rewind() ? 'Removed the last completed turn.' : 'No completed turn to rewind.';
    case 'status':
      return deps.getStatusSummary();
    case 'permissions':
      return deps.getPermissionsSummary();
    case 'mcp':
      return deps.getMcpSummary();
    case 'config':
      return deps.getConfigSummary();
    case 'rename': {
      if (args.length === 0) return 'Usage: /rename <name>';
      const name = args.join(' ').trim();
      if (!name) return 'Usage: /rename <name>';
      const renamed = await deps.renameSession(name);
      return renamed ? `Session renamed to "${name}".` : 'Failed to rename session.';
    }
    case 'resume':
      return deps.resumeSession(args[0]);
    case 'export':
      return deps.exportSession(args[0]);
    case 'model':
    case 'clear':
    case 'skill':
    case 'help':
    case 'exit':
      return null;
  }
}
