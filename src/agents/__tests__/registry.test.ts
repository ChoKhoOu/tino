import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { clearAgentRegistryCache, discoverAgentConfigs, discoverAgentDefinitions } from '../registry.js';

const TEST_ROOT = join(tmpdir(), `tino-agents-registry-${Date.now()}`);

function writeAgent(dir: string, filename: string, content: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, 'utf-8');
}

describe('discoverAgentConfigs', () => {
  beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true });
    clearAgentRegistryCache();
  });

  afterEach(() => {
    clearAgentRegistryCache();
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  test('loads project and user agents from .tino/agents directories', () => {
    const projectDir = join(TEST_ROOT, 'project');
    const homeDir = join(TEST_ROOT, 'home');

    writeAgent(join(projectDir, '.tino', 'agents'), 'project-trader.md', `---
name: project-trader
description: Project scoped trader
tools: [market-data]
---
Use project settings.`);

    writeAgent(join(homeDir, '.tino', 'agents'), 'user-reviewer.md', `---
name: user-reviewer
description: User scoped reviewer
tools: [read]
---
Find risks.`);

    const agents = discoverAgentConfigs({ cwd: projectDir, homeDir });
    expect(agents).toHaveLength(2);
    expect(agents.map((agent) => agent.name).sort()).toEqual(['project-trader', 'user-reviewer']);
  });

  test('project agents override user agents with same name', () => {
    const projectDir = join(TEST_ROOT, 'project');
    const homeDir = join(TEST_ROOT, 'home');

    writeAgent(join(homeDir, '.tino', 'agents'), 'shared.md', `---
name: shared
description: user
tools: [read]
---
User prompt`);

    writeAgent(join(projectDir, '.tino', 'agents'), 'shared.md', `---
name: shared
description: project
tools: [write]
---
Project prompt`);

    const agents = discoverAgentConfigs({ cwd: projectDir, homeDir });
    expect(agents).toHaveLength(1);
    expect(agents[0].description).toBe('project');
    expect(agents[0].source).toBe('project');
    expect(agents[0].allowedTools).toEqual(['write']);
  });

  test('skips invalid files and ignores non-markdown files', () => {
    const projectDir = join(TEST_ROOT, 'project');
    const homeDir = join(TEST_ROOT, 'home');
    const agentsDir = join(projectDir, '.tino', 'agents');

    writeAgent(agentsDir, 'valid.md', `---
name: valid
description: valid config
tools: [read]
---
Prompt`);

    writeAgent(agentsDir, 'invalid.md', `---
name: invalid
tools: [read]
---
Prompt`);

    writeAgent(agentsDir, 'notes.txt', 'not markdown');

    const agents = discoverAgentConfigs({ cwd: projectDir, homeDir });
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('valid');
  });
});

describe('discoverAgentDefinitions', () => {
  test('maps discovered config into AgentDefinition shape', () => {
    const projectDir = join(TEST_ROOT, 'project-map');
    const homeDir = join(TEST_ROOT, 'home-map');

    writeAgent(join(projectDir, '.tino', 'agents'), 'planner.md', `---
name: planner
description: Plan-first agent
model: gpt-5.2
tools: [read, write]
---
Plan then execute.`);

    const definitions = discoverAgentDefinitions({ cwd: projectDir, homeDir });
    expect(definitions).toHaveLength(1);
    expect(definitions[0]).toMatchObject({
      id: 'planner',
      name: 'planner',
      model: 'gpt-5.2',
      tools: ['read', 'write'],
      source: 'project',
      systemPrompt: 'Plan then execute.',
    });
  });
});
