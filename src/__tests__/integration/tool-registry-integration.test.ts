import { describe, expect, test } from 'bun:test';
import { ToolRegistry, MAX_TOOLS } from '../../runtime/tool-registry.js';

const EXPECTED_CONSOLIDATED_IDS = [
  'market_data', 'fundamentals', 'macro_data',
  'quant_compute', 'trading_sim', 'trading_live', 'strategy_lab',
  'web_search', 'browser', 'skill', 'portfolio', 'chart', 'streaming',
  'backtest_history',
] as const;

const EXPECTED_CODING_IDS = [
  'read_file', 'write_file', 'edit_file', 'bash', 'grep', 'glob', 'lsp',
] as const;

const EXPECTED_AGENT_IDS = ['task', 'todo_write', 'question'] as const;

describe('tool registry integration', () => {
  test('discoverTools finds all 14 consolidated tools', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    const ids = tools.map((t) => t.id).sort();

    for (const expected of EXPECTED_CONSOLIDATED_IDS) {
      expect(ids).toContain(expected);
    }
  });

  test('discoverTools finds all 7 coding tools', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    const ids = tools.map((t) => t.id);

    for (const expected of EXPECTED_CODING_IDS) {
      expect(ids).toContain(expected);
    }
  });

  test('discoverTools finds all 3 agent tools', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    const ids = tools.map((t) => t.id);

    for (const expected of EXPECTED_AGENT_IDS) {
      expect(ids).toContain(expected);
    }
  });

  test('all discovered tools have valid schema and riskLevel', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    registry.registerAll(tools);

    expect(() => registry.validate()).not.toThrow();
  });

  test('total tool count is within MAX_TOOLS limit', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();

    expect(tools.length).toBeLessThanOrEqual(MAX_TOOLS);
    expect(tools.length).toBeGreaterThanOrEqual(24);
  });

  test('each tool is retrievable by ID after registration', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    registry.registerAll(tools);

    const allIds = [
      ...EXPECTED_CONSOLIDATED_IDS,
      ...EXPECTED_CODING_IDS,
      ...EXPECTED_AGENT_IDS,
    ];
    for (const id of allIds) {
      const plugin = registry.get(id);
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe(id);
      expect(typeof plugin?.execute).toBe('function');
    }
  });

  test('no duplicate tool IDs exist', async () => {
    const registry = new ToolRegistry();
    const tools = await registry.discoverTools();
    const ids = tools.map((t) => t.id);
    const unique = new Set(ids);

    expect(unique.size).toBe(ids.length);
  });
});
