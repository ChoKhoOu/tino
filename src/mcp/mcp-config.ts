import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const PROJECT_MCP_CONFIG = '.tino/mcp.json';
const GLOBAL_MCP_CONFIG = join(homedir(), '.tino', 'mcp.json');

const McpServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
});

const McpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
});

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

function loadMcpServersAtPath(filePath: string): Record<string, McpServerConfig> {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsedJson: unknown = JSON.parse(raw);
    const parsed = McpConfigSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return {};
    }
    return parsed.data.mcpServers;
  } catch {
    return {};
  }
}

export function loadMcpConfig(configPath?: string): Record<string, McpServerConfig> {
  if (configPath) {
    return loadMcpServersAtPath(configPath);
  }

  const globalServers = loadMcpServersAtPath(GLOBAL_MCP_CONFIG);
  const projectServers = loadMcpServersAtPath(PROJECT_MCP_CONFIG);
  return { ...globalServers, ...projectServers };
}
