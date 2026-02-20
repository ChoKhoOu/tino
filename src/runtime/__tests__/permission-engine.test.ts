import { describe, test, expect } from 'bun:test';
import { PermissionEngine } from '@/runtime/permission-engine.js';
import type { PermissionConfig } from '@/domain/index.js';
import { PERMISSION_MODE_ORDER } from '@/domain/permission-mode.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(
  rules: PermissionConfig['rules'] = [],
  defaultAction: PermissionConfig['defaultAction'] = 'ask',
): PermissionConfig {
  return { rules, defaultAction };
}

// ---------------------------------------------------------------------------
// 1. matchGlob (tested indirectly via check)
// ---------------------------------------------------------------------------

describe('matchGlob (indirect)', () => {
  test('exact match', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'read_file', action: 'allow' }]),
    );
    expect(engine.check('read_file')).toBe('allow');
    // non-match falls to default
    expect(engine.check('write_file')).toBe('ask');
  });

  test('wildcard * matches any suffix', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'finance:*', action: 'allow' }]),
    );
    expect(engine.check('finance:polygon')).toBe('allow');
    expect(engine.check('finance:binance')).toBe('allow');
    expect(engine.check('finance:')).toBe('allow');
    // does not match different prefix
    expect(engine.check('browser:navigate')).toBe('ask');
  });

  test('wildcard * matches entire tool id', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: '*', action: 'deny' }]),
    );
    expect(engine.check('anything')).toBe('deny');
    expect(engine.check('read_file')).toBe('deny');
  });

  test('multiple wildcards', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: '*:*', action: 'allow' }]),
    );
    expect(engine.check('a:b')).toBe('allow');
    expect(engine.check('finance:polygon')).toBe('allow');
    // single segment without colon does not match *:*
    expect(engine.check('read_file')).toBe('ask');
  });

  test('special regex characters in pattern are escaped', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'file.read', action: 'allow' }]),
    );
    // exact match with literal dot
    expect(engine.check('file.read')).toBe('allow');
    // dot should NOT act as regex wildcard
    expect(engine.check('fileXread')).toBe('ask');
  });

  test('pattern with parens and brackets is escaped', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'tool(1)[2]', action: 'allow' }]),
    );
    expect(engine.check('tool(1)[2]')).toBe('allow');
    expect(engine.check('tool12')).toBe('ask');
  });
});

// ---------------------------------------------------------------------------
// 2. ruleMatches (indirect via check with resources)
// ---------------------------------------------------------------------------

describe('ruleMatches (indirect)', () => {
  test('tool match without resource in rule matches any resource', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'bash', action: 'allow' }]),
    );
    expect(engine.check('bash')).toBe('allow');
    expect(engine.check('bash', '/tmp/foo')).toBe('allow');
  });

  test('resource match with exact resource', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'edit_file', resource: '/src/*', action: 'allow' }]),
    );
    expect(engine.check('edit_file', '/src/index.ts')).toBe('allow');
    expect(engine.check('edit_file', '/tmp/evil.ts')).toBe('ask');
  });

  test('rule with resource does not match when call has no resource', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'edit_file', resource: '/src/*', action: 'allow' }]),
    );
    // no resource provided -> rule does not match -> falls to default
    expect(engine.check('edit_file')).toBe('ask');
  });

  test('resource glob with exact resource string', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'write_file', resource: '/home/user/data.json', action: 'deny' }]),
    );
    expect(engine.check('write_file', '/home/user/data.json')).toBe('deny');
    expect(engine.check('write_file', '/home/user/other.json')).toBe('ask');
  });
});

// ---------------------------------------------------------------------------
// 3. Constructor
// ---------------------------------------------------------------------------

describe('constructor', () => {
  test('defaults to "default" mode', () => {
    const engine = new PermissionEngine(makeConfig());
    expect(engine.getMode()).toBe('default');
  });

  test('accepts a custom initial mode', () => {
    const engine = new PermissionEngine(makeConfig(), 'plan');
    expect(engine.getMode()).toBe('plan');
  });
});

