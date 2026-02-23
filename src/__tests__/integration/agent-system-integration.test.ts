import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { AgentRegistry, registerBuiltinAgents } from '../../agents/index.js';

const BUILTIN_IDS = ['build', 'plan', 'explore', 'general', 'compaction'] as const;

describe('agent system integration', () => {
  test('registerBuiltinAgents registers all 5 agents', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    const agents = registry.list();
    expect(agents).toHaveLength(5);

    const ids = agents.map((a) => a.id).sort();
    expect(ids).toEqual([...BUILTIN_IDS].sort());
  });

  test('each builtin agent is retrievable by ID', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    for (const id of BUILTIN_IDS) {
      const agent = registry.get(id);
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(id);
      expect(agent?.name).toBeTruthy();
      expect(agent?.systemPrompt.length).toBeGreaterThan(10);
    }
  });

  test('build agent has no tools restriction (all tools)', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    const build = registry.get('build');
    expect(build?.tools).toBeUndefined();
  });

  test('plan agent only has read-only tools', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    const plan = registry.get('plan');
    expect(plan?.tools).toBeDefined();
    expect(plan?.tools).toEqual(['read', 'grep', 'glob', 'bash', 'lsp']);
  });

  test('explore agent has minimal toolset', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    const explore = registry.get('explore');
    expect(explore?.tools).toBeDefined();
    expect(explore?.tools).toEqual(['read', 'grep', 'glob', 'bash']);
  });

  test('compaction agent has empty tools', () => {
    const registry = new AgentRegistry();
    registerBuiltinAgents(registry);

    const compaction = registry.get('compaction');
    expect(compaction?.tools).toBeDefined();
    expect(compaction?.tools).toEqual([]);
  });

  test('discoverFromDirectory loads markdown agent files', () => {
    const testDir = join(tmpdir(), `tino-agent-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    try {
      writeFileSync(
        join(testDir, 'test-agent.md'),
        [
          '---',
          'id: test_agent',
          'name: Test Agent',
          'tools:',
          '  - read',
          '  - grep',
          'maxTurns: 3',
          '---',
          'You are a test agent for integration testing.',
        ].join('\n'),
      );

      const registry = new AgentRegistry();
      const discovered = registry.discoverFromDirectory(testDir, 'user');

      expect(discovered).toHaveLength(1);
      expect(discovered[0].id).toBe('test_agent');
      expect(discovered[0].name).toBe('Test Agent');
      expect(discovered[0].tools).toEqual(['read', 'grep']);
      expect(discovered[0].source).toBe('user');
      expect(discovered[0].systemPrompt).toContain('integration testing');

      const retrieved = registry.get('test_agent');
      expect(retrieved).toBeDefined();
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('discoverFromDirectory returns empty for nonexistent dir', () => {
    const registry = new AgentRegistry();
    const result = registry.discoverFromDirectory('/tmp/nonexistent-dir-xyz', 'user');
    expect(result).toEqual([]);
  });
});
