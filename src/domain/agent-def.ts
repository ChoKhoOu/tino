import type { PermissionConfig } from './permission.js';

export interface AgentDefinition {
  id: string;
  name: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  permissions?: PermissionConfig;
}