// ---------------------------------------------------------------------------
// 4. check() rule resolution
// ---------------------------------------------------------------------------

describe('check() rule resolution', () => {
  test('rule-based allow', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'read_file', action: 'allow' }]),
    );
    expect(engine.check('read_file')).toBe('allow');
  });

  test('rule-based deny', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'bash', action: 'deny' }]),
    );
    expect(engine.check('bash')).toBe('deny');
  });

  test('rule-based ask', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'bash', action: 'ask' }], 'deny'),
    );
    expect(engine.check('bash')).toBe('ask');
  });

  test('falls back to defaultAction when no rule matches', () => {
    const engine = new PermissionEngine(makeConfig([], 'deny'));
    expect(engine.check('unknown_tool')).toBe('deny');
  });

  test('falls back to defaultAction "ask"', () => {
    const engine = new PermissionEngine(makeConfig([], 'ask'));
    expect(engine.check('unknown_tool')).toBe('ask');
  });

  test('first matching rule wins', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'bash', action: 'allow' },
        { tool: 'bash', action: 'deny' },
      ]),
    );
    expect(engine.check('bash')).toBe('allow');
  });

  test('first matching rule wins (deny before allow)', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'bash', action: 'deny' },
        { tool: 'bash', action: 'allow' },
      ]),
    );
    expect(engine.check('bash')).toBe('deny');
  });

  test('more specific rule before wildcard', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'finance:polygon', action: 'deny' },
        { tool: 'finance:*', action: 'allow' },
      ]),
    );
    expect(engine.check('finance:polygon')).toBe('deny');
    expect(engine.check('finance:binance')).toBe('allow');
  });
});

// ---------------------------------------------------------------------------
// 5. Mode behavior
// ---------------------------------------------------------------------------

describe('mode: default', () => {
  test('returns configured decision as-is', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'read_file', action: 'allow' },
        { tool: 'bash', action: 'deny' },
      ]),
      'default',
    );
    expect(engine.check('read_file')).toBe('allow');
    expect(engine.check('bash')).toBe('deny');
    expect(engine.check('unknown')).toBe('ask');
  });
});

describe('mode: auto-accept', () => {
  test('overrides to allow for edit_file', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'edit_file', action: 'deny' }]),
      'auto-accept',
    );
    expect(engine.check('edit_file')).toBe('allow');
  });

  test('overrides to allow for write_file', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'write_file', action: 'deny' }]),
      'auto-accept',
    );
    expect(engine.check('write_file')).toBe('allow');
  });

  test('does not override non-edit tools', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'bash', action: 'deny' }]),
      'auto-accept',
    );
    expect(engine.check('bash')).toBe('deny');
  });

  test('non-edit tools still use config decision', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'read_file', action: 'allow' }]),
      'auto-accept',
    );
    expect(engine.check('read_file')).toBe('allow');
    // unmatched -> default ask
    expect(engine.check('unknown')).toBe('ask');
  });
});

describe('mode: plan', () => {
  test('allows read tools regardless of config', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'read_file', action: 'deny' }]),
      'plan',
    );
    expect(engine.check('read_file')).toBe('allow');
  });

  test('allows other known read tools', () => {
    const engine = new PermissionEngine(makeConfig([], 'deny'), 'plan');
    expect(engine.check('glob')).toBe('allow');
    expect(engine.check('grep')).toBe('allow');
    expect(engine.check('web_search')).toBe('allow');
    expect(engine.check('market_data')).toBe('allow');
  });

  test('denies write/edit tools regardless of config', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'bash', action: 'allow' },
        { tool: 'edit_file', action: 'allow' },
        { tool: 'write_file', action: 'allow' },
        { tool: 'trading_live', action: 'allow' },
      ]),
      'plan',
    );
    expect(engine.check('bash')).toBe('deny');
    expect(engine.check('edit_file')).toBe('deny');
    expect(engine.check('write_file')).toBe('deny');
    expect(engine.check('trading_live')).toBe('deny');
  });

  test('denies unknown tools (not in read set)', () => {
    const engine = new PermissionEngine(makeConfig([], 'ask'), 'plan');
    expect(engine.check('unknown_tool')).toBe('deny');
  });
});

