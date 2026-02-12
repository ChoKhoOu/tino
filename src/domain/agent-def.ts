import type { PermissionConfig } from './permission.js';

/** Source of an agent definition. */
export type AgentSource = 'builtin' | 'user' | 'project';

export interface AgentDefinition {
  id: string;
  name: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  permissions?: PermissionConfig;
  maxTurns?: number;
  color?: string;
  /** File path the agent was loaded from (if file-based). */
  path?: string;
  /** Where this agent was discovered from. */
  source?: AgentSource;
}
