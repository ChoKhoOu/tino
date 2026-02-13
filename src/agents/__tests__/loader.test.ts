import { describe, expect, test } from 'bun:test';
import { parseAgentConfigFile } from '../loader.js';

describe('parseAgentConfigFile', () => {
  test('parses markdown frontmatter and maps tools to allowedTools', () => {
    const markdown = `---
name: trader
description: Specialized trading agent
model: gpt-5.2
temperature: 0.2
tools: [market-data, backtest, trading-paper]
---
You are a specialized trading agent.`;

    const config = parseAgentConfigFile(markdown, '/tmp/trader.md');

    expect(config.name).toBe('trader');
    expect(config.description).toBe('Specialized trading agent');
    expect(config.model).toBe('gpt-5.2');
    expect(config.temperature).toBe(0.2);
    expect(config.allowedTools).toEqual(['market-data', 'backtest', 'trading-paper']);
    expect(config.systemPrompt).toBe('You are a specialized trading agent.');
  });

  test('supports minimal config and defaults tools to empty list', () => {
    const markdown = `---
name: reviewer
description: Code review focused agent
---
Find high severity bugs first.`;

    const config = parseAgentConfigFile(markdown, '/tmp/reviewer.md');

    expect(config.allowedTools).toEqual([]);
    expect(config.model).toBeUndefined();
    expect(config.temperature).toBeUndefined();
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

  test('throws when required description field is missing', () => {
    const markdown = `---
name: missing-description
tools: [read]
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/missing-description.md')).toThrow("missing required 'description'");
  });

  test('throws when tools field is not a string array', () => {
    const markdown = `---
name: bad-tools
description: Invalid tools
tools: 123
---
Prompt`;

    expect(() => parseAgentConfigFile(markdown, '/tmp/bad-tools.md')).toThrow("'tools' must be a string array");
  });
});
