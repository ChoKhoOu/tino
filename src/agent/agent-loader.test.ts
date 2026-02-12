import { describe, test, expect } from 'bun:test';
import { parseAgentFile } from './agent-loader.js';

describe('parseAgentFile', () => {
  test('parses valid agent markdown with all fields', () => {
    const md = `---
id: build
name: Build Agent
model: gpt-5.2
tools: [read_file, write_file, bash]
maxTurns: 20
color: "#00ff00"
---
You are a build agent. Your job is to implement code changes.`;

    const agent = parseAgentFile(md, '/tmp/build.md', 'user');

    expect(agent.id).toBe('build');
    expect(agent.name).toBe('Build Agent');
    expect(agent.model).toBe('gpt-5.2');
    expect(agent.tools).toEqual(['read_file', 'write_file', 'bash']);
    expect(agent.maxTurns).toBe(20);
    expect(agent.color).toBe('#00ff00');
    expect(agent.systemPrompt).toBe('You are a build agent. Your job is to implement code changes.');
    expect(agent.path).toBe('/tmp/build.md');
    expect(agent.source).toBe('user');
  });

  test('parses agent with only required fields', () => {
    const md = `---
id: minimal
name: Minimal Agent
---
Do things.`;

    const agent = parseAgentFile(md, '/tmp/minimal.md', 'project');

    expect(agent.id).toBe('minimal');
    expect(agent.name).toBe('Minimal Agent');
    expect(agent.systemPrompt).toBe('Do things.');
    expect(agent.model).toBeUndefined();
    expect(agent.tools).toBeUndefined();
    expect(agent.maxTurns).toBeUndefined();
    expect(agent.color).toBeUndefined();
  });

  test('throws when id field is missing', () => {
    const md = `---
name: No ID Agent
---
Prompt text.`;

    expect(() => parseAgentFile(md, '/tmp/noid.md', 'user')).toThrow("missing required 'id'");
  });

  test('throws when name field is missing', () => {
    const md = `---
id: noname
---
Prompt text.`;

    expect(() => parseAgentFile(md, '/tmp/noname.md', 'user')).toThrow("missing required 'name'");
  });

  test('trims whitespace from system prompt body', () => {
    const md = `---
id: trimmed
name: Trimmed
---

  Some prompt with whitespace.

`;

    const agent = parseAgentFile(md, '/tmp/trimmed.md', 'builtin');
    expect(agent.systemPrompt).toBe('Some prompt with whitespace.');
  });
});
