import { describe, test, expect, beforeEach } from 'bun:test';
import { AgentRegistry } from '../agent-registry.js';
import { buildAgent } from './build.js';
import { planAgent } from './plan.js';
import { exploreAgent } from './explore.js';
import { generalAgent } from './general.js';
import { compactionAgent } from './compaction.js';
import { registerBuiltinAgents } from './index.js';

describe('builtin agent definitions', () => {
  describe('build agent', () => {
    test('has correct id and source', () => {
      expect(buildAgent.id).toBe('build');
      expect(buildAgent.source).toBe('builtin');
    });

    test('has no tools restriction (all tools)', () => {
      expect(buildAgent.tools).toBeUndefined();
    });

    test('has maxTurns 10 and green color', () => {
      expect(buildAgent.maxTurns).toBe(10);
      expect(buildAgent.color).toBe('#4CAF50');
    });

    test('has name and systemPrompt', () => {
      expect(buildAgent.name).toBeTruthy();
      expect(buildAgent.systemPrompt).toBeTruthy();
    });
  });

  describe('plan agent', () => {
    test('has correct id and source', () => {
      expect(planAgent.id).toBe('plan');
      expect(planAgent.source).toBe('builtin');
    });

    test('only allows read-only tools', () => {
      expect(planAgent.tools).toEqual(['read', 'grep', 'glob', 'bash', 'lsp']);
    });

    test('does NOT include edit or write tools', () => {
      expect(planAgent.tools).not.toContain('edit');
      expect(planAgent.tools).not.toContain('write');
      expect(planAgent.tools).not.toContain('task');
    });

    test('has maxTurns 5 and blue color', () => {
      expect(planAgent.maxTurns).toBe(5);
      expect(planAgent.color).toBe('#2196F3');
    });
  });

  describe('explore agent', () => {
    test('has correct id and source', () => {
      expect(exploreAgent.id).toBe('explore');
      expect(exploreAgent.source).toBe('builtin');
    });

    test('only allows minimal toolset', () => {
      expect(exploreAgent.tools).toEqual(['read', 'grep', 'glob', 'bash']);
    });

    test('has maxTurns 3 and orange color', () => {
      expect(exploreAgent.maxTurns).toBe(3);
      expect(exploreAgent.color).toBe('#FF9800');
    });
  });

  describe('general agent', () => {
    test('has correct id and source', () => {
      expect(generalAgent.id).toBe('general');
      expect(generalAgent.source).toBe('builtin');
    });

    test('excludes todo_write and task tools', () => {
      expect(generalAgent.tools).not.toContain('todo_write');
      expect(generalAgent.tools).not.toContain('task');
    });

    test('has tools defined (not undefined)', () => {
      expect(generalAgent.tools).toBeDefined();
      expect(Array.isArray(generalAgent.tools)).toBe(true);
      expect(generalAgent.tools!.length).toBeGreaterThan(0);
    });

    test('has maxTurns 5 and purple color', () => {
      expect(generalAgent.maxTurns).toBe(5);
      expect(generalAgent.color).toBe('#9C27B0');
    });
  });

  describe('compaction agent', () => {
    test('has correct id and source', () => {
      expect(compactionAgent.id).toBe('compaction');
      expect(compactionAgent.source).toBe('builtin');
    });

    test('has empty tools array (no tools)', () => {
      expect(compactionAgent.tools).toEqual([]);
    });

    test('has maxTurns 1 and grey color', () => {
      expect(compactionAgent.maxTurns).toBe(1);
      expect(compactionAgent.color).toBe('#607D8B');
    });
  });
});

describe('registerBuiltinAgents', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  test('registers all 5 builtin agents', () => {
    registerBuiltinAgents(registry);
    expect(registry.list()).toHaveLength(5);
  });

  test('all agents retrievable by id after registration', () => {
    registerBuiltinAgents(registry);

    expect(registry.get('build')).toBeDefined();
    expect(registry.get('plan')).toBeDefined();
    expect(registry.get('explore')).toBeDefined();
    expect(registry.get('general')).toBeDefined();
    expect(registry.get('compaction')).toBeDefined();
  });

  test('registered agents match exported definitions', () => {
    registerBuiltinAgents(registry);

    expect(registry.get('build')).toBe(buildAgent);
    expect(registry.get('plan')).toBe(planAgent);
    expect(registry.get('explore')).toBe(exploreAgent);
    expect(registry.get('general')).toBe(generalAgent);
    expect(registry.get('compaction')).toBe(compactionAgent);
  });
});
