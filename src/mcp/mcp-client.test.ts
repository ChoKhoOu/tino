import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const connectMock = mock(async () => {});
const listToolsMock = mock(async (): Promise<{ tools: Array<Record<string, unknown>> }> => ({
  tools: [],
}));
const callToolMock = mock<(...args: unknown[]) => Promise<unknown>>(async () => ({ ok: true }));
const closeMock = mock(async () => {});

class MockSdkClient {
  connect = connectMock;
  listTools = listToolsMock;
  callTool = callToolMock;
  close = closeMock;

  constructor(_info: { name: string; version: string }) {}
}

let lastTransportParams: unknown = null;

class MockStdioClientTransport {
  constructor(params: unknown) {
    lastTransportParams = params;
  }
}

mock.module('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: MockSdkClient,
}));

mock.module('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: MockStdioClientTransport,
}));

const { McpClient } = await import('./mcp-client.js');
const { loadMcpConfig } = await import('./mcp-config.js');

let tempDir = '';

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tino-mcp-test-'));
  lastTransportParams = null;
  connectMock.mockReset();
  connectMock.mockImplementation(async () => {});
  listToolsMock.mockReset();
  listToolsMock.mockImplementation(async () => ({ tools: [] }));
  callToolMock.mockReset();
  callToolMock.mockImplementation(async () => ({ ok: true }));
  closeMock.mockReset();
  closeMock.mockImplementation(async () => {});
});

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('loadMcpConfig', () => {
  test('loads server config from JSON file', () => {
    const configPath = join(tempDir, '.tino', 'mcp.json');
    mkdirSync(join(tempDir, '.tino'), { recursive: true });

    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          env: { DEBUG: '1' },
        },
      },
    }, null, 2));

    const config = loadMcpConfig(configPath);

    expect(config.filesystem.command).toBe('npx');
    expect(config.filesystem.args[0]).toBe('-y');
    expect(config.filesystem.env?.DEBUG).toBe('1');
  });

  test('returns empty config when file is missing', () => {
    const config = loadMcpConfig(join(tempDir, '.tino', 'missing.json'));
    expect(config).toEqual({});
  });

  test('returns empty config when schema validation fails', () => {
    const configPath = join(tempDir, '.tino', 'mcp.json');
    mkdirSync(join(tempDir, '.tino'), { recursive: true });

    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        broken: {
          command: 123,
          args: ['--version'],
        },
      },
    }, null, 2));

    const config = loadMcpConfig(configPath);
    expect(config).toEqual({});
  });
});

describe('McpClient', () => {
  test('constructs with disconnected state', () => {
    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    expect(client.isConnected()).toBe(false);
  });

  test('returns false when connection fails', async () => {
    connectMock.mockImplementationOnce(async () => {
      throw new Error('connection failed');
    });

    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    const connected = await client.connect();

    expect(connected).toBe(false);
    expect(client.isConnected()).toBe(false);
  });

  test('lists available tools from connected server', async () => {
    listToolsMock.mockImplementationOnce(async () => ({
      tools: [
        {
          name: 'read_file',
          description: 'Read file content',
          inputSchema: { type: 'object' },
        },
      ],
    }));

    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    const connected = await client.connect();
    const tools = await client.listTools();

    expect(connected).toBe(true);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('read_file');
  });

  test('calls tools and returns server result', async () => {
    callToolMock.mockImplementationOnce(async () => ({
      content: [{ type: 'text', text: 'done' }],
    }));

    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    await client.connect();
    const result = await client.callTool('read_file', { path: '/tmp/demo.txt' });

    expect(callToolMock).toHaveBeenCalledWith({
      name: 'read_file',
      arguments: { path: '/tmp/demo.txt' },
    });
    expect(result).toEqual({ content: [{ type: 'text', text: 'done' }] });
  });

  test('disconnects gracefully', async () => {
    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    await client.connect();
    await client.disconnect();

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(client.isConnected()).toBe(false);
  });

  test('passes stderr pipe to StdioClientTransport to prevent terminal corruption', async () => {
    const client = new McpClient('tino', { command: 'npx', args: ['server'] });
    await client.connect();

    const params = lastTransportParams as Record<string, unknown>;
    expect(params).toBeTruthy();
    expect(params.stderr).toBe('pipe');
  });
});
