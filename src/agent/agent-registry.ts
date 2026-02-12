import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { AgentDefinition, AgentSource } from '@/domain/agent-def.js';
import { parseAgentFile } from './agent-loader.js';

export class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  discoverFromDirectory(dirPath: string, source: AgentSource): AgentDefinition[] {
    if (!existsSync(dirPath)) {
      return [];
    }

    const discovered: AgentDefinition[] = [];
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const filePath = join(dirPath, entry.name);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const agent = parseAgentFile(content, filePath, source);
        this.register(agent);
        discovered.push(agent);
      } catch {
        // Skip invalid agent files silently
      }
    }

    return discovered;
  }
}
