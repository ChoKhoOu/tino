import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { mcpToolToPlugin, registerMcpTools } from './mcp-tool-adapter.js';
import type { McpTool, McpClient } from './mcp-client.js';

const CTX = { signal: AbortSignal.timeout(5000), onProgress: () => {}, config: {} };

function mockClient(tools: McpTool[] = [], callResult: unknown = { content: [{ type: 'text', text: 'result' }] }): McpClient {
  return {
    listTools: async () => tools,
    callTool: async () => callResult,
    connect: async () => true,
    disconnect: async () => {},
    isConnected: () => true,
  } as unknown as McpClient;
}

describe('mcpToolToPlugin', () => {
  test('generates correct tool ID with double underscore separator', () => {
    const plugin = mcpToolToPlugin('filesystem', { name: 'read_file', description: 'Reads a file' }, mockClient());
    expect(plugin.id).toBe('mcp__filesystem__read_file');
  });

  test('sets domain to mcp and riskLevel to moderate', () => {
    const plugin = mcpToolToPlugin('myserver', { name: 'search' }, mockClient());
    expect(plugin.domain).toBe('mcp');
    expect(plugin.riskLevel).toBe('moderate');
  });

  test('uses tool description or falls back to default', () => {
    const c = mockClient();
    expect(mcpToolToPlugin('s', { name: 't', description: 'Custom desc' }, c).description).toBe('Custom desc');
    expect(mcpToolToPlugin('s', { name: 't' }, c).description).toBe('MCP tool t from server s');
  });

  test('converts inputSchema properties to Zod object schema', () => {
    const tool: McpTool = {
      name: 'greet',
      inputSchema: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] },
    };
    const plugin = mcpToolToPlugin('test', tool, mockClient());
    expect(plugin.schema.safeParse({ name: 'Alice', age: 30 }).success).toBe(true);
  });

  test('uses z.object({}) when no inputSchema provided', () => {
    const plugin = mcpToolToPlugin('test', { name: 'no_params' }, mockClient());
    expect(plugin.schema.safeParse({}).success).toBe(true);
  });

  test('execute calls client.callTool with correct arguments', async () => {
    let calledName = '';
    let calledArgs: Record<string, unknown> = {};
    const client = {
      ...mockClient(),
      callTool: async (name: string, args: Record<string, unknown>) => {
        calledName = name;
        calledArgs = args;
        return { content: [{ type: 'text', text: 'hello' }] };
      },
    } as unknown as McpClient;

    const plugin = mcpToolToPlugin('server', { name: 'greet' }, client);
    await plugin.execute({ message: 'hi' }, CTX);
    expect(calledName).toBe('greet');
    expect(calledArgs).toEqual({ message: 'hi' });
  });

  test('execute formats text content from MCP response', async () => {
    const client = mockClient([], { content: [{ type: 'text', text: 'line1' }, { type: 'text', text: 'line2' }] });
    const result = await mcpToolToPlugin('s', { name: 't' }, client).execute({}, CTX);
    expect(result).toBe('line1\nline2');
  });

  test('execute returns JSON for non-standard MCP responses', async () => {
    const result = await mcpToolToPlugin('s', { name: 't' }, mockClient([], { data: 42 })).execute({}, CTX);
    expect(result).toBe(JSON.stringify({ data: 42 }));
  });

  test('execute returns error message when callTool throws', async () => {
    const client = { ...mockClient(), callTool: async () => { throw new Error('Connection lost'); } } as unknown as McpClient;
    const result = await mcpToolToPlugin('s', { name: 't' }, client).execute({}, CTX);
    expect(result).toContain('MCP tool error');
    expect(result).toContain('Connection lost');
  });

  test('execute returns error message when callTool returns null', async () => {
    const result = await mcpToolToPlugin('s', { name: 't' }, mockClient([], null)).execute({}, CTX);
    expect(result).toContain('MCP tool error');
  });
});

describe('registerMcpTools', () => {
  test('discovers tools from client and registers them in registry', async () => {
    const tools: McpTool[] = [{ name: 'read', description: 'Read file' }, { name: 'write', description: 'Write file' }];
    const { ToolRegistry } = await import('@/runtime/tool-registry.js');
    const registry = new ToolRegistry();
    const count = await registerMcpTools(registry, 'fs', mockClient(tools));
    expect(count).toBe(2);
    expect(registry.get('mcp__fs__read')).toBeDefined();
    expect(registry.get('mcp__fs__write')).toBeDefined();
  });

  test('returns 0 when client lists no tools', async () => {
    const { ToolRegistry } = await import('@/runtime/tool-registry.js');
    const registry = new ToolRegistry();
    expect(await registerMcpTools(registry, 'empty', mockClient([]))).toBe(0);
  });

  test('MCP tools do not count against MAX_TOOLS limit', async () => {
    const { ToolRegistry, MAX_TOOLS } = await import('@/runtime/tool-registry.js');
    const registry = new ToolRegistry();
    for (let i = 0; i < MAX_TOOLS; i++) {
      registry.register({ id: `tool_${i}`, domain: 'test', riskLevel: 'safe', description: `Tool ${i}`, schema: z.object({ input: z.string() }), execute: async () => 'ok' });
    }
    await registerMcpTools(registry, 'server', mockClient([{ name: 'extra', description: 'Extra' }]));
    expect(() => registry.validate()).not.toThrow();
    expect(registry.get('mcp__server__extra')).toBeDefined();
  });

  test('returns 0 and does not throw when listTools fails', async () => {
    const client = { ...mockClient(), listTools: async () => { throw new Error('timeout'); } } as unknown as McpClient;
    const { ToolRegistry } = await import('@/runtime/tool-registry.js');
    const registry = new ToolRegistry();
    expect(await registerMcpTools(registry, 'broken', client)).toBe(0);
  });
});

describe('JSON Schema to Zod conversion', () => {
  function schemaPlugin(properties: Record<string, unknown>, required?: string[]) {
    return mcpToolToPlugin('s', { name: 'test', inputSchema: { type: 'object', properties, required } }, mockClient());
  }

  test('converts string properties', () => {
    expect(schemaPlugin({ name: { type: 'string' } }).schema.safeParse({ name: 'hello' }).success).toBe(true);
  });

  test('converts number properties', () => {
    expect(schemaPlugin({ count: { type: 'number' } }).schema.safeParse({ count: 42 }).success).toBe(true);
  });

  test('converts boolean properties', () => {
    expect(schemaPlugin({ flag: { type: 'boolean' } }).schema.safeParse({ flag: true }).success).toBe(true);
  });

  test('uses z.any() for complex/unknown types', () => {
    expect(schemaPlugin({ data: { type: 'array', items: { type: 'object' } } }).schema.safeParse({ data: [{ a: 1 }] }).success).toBe(true);
  });

  test('makes required fields required and others optional', () => {
    const plugin = schemaPlugin({ req: { type: 'string' }, opt: { type: 'string' } }, ['req']);
    expect(plugin.schema.safeParse({ opt: 'val' }).success).toBe(false);
    expect(plugin.schema.safeParse({ req: 'val' }).success).toBe(true);
  });
});
