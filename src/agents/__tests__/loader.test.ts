import { describe, expect, test } from 'bun:test';
import { parseAgentConfigFile } from '../loader.js';

describe('parseAgentConfigFile', () => {
  test('parses full frontmatter with all fields', () => {
    const markdown = `---
name: trader
description: Specialized trading agent
model: gpt-5.2
temperature: 0.2
maxTurns: 10
color: blue
tools: [market-data, backtest, trading-paper]
---
You are a specialized trading agent.`;

    const config = parseAgentConfigFile(markdown, '/tmp/trader.md');

    expect(config.name).toBe('trader');
    expect(config.description).toBe('Specialized trading agent');
    expect(config.model).toBe('gpt-5.2');
    expect(config.temperature).toBe(0.2);
    expect(config.maxTurns).toBe(10);
    expect(config.color).toBe('blue');
    expect(config.allowedTools).toEqual(['market-data', 'backtest', 'trading-paper']);
    expect(config.systemPrompt).toBe('You are a specialized trading agent.');
  });

  test('supports minimal config with only name (v1 compat)', () => {
    const markdown = `---
name: explorer
---
Quick exploration agent.`;

    const config = parseAgentConfigFile(markdown, '/tmp/explorer.md');

    expect(config.name).toBe('explorer');
    expect(config.description).toBeUndefined();
    expect(config.allowedTools).toBeUndefined();
    expect(config.model).toBeUndefined();
    expect(config.temperature).toBeUndefined();
    expect(config.maxTurns).toBeUndefined();
    expect(config.color).toBeUndefined();
    expect(config.systemPrompt).toBe('Quick exploration agent.');
  });

  test('supports name + description without tools (v2 format)', () => {
    const markdown = `---
name: reviewer
description: Code review focused agent
---
Find high severity bugs first.`;

    const config = parseAgentConfigFile(markdown, '/tmp/reviewer.md');

    expect(config.name).toBe('reviewer');
    expect(config.description).toBe('Code review focused agent');
    expect(config.allowedTools).toBeUndefined();
    expect(config.systemPrompt).toBe('Find high severity bugs first.');
  });

  test('throws when required name field is missing', () => {
    const markdown = `---
description: Missing name
tools: [read]
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/missing-name.md')).toThrow("missing required 'name'");
  });

  test('throws when tools field is not a string array', () => {
    const markdown = `---
name: bad-tools
tools: 123
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-tools.md')).toThrow("'tools' must be a string array");
  });

  test('throws when temperature is not a number', () => {
    const markdown = `---
name: bad-temp
temperature: hot
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-temp.md')).toThrow("'temperature' must be a number");
  });

  test('throws when maxTurns is not a number', () => {
    const markdown = `---
name: bad-turns
maxTurns: many
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-turns.md')).toThrow("'maxTurns' must be a number");
  });

  test('throws when color is not a string', () => {
    const markdown = `---
name: bad-color
color: 123
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-color.md')).toThrow("'color' must be a string");
  });

  test('throws when description is not a string', () => {
    const markdown = `---
name: bad-desc
description: 123
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-desc.md')).toThrow("'description' must be a string");
  });
});
