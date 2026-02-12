import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { LspClient } from './lsp-client.js';
import { DEFAULT_LSP_SERVER_CONFIGS, detectLanguageId, getServerConfig, type LspServerConfig } from './server-configs.js';

type ClientFactory = (config: LspServerConfig) => Promise<LspClient | null>;

export interface LspManagerOptions {
  rootDir?: string;
  configs?: LspServerConfig[];
  clientFactory?: ClientFactory;
}

export class LspManager {
  private readonly rootDir: string;
  private readonly rootUri: string;
  private readonly configs: LspServerConfig[];
  private readonly clientFactory: ClientFactory;
  private readonly clients = new Map<string, LspClient>();

  constructor(options: LspManagerOptions = {}) {
    this.rootDir = resolve(options.rootDir ?? process.cwd());
    this.rootUri = pathToFileURL(this.rootDir).toString();
    this.configs = options.configs ?? DEFAULT_LSP_SERVER_CONFIGS;
    this.clientFactory = options.clientFactory ?? this.createDefaultClient.bind(this);
  }

  async getClient(languageId: string): Promise<LspClient | null> {
    try {
      const existing = this.clients.get(languageId);
      if (existing) return existing;

      const config = getServerConfig(languageId, this.configs);
      if (!config) return null;

      const client = await this.clientFactory(config);
      if (!client) return null;

      this.clients.set(languageId, client);
      return client;
    } catch {
      return null;
    }
  }

  async getClientForFile(filePath: string): Promise<LspClient | null> {
    try {
      const languageId = detectLanguageId(filePath);
      if (!languageId) return null;
      return await this.getClient(languageId);
    } catch {
      return null;
    }
  }

  async detectProjectLanguages(rootDir = this.rootDir): Promise<string[]> {
    try {
      const detected = new Set<string>();
      for (const config of this.configs) {
        for (const pattern of config.rootPatterns) {
          if (await fileExists(resolve(rootDir, pattern))) {
            detected.add(config.languageId);
            break;
          }
        }
      }
      return [...detected];
    } catch {
      return [];
    }
  }

  async shutdown(): Promise<void> {
    try {
      for (const client of this.clients.values()) {
        try {
          await client.close();
        } catch {}
      }
    } finally {
      this.clients.clear();
    }
  }

  private async createDefaultClient(config: LspServerConfig): Promise<LspClient | null> {
    try {
      const client = new LspClient(config, { rootUri: this.rootUri });
      if (!(await client.connect())) return null;
      if ((await client.initialize()) === null) {
        await client.close();
        return null;
      }
      return client;
    } catch {
      return null;
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}
