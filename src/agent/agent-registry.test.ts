import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentRegistry } from './agent-registry.js';

const TEST_DIR = join(tmpdir(), `tino-agent-test-${Date.now()}`);

function writeAgentFile(dir: string, filename: string, content: string) {
  writeFileSync(join(dir, filename), content, 'utf-8');
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('register and get agent by id', () => {
    registry.register({
      id: 'test-agent',
      name: 'Test Agent',
      systemPrompt: 'You are a test agent.',
    });

    const agent = registry.get('test-agent');
    expect(agent).toBeDefined();
    expect(agent!.name).toBe('Test Agent');
  });

  test('get returns undefined for unknown id', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  test('list returns all registered agents', () => {
    registry.register({ id: 'a', name: 'Agent A', systemPrompt: 'Prompt A' });
    registry.register({ id: 'b', name: 'Agent B', systemPrompt: 'Prompt B' });

    const agents = registry.list();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.id).sort()).toEqual(['a', 'b']);
  });

  test('list returns empty array when no agents registered', () => {
    expect(registry.list()).toEqual([]);
  });

  test('later registration overrides earlier with same id', () => {
    registry.register({ id: 'dup', name: 'First', systemPrompt: 'First prompt' });
    registry.register({ id: 'dup', name: 'Second', systemPrompt: 'Second prompt' });

    const agent = registry.get('dup');
    expect(agent!.name).toBe('Second');
    expect(registry.list()).toHaveLength(1);
  });

  test('discoverFromDirectory loads agent markdown files', () => {
    writeAgentFile(TEST_DIR, 'builder.md', `---
id: builder
name: Builder
---
Build things.`);

    writeAgentFile(TEST_DIR, 'researcher.md', `---
id: researcher
name: Researcher
---
Research things.`);

    const agents = registry.discoverFromDirectory(TEST_DIR, 'project');
    expect(agents).toHaveLength(2);
    expect(registry.list()).toHaveLength(2);
  });

  test('discoverFromDirectory returns empty for non-existent directory', () => {
    const agents = registry.discoverFromDirectory('/tmp/nonexistent-dir-xyz', 'user');
    expect(agents).toEqual([]);
  });

  test('discoverFromDirectory skips non-md files', () => {
    writeAgentFile(TEST_DIR, 'valid.md', `---
id: valid
name: Valid
---
Valid agent.`);

    writeFileSync(join(TEST_DIR, 'readme.txt'), 'not an agent', 'utf-8');

    const agents = registry.discoverFromDirectory(TEST_DIR, 'user');
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('valid');
  });

  test('discoverFromDirectory skips invalid agent files silently', () => {
    writeAgentFile(TEST_DIR, 'bad.md', `---
name: Missing ID
---
No id field.`);

    writeAgentFile(TEST_DIR, 'good.md', `---
id: good
name: Good Agent
---
Good prompt.`);

    const agents = registry.discoverFromDirectory(TEST_DIR, 'user');
    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('good');
  });
});
