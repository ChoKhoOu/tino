import { z } from 'zod';
import type { ToolPlugin, ToolContext } from '@/domain/tool-plugin.js';
import type { McpTool, McpClient } from './mcp-client.js';
import type { ToolRegistry } from '@/runtime/tool-registry.js';

interface McpContentItem {
  type: string;
  text?: string;
}

interface McpResponse {
  content?: McpContentItem[];
}

function jsonSchemaToZod(inputSchema?: Record<string, unknown>): z.ZodType {
  if (!inputSchema) return z.object({});

  const properties = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return z.object({});

  const requiredFields = (inputSchema.required as string[]) ?? [];
  const shape: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema: z.ZodType;

    switch (prop.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
      case 'integer':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      default:
        fieldSchema = z.any();
    }

    shape[key] = requiredFields.includes(key) ? fieldSchema : fieldSchema.optional();
  }

  return z.object(shape);
}

function formatMcpResult(raw: unknown): string {
  if (raw == null) return 'MCP tool error: no response';

  const response = raw as McpResponse;
  if (response.content && Array.isArray(response.content)) {
    const texts = response.content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text!);
    if (texts.length > 0) return texts.join('\n');
  }

  return JSON.stringify(raw);
}

export function mcpToolToPlugin(
  serverName: string,
  mcpTool: McpTool,
  client: McpClient,
): ToolPlugin {
  const id = `mcp__${serverName}__${mcpTool.name}`;
  const description = mcpTool.description ?? `MCP tool ${mcpTool.name} from server ${serverName}`;
  const schema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    id,
    domain: 'mcp',
    riskLevel: 'moderate',
    description,
    schema,
    execute: async (args: unknown, _ctx: ToolContext): Promise<string> => {
      try {
        const result = await client.callTool(
          mcpTool.name,
          (args as Record<string, unknown>) ?? {},
        );
        return formatMcpResult(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `MCP tool error: ${msg}`;
      }
    },
  };
}

export async function registerMcpTools(
  registry: ToolRegistry,
  serverName: string,
  client: McpClient,
): Promise<number> {
  let tools: McpTool[];
  try {
    tools = await client.listTools();
  } catch {
    return 0;
  }

  for (const mcpTool of tools) {
    const plugin = mcpToolToPlugin(serverName, mcpTool, client);
    registry.registerDynamic(plugin);
  }

  return tools.length;
}
