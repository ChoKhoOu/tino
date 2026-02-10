import { describe, expect, test } from 'bun:test';
import { buildToolDescriptions, getToolRegistry } from '../../tools/registry.js';
import { discoverSkills } from '../../skills/index.js';

describe('tool registry integration', () => {
  test('getToolRegistry contains expected core tools', () => {
    const registry = getToolRegistry('gpt-5.2');
    const names = registry.map((tool) => tool.name);

    expect(names).toContain('financial_search');
    expect(names).toContain('quant_analysis');
    expect(names).toContain('strategy_gen');
    expect(names).toContain('financial_research');
    expect(names).toContain('browser');
  });

  test('buildToolDescriptions includes every registered tool section', () => {
    const registry = getToolRegistry('gpt-5.2');
    const descriptions = buildToolDescriptions('gpt-5.2');

    for (const tool of registry) {
      expect(descriptions).toContain(`### ${tool.name}`);
      expect(descriptions).toContain(tool.description);
    }
  });

  test('strategy_gen tool is registered', () => {
    const registry = getToolRegistry('gpt-5.2');
    const strategyTool = registry.find((tool) => tool.name === 'strategy_gen');

    expect(strategyTool).toBeDefined();
    expect(strategyTool?.tool.name).toBe('strategy_gen');
  });

  test('skill tool is registered when skills are discovered', () => {
    const skills = discoverSkills();
    expect(skills.length).toBeGreaterThan(0);

    const registry = getToolRegistry('gpt-5.2');
    const names = registry.map((tool) => tool.name);

    expect(names).toContain('skill');
  });
});
