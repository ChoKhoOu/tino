import { tool, type ToolSet } from 'ai';
import type { ToolPlugin, ToolContext } from '@/domain/index.js';

const MAX_TOOLS = 20;

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
    const glob = new Bun.Glob('**/*.tool.ts');
    const discovered: ToolPlugin[] = [];

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
