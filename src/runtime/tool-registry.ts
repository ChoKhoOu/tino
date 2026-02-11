import { tool, type ToolSet } from 'ai';
import type { ToolPlugin, ToolContext } from '@/domain/index.js';

const MAX_TOOLS = 20;
const BUNDLED_TOOL_LOADERS = [
  () => import('../tools/consolidated/market-data.tool.js'),
  () => import('../tools/consolidated/fundamentals.tool.js'),
  () => import('../tools/consolidated/filings.tool.js'),
  () => import('../tools/consolidated/macro-data.tool.js'),
  () => import('../tools/consolidated/quant-compute.tool.js'),
  () => import('../tools/consolidated/trading-sim.tool.js'),
  () => import('../tools/consolidated/trading-live.tool.js'),
  () => import('../tools/consolidated/strategy-lab.tool.js'),
  () => import('../tools/consolidated/web-search.tool.js'),
  () => import('../tools/consolidated/browser.tool.js'),
  () => import('../tools/consolidated/skill.tool.js'),
  () => import('../tools/consolidated/portfolio.tool.js'),
  () => import('../tools/consolidated/chart.tool.js'),
  () => import('../tools/consolidated/streaming.tool.js'),
] as const;

export class ToolRegistry {
  private plugins = new Map<string, ToolPlugin>();

  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  registerAll(plugins: ToolPlugin[]): void {
    for (const p of plugins) {
      this.register(p);
    }
  }

  get(id: string): ToolPlugin | undefined {
    return this.plugins.get(id);
  }

  getAll(): ToolPlugin[] {
    return [...this.plugins.values()];
  }

  validate(): void {
    const seen = new Set<string>();
    for (const plugin of this.plugins.values()) {
      if (seen.has(plugin.id)) {
        throw new Error(`Duplicate tool ID: ${plugin.id}`);
      }
      seen.add(plugin.id);

      if (!plugin.schema) {
        throw new Error(`Tool ${plugin.id} missing schema`);
      }
      if (!plugin.riskLevel) {
        throw new Error(`Tool ${plugin.id} missing riskLevel`);
      }
    }

    if (this.plugins.size > MAX_TOOLS) {
      throw new Error(`Too many tools: ${this.plugins.size} > ${MAX_TOOLS}`);
    }
  }

  getForModel(ctx: ToolContext): ToolSet {
    const tools: ToolSet = {};
    for (const plugin of this.plugins.values()) {
      tools[plugin.id] = tool({
        description: plugin.description,
        inputSchema: plugin.schema,
        execute: async (args) => plugin.execute(args, ctx),
      });
    }
    return tools;
  }

  async discoverTools(dir: string): Promise<ToolPlugin[]> {
    const discovered: ToolPlugin[] = [];

    for (const load of BUNDLED_TOOL_LOADERS) {
      const mod = await load();
      const plugin: ToolPlugin | undefined = mod.default;
      if (plugin?.id && typeof plugin.execute === 'function') {
        discovered.push(plugin);
      }
    }
    if (discovered.length > 0) {
      return discovered;
    }

    const glob = new Bun.Glob('**/*.tool.ts');

    for await (const path of glob.scan({ cwd: dir, absolute: true })) {
      const mod = await import(path);
      const plugin: ToolPlugin | undefined = mod.default;
      if (plugin?.id && typeof plugin.execute === 'function') {
        discovered.push(plugin);
      }
    }

    return discovered;
  }
}
