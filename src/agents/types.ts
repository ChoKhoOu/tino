import type { AgentDefinition, AgentSource } from '@/domain/agent-def.js';

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  model?: string;
  temperature?: number;
}

export interface DiscoveredAgentConfig extends AgentConfig {
  path: string;
  source: AgentSource;
}

export function toAgentDefinition(config: DiscoveredAgentConfig): AgentDefinition {
  return {
    id: config.name,
    name: config.name,
    systemPrompt: config.systemPrompt,
    model: config.model,
    tools: config.allowedTools,
    path: config.path,
    source: config.source,
  };
}
