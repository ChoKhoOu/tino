import { describe, expect, test } from 'bun:test';
import {
  PERMISSION_MODE_DESCRIPTIONS,
  PERMISSION_MODE_ORDER,
  getNextPermissionMode,
  isFileEditTool,
  isReadTool,
  isWriteTool,
  resolvePermissionModeDecision,
} from '../permission-mode.js';
import { PermissionEngine } from '@/runtime/permission-engine.js';

describe('permission mode definitions', () => {
  test('defines all modes in cycle order', () => {
    expect(PERMISSION_MODE_ORDER).toEqual(['default', 'auto-accept', 'plan', 'delegate']);
  });

  test('exposes a title and description for every mode', () => {
    for (const mode of PERMISSION_MODE_ORDER) {
      expect(PERMISSION_MODE_DESCRIPTIONS[mode].title.length).toBeGreaterThan(0);
      expect(PERMISSION_MODE_DESCRIPTIONS[mode].description.length).toBeGreaterThan(0);
    }
  });
});

describe('getNextPermissionMode', () => {
  test('cycles through all modes and wraps to default', () => {
    expect(getNextPermissionMode('default')).toBe('auto-accept');
    expect(getNextPermissionMode('auto-accept')).toBe('plan');
    expect(getNextPermissionMode('plan')).toBe('delegate');
    expect(getNextPermissionMode('delegate')).toBe('default');
  });
});

describe('tool type helpers', () => {
  test('identifies file edit tools', () => {
    expect(isFileEditTool('edit_file')).toBe(true);
    expect(isFileEditTool('write_file')).toBe(true);
    expect(isFileEditTool('bash')).toBe(false);
  });

  test('classifies read and write tools', () => {
    expect(isReadTool('read_file')).toBe(true);
    expect(isReadTool('grep')).toBe(true);
    expect(isReadTool('write_file')).toBe(false);

    expect(isWriteTool('write_file')).toBe(true);
    expect(isWriteTool('bash')).toBe(true);
    expect(isWriteTool('read_file')).toBe(false);
  });
});

describe('resolvePermissionModeDecision', () => {
  test('keeps base decision in default mode', () => {
    expect(resolvePermissionModeDecision('default', 'write_file', 'ask')).toBe('ask');
  });

  test('auto-accept mode auto-allows file edit tools only', () => {
    expect(resolvePermissionModeDecision('auto-accept', 'write_file', 'ask')).toBe('allow');
    expect(resolvePermissionModeDecision('auto-accept', 'edit_file', 'deny')).toBe('allow');
    expect(resolvePermissionModeDecision('auto-accept', 'bash', 'ask')).toBe('ask');
  });

  test('plan mode allows read tools and denies write tools', () => {
    expect(resolvePermissionModeDecision('plan', 'read_file', 'ask')).toBe('allow');
    expect(resolvePermissionModeDecision('plan', 'glob', 'deny')).toBe('allow');
    expect(resolvePermissionModeDecision('plan', 'write_file', 'allow')).toBe('deny');
    expect(resolvePermissionModeDecision('plan', 'bash', 'allow')).toBe('deny');
  });

  test('delegate mode uses base decision until delegate runtime exists', () => {
    expect(resolvePermissionModeDecision('delegate', 'task', 'ask')).toBe('ask');
    expect(resolvePermissionModeDecision('delegate', 'task', 'deny')).toBe('deny');
  });
});

describe('PermissionEngine mode integration', () => {
  test('auto-accept mode allows file edits but keeps bash decision from config', () => {
    const engine = new PermissionEngine({ rules: [], defaultAction: 'ask' });

    engine.setMode('auto-accept');

    expect(engine.check('write_file')).toBe('allow');
    expect(engine.check('edit_file')).toBe('allow');
    expect(engine.check('bash')).toBe('ask');
  });

  test('plan mode allows read tools and denies write tools', () => {
    const engine = new PermissionEngine({ rules: [{ tool: '*', action: 'allow' }], defaultAction: 'ask' });

    engine.setMode('plan');

    expect(engine.check('read_file')).toBe('allow');
    expect(engine.check('grep')).toBe('allow');
    expect(engine.check('write_file')).toBe('deny');
    expect(engine.check('bash')).toBe('deny');
  });
});