describe('mode: delegate', () => {
  test('behaves like default (uses config)', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'read_file', action: 'allow' },
        { tool: 'bash', action: 'deny' },
      ]),
      'delegate',
    );
    expect(engine.check('read_file')).toBe('allow');
    expect(engine.check('bash')).toBe('deny');
    expect(engine.check('unknown')).toBe('ask');
  });
});

// ---------------------------------------------------------------------------
// 6. cycleMode()
// ---------------------------------------------------------------------------

describe('cycleMode()', () => {
  test('cycles through all modes in order', () => {
    const engine = new PermissionEngine(makeConfig(), 'default');
    const visited: string[] = [engine.getMode()];

    for (let i = 0; i < PERMISSION_MODE_ORDER.length; i++) {
      visited.push(engine.cycleMode());
    }

    // default -> auto-accept -> plan -> delegate -> default
    expect(visited).toEqual([
      'default',
      'auto-accept',
      'plan',
      'delegate',
      'default',
    ]);
  });

  test('returns the new mode', () => {
    const engine = new PermissionEngine(makeConfig(), 'default');
    const next = engine.cycleMode();
    expect(next).toBe('auto-accept');
    expect(engine.getMode()).toBe('auto-accept');
  });
});

// ---------------------------------------------------------------------------
// 7. setMode / getMode
// ---------------------------------------------------------------------------

describe('setMode / getMode', () => {
  test('setMode changes the mode', () => {
    const engine = new PermissionEngine(makeConfig());
    expect(engine.getMode()).toBe('default');
    engine.setMode('plan');
    expect(engine.getMode()).toBe('plan');
  });

  test('setMode affects subsequent check() calls', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'edit_file', action: 'deny' }]),
    );
    // default mode: config says deny
    expect(engine.check('edit_file')).toBe('deny');

    // switch to auto-accept: overrides to allow
    engine.setMode('auto-accept');
    expect(engine.check('edit_file')).toBe('allow');

    // switch to plan: denies write tools
    engine.setMode('plan');
    expect(engine.check('edit_file')).toBe('deny');

    // back to default
    engine.setMode('default');
    expect(engine.check('edit_file')).toBe('deny');
  });
});

// ---------------------------------------------------------------------------
// 8. Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  test('empty rules array uses default action', () => {
    const engine = new PermissionEngine(makeConfig([], 'deny'));
    expect(engine.check('anything')).toBe('deny');
  });

  test('empty string tool id', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: '', action: 'allow' }]),
    );
    expect(engine.check('')).toBe('allow');
    expect(engine.check('x')).toBe('ask');
  });

  test('wildcard resource pattern', () => {
    const engine = new PermissionEngine(
      makeConfig([{ tool: 'edit_file', resource: '*.ts', action: 'allow' }]),
    );
    expect(engine.check('edit_file', 'index.ts')).toBe('allow');
    expect(engine.check('edit_file', 'index.js')).toBe('ask');
  });

  test('multiple rules with different resources', () => {
    const engine = new PermissionEngine(
      makeConfig([
        { tool: 'edit_file', resource: '/src/*', action: 'allow' },
        { tool: 'edit_file', resource: '/secrets/*', action: 'deny' },
        { tool: 'edit_file', action: 'ask' },
      ]),
    );
    expect(engine.check('edit_file', '/src/index.ts')).toBe('allow');
    expect(engine.check('edit_file', '/secrets/key.pem')).toBe('deny');
    expect(engine.check('edit_file', '/tmp/scratch.ts')).toBe('ask');
    expect(engine.check('edit_file')).toBe('ask');
  });
});
