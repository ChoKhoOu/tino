import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { ToolRegistry } from '@/runtime/tool-registry.js';

const EXPECTED_TOOL_IDS = [
  'market_data',
  'fundamentals',
  'filings',
  'macro_data',
  'quant_compute',
  'trading_sim',
  'trading_live',
  'strategy_lab',
  'browser',
  'web_search',
  'skill',
] as const;

const CONSOLIDATED_DIR = join(import.meta.dirname ?? '.', '..', 'consolidated');

describe('consolidated tool registry', () => {
  test('discovers exactly 11 tools', async () => {
    const registry = new ToolRegistry();
    const plugins = await registry.discoverTools(CONSOLIDATED_DIR);
    registry.registerAll(plugins);

    expect(plugins.length).toBe(11);
  });

  test('all 11 expected tool IDs are present', async () => {
    const registry = new ToolRegistry();
    const plugins = await registry.discoverTools(CONSOLIDATED_DIR);
    registry.registerAll(plugins);

    const ids = new Set(plugins.map((p) => p.id));
    for (const expected of EXPECTED_TOOL_IDS) {
      expect(ids.has(expected)).toBe(true);
    }
  });

  test('validate() passes without errors', async () => {
    const registry = new ToolRegistry();
    const plugins = await registry.discoverTools(CONSOLIDATED_DIR);
    registry.registerAll(plugins);

    expect(() => registry.validate()).not.toThrow();
  });

  test('each tool has required fields', async () => {
    const registry = new ToolRegistry();
    const plugins = await registry.discoverTools(CONSOLIDATED_DIR);

    for (const plugin of plugins) {
      expect(plugin.id).toBeTruthy();
      expect(plugin.domain).toBeTruthy();
      expect(plugin.riskLevel).toBeTruthy();
      expect(plugin.description).toBeTruthy();
      expect(plugin.schema).toBeTruthy();
      expect(typeof plugin.execute).toBe('function');
    }
  });

  test('no duplicate tool IDs', async () => {
    const registry = new ToolRegistry();
    const plugins = await registry.discoverTools(CONSOLIDATED_DIR);

    const ids = plugins.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
