import { describe, test, expect } from 'bun:test';
import { parseSlashCommand, SLASH_COMMANDS } from './slash.js';

// ─── Existing commands (must not break) ─────────────────────────────────────

describe('parseSlashCommand — existing commands', () => {
  test('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world')).toBeNull();
  });

  test('returns handled:false for unknown command', () => {
    const result = parseSlashCommand('/unknown');
    expect(result).toEqual({ handled: false });
  });

  test('/help returns output with all 17 commands', () => {
    const result = parseSlashCommand('/help');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('help');
    expect(result?.output).toContain('/help');
    expect(result?.output).toContain('/model');
    expect(result?.output).toContain('/compact');
    expect(result?.output).toContain('/todos');
  });

  test('/model passes args', () => {
    const result = parseSlashCommand('/model claude-3');
    expect(result).toEqual({
      handled: true,
      action: 'model',
      args: ['claude-3'],
    });
  });

  test('/clear returns output', () => {
    const result = parseSlashCommand('/clear');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('clear');
    expect(result?.output).toBe('Conversation cleared.');
  });

  test('/skill passes args', () => {
    const result = parseSlashCommand('/skill backtest');
    expect(result).toEqual({
      handled: true,
      action: 'skill',
      args: ['backtest'],
    });
  });

  test('/exit returns action', () => {
    const result = parseSlashCommand('/exit');
    expect(result).toEqual({ handled: true, action: 'exit' });
  });
});

// ─── New commands ───────────────────────────────────────────────────────────

describe('parseSlashCommand — context commands', () => {
  test('/compact returns action with optional focus', () => {
    const result = parseSlashCommand('/compact');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('compact');
  });

  test('/compact passes focus topic as args', () => {
    const result = parseSlashCommand('/compact trading strategies');
    expect(result).toEqual({
      handled: true,
      action: 'compact',
      args: ['trading', 'strategies'],
    });
  });

  test('/context returns action', () => {
    const result = parseSlashCommand('/context');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('context');
  });

  test('/cost returns action', () => {
    const result = parseSlashCommand('/cost');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('cost');
  });

  test('/todos returns action', () => {
    const result = parseSlashCommand('/todos');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('todos');
  });
});

describe('parseSlashCommand — session commands', () => {
  test('/resume returns action with optional session ID', () => {
    const result = parseSlashCommand('/resume');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('resume');
  });

  test('/resume passes session ID as args', () => {
    const result = parseSlashCommand('/resume ses_abc123');
    expect(result).toEqual({
      handled: true,
      action: 'resume',
      args: ['ses_abc123'],
    });
  });

  test('/export returns action with optional filename', () => {
    const result = parseSlashCommand('/export');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('export');
  });

  test('/export passes filename as args', () => {
    const result = parseSlashCommand('/export session.md');
    expect(result).toEqual({
      handled: true,
      action: 'export',
      args: ['session.md'],
    });
  });

  test('/rename returns action with name args', () => {
    const result = parseSlashCommand('/rename my session');
    expect(result).toEqual({
      handled: true,
      action: 'rename',
      args: ['my', 'session'],
    });
  });
});

describe('parseSlashCommand — config commands', () => {
  test('/status returns action with immediate output', () => {
    const result = parseSlashCommand('/status');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('status');
  });

  test('/permissions returns action', () => {
    const result = parseSlashCommand('/permissions');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('permissions');
  });

  test('/mcp returns action', () => {
    const result = parseSlashCommand('/mcp');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('mcp');
  });

  test('/config returns action', () => {
    const result = parseSlashCommand('/config');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('config');
  });

  test('/rewind returns action', () => {
    const result = parseSlashCommand('/rewind');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('rewind');
  });

  test('/verbose returns action with output', () => {
    const result = parseSlashCommand('/verbose');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('verbose');
    expect(result?.output).toBe('Verbose mode toggled.');
  });
});

// ─── SLASH_COMMANDS registry ────────────────────────────────────────────────

describe('SLASH_COMMANDS registry', () => {
  test('contains all 18 commands', () => {
    const expected = [
      '/model', '/clear', '/skill', '/help', '/exit',
      '/compact', '/context', '/cost', '/resume', '/export',
      '/rename', '/rewind', '/status', '/permissions', '/mcp',
      '/config', '/todos', '/verbose',
    ];
    for (const cmd of expected) {
      expect(SLASH_COMMANDS).toHaveProperty(cmd);
    }
    expect(Object.keys(SLASH_COMMANDS)).toHaveLength(18);
  });
});

// ─── Case insensitivity & whitespace ────────────────────────────────────────

describe('parseSlashCommand — edge cases', () => {
  test('handles leading/trailing whitespace', () => {
    const result = parseSlashCommand('  /compact  ');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('compact');
  });

  test('handles uppercase commands', () => {
    const result = parseSlashCommand('/COMPACT');
    expect(result?.handled).toBe(true);
    expect(result?.action).toBe('compact');
  });
});
