import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LspClient } from './lsp-client.js';
import { LspManager } from './lsp-manager.js';
import { DEFAULT_LSP_SERVER_CONFIGS, TYPESCRIPT_SERVER_CONFIG } from './server-configs.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const tempDirs: string[] = [];

interface MockProcessController {
  process: ReturnType<typeof Bun.spawn>;
  writes: string[];
  pushMessage: (message: unknown) => void;
  close: () => void;
}

function frameLspMessage(message: unknown): Uint8Array {
  const body = JSON.stringify(message);
  return encoder.encode(`Content-Length: ${encoder.encode(body).byteLength}\r\n\r\n${body}`);
}

function createMockProcess(): MockProcessController {
  let stdoutController!: ReadableStreamDefaultController<Uint8Array>;
  let resolveExit!: (code: number) => void;
  const writes: string[] = [];

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      stdoutController = controller;
    },
  });

  const exited = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });

  const process = {
    pid: 9999,
    stdin: {
      write(chunk: string | Uint8Array) {
        writes.push(typeof chunk === 'string' ? chunk : decoder.decode(chunk));
      },
      end() {},
    },
    stdout,
    stderr: new ReadableStream<Uint8Array>(),
    exited,
    kill() {
      resolveExit(0);
      stdoutController.close();
    },
  } as unknown as ReturnType<typeof Bun.spawn>;

  return {
    process,
    writes,
    pushMessage(message: unknown) {
      stdoutController.enqueue(frameLspMessage(message));
    },
    close() {
      resolveExit(0);
      stdoutController.close();
    },
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 200): Promise<void> {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for test condition');
    }
    await Bun.sleep(1);
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('LSP integration modules', () => {
  test('LspClient sends JSON-RPC requests with Content-Length framing', async () => {
    const mockProc = createMockProcess();
    const client = new LspClient(TYPESCRIPT_SERVER_CONFIG, {
      rootUri: 'file:///workspace',
      spawnProcess: () => mockProc.process,
    });

    expect(await client.connect()).toBe(true);

    const initializePromise = client.initialize();
    await waitFor(() => mockProc.writes.length > 0);
    const raw = mockProc.writes[0] ?? '';
    const [header, body = ''] = raw.split('\r\n\r\n');
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/);
    expect(lengthMatch).not.toBeNull();
    expect(Number(lengthMatch?.[1] ?? -1)).toBe(encoder.encode(body).byteLength);

    const payload = JSON.parse(body) as Record<string, unknown>;
    expect(payload).toMatchObject({ jsonrpc: '2.0', method: 'initialize' });

    mockProc.pushMessage({
      jsonrpc: '2.0',
      id: payload.id,
      result: { capabilities: {} },
    });

    expect(await initializePromise).toEqual({ capabilities: {} });
    await client.close();
  });

  test('LspManager returns null for unsupported languages', async () => {
    const manager = new LspManager({ clientFactory: async () => null });
    expect(await manager.getClient('rust')).toBeNull();
    await manager.shutdown();
  });

  test('LspManager detects language from file extension', async () => {
    const requested: string[] = [];
    const fakeClient = { close: async () => {} } as unknown as LspClient;
    const manager = new LspManager({
      clientFactory: async (config) => {
        requested.push(config.languageId);
        return fakeClient;
      },
    });

    const client = await manager.getClientForFile('/tmp/example.tsx');
    expect(client).toBe(fakeClient);
    expect(requested).toEqual(['typescript']);
    await manager.shutdown();
  });

  test('LspManager handles client creation failure gracefully', async () => {
    const manager = new LspManager({
      clientFactory: async () => null,
    });
    expect(await manager.getClient('python')).toBeNull();
    await manager.shutdown();
  });

  test('server configs include TypeScript and Python defaults', () => {
    const ts = DEFAULT_LSP_SERVER_CONFIGS.find((config) => config.languageId === 'typescript');
    const py = DEFAULT_LSP_SERVER_CONFIGS.find((config) => config.languageId === 'python');

    expect(ts?.command).toBe('typescript-language-server');
    expect(ts?.args).toEqual(['--stdio']);
    expect(py?.command).toBe('pyright-langserver');
    expect(py?.args).toEqual(['--stdio']);
  });

  test('project language detection uses root marker files', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'tino-lsp-manager-'));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, 'nested'), { recursive: true });
    writeFileSync(join(rootDir, 'package.json'), '{"name":"tino-lsp-test"}');
    writeFileSync(join(rootDir, 'pyproject.toml'), '[project]\nname = "demo"');

    const manager = new LspManager({ rootDir, clientFactory: async () => null });
    const languages = await manager.detectProjectLanguages();

    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
    await manager.shutdown();
  });
});
