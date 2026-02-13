import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig } from './mcp-config.js';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

const MCP_CLIENT_VERSION = '1.0.0';

export class McpClient {
  private readonly name: string;
  private readonly config: McpServerConfig;
  private client: Client | null = null;
  private connected = false;

  constructor(name: string, config: McpServerConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<boolean> {
    if (this.connected && this.client) {
      return true;
    }

    try {
      const transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
        stderr: 'pipe',
      });

      const client = new Client({
        name: this.name,
        version: MCP_CLIENT_VERSION,
      });

      await client.connect(transport);
      this.client = client;
      this.connected = true;
      return true;
    } catch {
      this.client = null;
      this.connected = false;
      return false;
    }
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.client || !this.connected) {
      return [];
    }

    try {
      const response = await this.client.listTools();
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    } catch {
      return [];
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.connected) {
      return null;
    }

    try {
      return await this.client.callTool({
        name,
        arguments: args,
      });
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connected = false;

    if (!client) {
      return;
    }

    try {
      await client.close();
    } catch {}
  }

  isConnected(): boolean {
    return this.connected;
  }
}
