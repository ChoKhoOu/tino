import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { ToolRegistry, MAX_TOOLS, TOOL_DIRS } from './tool-registry.js';
import type { ToolPlugin } from '@/domain/index.js';

function makeTool(id: string): ToolPlugin {
  return {
    id,
    domain: 'test',
    riskLevel: 'safe',
    description: `Test tool ${id}`,
    schema: z.object({ input: z.string() }),
    execute: async () => 'ok',
  };
}

describe('ToolRegistry', () => {
  describe('MAX_TOOLS', () => {
    test('MAX_TOOLS is 50', () => {
      expect(MAX_TOOLS).toBe(50);
    });

    test('registering 25 tools does not throw on validate', () => {
      const registry = new ToolRegistry();
      for (let i = 0; i < 25; i++) {
        registry.register(makeTool(`tool_${i}`));
      }
      expect(() => registry.validate()).not.toThrow();
    });

    test('registering 51 tools throws on validate', () => {
      const registry = new ToolRegistry();
      for (let i = 0; i < 51; i++) {
        registry.register(makeTool(`tool_${i}`));
      }
      expect(() => registry.validate()).toThrow(/Too many tools: 51 > 50/);
    });
  });

  describe('TOOL_DIRS', () => {
    test('includes consolidated, coding, and agent directories', () => {
      expect(TOOL_DIRS).toContain('tools/consolidated');
      expect(TOOL_DIRS).toContain('tools/coding');
      expect(TOOL_DIRS).toContain('tools/agent');
    });
  });

  describe('discoverTools', () => {
    test('loads 14 bundled financial tools', async () => {
      const registry = new ToolRegistry();
      const plugins = await registry.discoverTools();
      const ids = plugins.map((p) => p.id);
      expect(plugins.length).toBeGreaterThanOrEqual(14);
      expect(ids).toContain('market_data');
      expect(ids).toContain('web_search');
      expect(ids).toContain('streaming');
    });

    test('scans all TOOL_DIRS via glob', async () => {
      const registry = new ToolRegistry();
      const plugins = await registry.discoverTools();
      expect(plugins.length).toBeGreaterThanOrEqual(14);
    });
  });

  describe('validate', () => {
    test('throws on missing schema', () => {
      const registry = new ToolRegistry();
      const broken = makeTool('broken');
      (broken as any).schema = undefined;
      registry.register(broken);
      expect(() => registry.validate()).toThrow(/missing schema/);
    });

    test('validate detects missing riskLevel', () => {
      const registry = new ToolRegistry();
      const broken = makeTool('broken');
      (broken as any).riskLevel = undefined;
      registry.register(broken);
      expect(() => registry.validate()).toThrow(/missing riskLevel/);
    });
  });
});
