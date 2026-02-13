import { describe, expect, test } from 'bun:test';
import type { SlashAction } from '@/commands/slash.js';
import { runExtendedSlashAction } from './slash-command-actions.js';

function makeDeps() {
  let compacted = false;
  let rewound = false;
  let renamedTo = '';
  let resumed = '';
  let exportedTo = '';

  const deps = {
    compact: () => {
      compacted = true;
      return { removed: 2, kept: 6 };
    },
    getContextSummary: () => 'Context: 12 messages',
    getCostSummary: () => 'Cost: 120 tokens',
    getTodosSummary: () => 'No active todos.',
    rewind: () => {
      rewound = true;
      return true;
    },
    getStatusSummary: () => 'Status: ready',
    getPermissionsSummary: () => 'Permissions: default ask',
    getMcpSummary: () => 'MCP: none connected',
    getConfigSummary: () => 'Config: openai/gpt-5.2',
    getAgentsSummary: () => 'Agents:\n- trader (project)',
    renameSession: async (name: string) => {
      renamedTo = name;
      return true;
    },
    resumeSession: async (sessionId?: string) => {
      resumed = sessionId ?? '';
      return sessionId ? `Resumed ${sessionId}` : 'Available sessions:\n- ses_a';
    },
    exportSession: async (target?: string) => {
      exportedTo = target ?? '';
      return target ? `Exported to ${target}` : 'Exported to session.md';
    },
  };

  return {
    deps,
    getState: () => ({ compacted, rewound, renamedTo, resumed, exportedTo }),
  };
}

describe('runExtendedSlashAction', () => {
  test('handles compact/context/cost/todos/status commands', async () => {
    const { deps, getState } = makeDeps();

    expect(await runExtendedSlashAction('compact', [], deps)).toContain('Context compacted');
    expect(getState().compacted).toBe(true);
    expect(await runExtendedSlashAction('context', [], deps)).toBe('Context: 12 messages');
    expect(await runExtendedSlashAction('cost', [], deps)).toBe('Cost: 120 tokens');
    expect(await runExtendedSlashAction('todos', [], deps)).toBe('No active todos.');
    expect(await runExtendedSlashAction('status', [], deps)).toBe('Status: ready');
  });

  test('handles config and mcp summaries', async () => {
    const { deps } = makeDeps();
    expect(await runExtendedSlashAction('config', [], deps)).toBe('Config: openai/gpt-5.2');
    expect(await runExtendedSlashAction('mcp', [], deps)).toBe('MCP: none connected');
    expect(await runExtendedSlashAction('permissions', [], deps)).toBe('Permissions: default ask');
    expect(await runExtendedSlashAction('agents', [], deps)).toBe('Agents:\n- trader (project)');
  });

  test('handles rewind/rename/resume/export', async () => {
    const { deps, getState } = makeDeps();

    expect(await runExtendedSlashAction('rewind', [], deps)).toContain('Removed the last completed turn');
    expect(getState().rewound).toBe(true);

    expect(await runExtendedSlashAction('rename', ['new', 'name'], deps)).toBe('Session renamed to "new name".');
    expect(getState().renamedTo).toBe('new name');

    expect(await runExtendedSlashAction('resume', ['ses_abc'], deps)).toBe('Resumed ses_abc');
    expect(getState().resumed).toBe('ses_abc');

    expect(await runExtendedSlashAction('export', ['notes.md'], deps)).toBe('Exported to notes.md');
    expect(getState().exportedTo).toBe('notes.md');
  });

  test('returns null for unsupported actions', async () => {
    const { deps } = makeDeps();
    expect(await runExtendedSlashAction('model', [], deps)).toBeNull();
    expect(await runExtendedSlashAction('help', [], deps)).toBeNull();
    expect(await runExtendedSlashAction('clear', [], deps)).toBeNull();
    expect(await runExtendedSlashAction('skill', [], deps)).toBeNull();
    expect(await runExtendedSlashAction('exit', [], deps)).toBeNull();
    expect(await runExtendedSlashAction('verbose', [], deps)).toBeNull();
  });

  test('handles missing required arguments', async () => {
    const { deps } = makeDeps();
    expect(await runExtendedSlashAction('rename', [], deps)).toBe('Usage: /rename <name>');
  });

  test('is exhaustively typed for slash actions', async () => {
    const { deps } = makeDeps();
    const actions: SlashAction[] = [
      'model',
      'clear',
      'skill',
      'help',
      'exit',
      'compact',
      'context',
      'cost',
      'resume',
      'export',
      'rename',
      'rewind',
      'status',
      'permissions',
      'mcp',
      'config',
      'todos',
      'verbose',
      'agents',
    ];

    for (const action of actions) {
      await runExtendedSlashAction(action, [], deps);
    }
    expect(actions).toHaveLength(19);
  });
});
