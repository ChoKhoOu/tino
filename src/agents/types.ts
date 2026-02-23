import type { AgentDefinition, AgentSource } from '@/domain/agent-def.js';

export interface AgentConfig {
  /** Explicit ID. Falls back to `name` when absent. */
  id?: string;
  name: string;
  description?: string;
  systemPrompt: string;
  allowedTools?: string[];
  model?: string;
  temperature?: number;
  maxTurns?: number;
  color?: string;
}

export interface DiscoveredAgentConfig extends AgentConfig {
  path: string;
  source: AgentSource;
}

export function toAgentDefinition(config: DiscoveredAgentConfig): AgentDefinition {
  return {
    id: config.id ?? config.name,
    name: config.name,
    systemPrompt: config.systemPrompt,
    model: config.model,
    tools: config.allowedTools,
    description: config.description,
    temperature: config.temperature,
    maxTurns: config.maxTurns,
    color: config.color,
    path: config.path,
    source: config.source,
  };
}
