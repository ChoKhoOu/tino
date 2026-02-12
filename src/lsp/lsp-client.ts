import type { LspServerConfig } from './server-configs.js';
import { concatBytes, indexOfSequence, isReadableStream, isWritablePipe, spawnWithPipes } from './stdio-utils.js';

type JsonRpcId = number | string;
type JsonRpcMessage = { jsonrpc: '2.0'; id?: JsonRpcId; method?: string; params?: unknown; result?: unknown; error?: unknown };
type SpawnProcess = (command: string[]) => ReturnType<typeof Bun.spawn>;
type Bytes = Uint8Array<ArrayBufferLike>;

export interface LspClientOptions {
  rootUri?: string | null;
  onDiagnostics?: (params: unknown) => void;
  spawnProcess?: SpawnProcess;
}

export class LspClient {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly pending = new Map<JsonRpcId, (value: unknown | null) => void>();
  private process: ReturnType<typeof Bun.spawn> | null = null;
  private buffer: Bytes = new Uint8Array(0);
  private requestId = 1;
  private connected = false;

  constructor(private readonly config: LspServerConfig, private readonly options: LspClientOptions = {}) {}

  async connect(): Promise<boolean> {
    if (this.connected && this.process) return true;
    try {
      const spawn = this.options.spawnProcess ?? spawnDefault;
      this.process = spawn([this.config.command, ...this.config.args]);
      this.connected = true;
      void this.readLoop(this.process);
      return true;
    } catch {
      this.connected = false;
      this.process = null;
      return false;
    }
  }

  async initialize(): Promise<unknown | null> {
    const result = await this.request('initialize', {
      processId: process.pid ?? null,
      rootUri: this.options.rootUri ?? null,
      capabilities: {},
      clientInfo: { name: 'tino' },
    });
    this.notify('initialized', {});
    return result;
  }

  async request(method: string, params?: unknown): Promise<unknown | null> {
    if (!(await this.connect())) return null;
    const id = this.requestId++;
    if (!this.writeMessage({ jsonrpc: '2.0', id, method, params })) return null;
    return await new Promise<unknown | null>((resolve) => this.pending.set(id, resolve));
  }

  notify(method: string, params?: unknown): boolean {
    if (!this.connected) return false;
    return this.writeMessage({ jsonrpc: '2.0', method, params });
  }

  async didOpen(uri: string, languageId: string, text: string, version = 1): Promise<void> {
    if (await this.connect()) this.notify('textDocument/didOpen', { textDocument: { uri, languageId, version, text } });
  }

  async didChange(uri: string, text: string, version: number): Promise<void> {
    if (await this.connect()) this.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text }] });
  }

  definition(uri: string, line: number, character: number): Promise<unknown | null> {
    return this.request('textDocument/definition', { textDocument: { uri }, position: { line, character } });
  }

  references(uri: string, line: number, character: number, includeDeclaration = true): Promise<unknown | null> {
    return this.request('textDocument/references', { textDocument: { uri }, position: { line, character }, context: { includeDeclaration } });
  }

  hover(uri: string, line: number, character: number): Promise<unknown | null> {
    return this.request('textDocument/hover', { textDocument: { uri }, position: { line, character } });
  }

  documentSymbol(uri: string): Promise<unknown | null> {
    return this.request('textDocument/documentSymbol', { textDocument: { uri } });
  }

  async close(): Promise<void> {
    const proc = this.process;
    this.connected = false;
    this.process = null;
    if (!proc) return this.resolvePending(null);
    this.writeMessage({ jsonrpc: '2.0', method: 'exit' });
    const stdin = proc.stdin;
    try {
      if (isWritablePipe(stdin)) stdin.end();
    } catch {}
    try {
      proc.kill();
      await proc.exited;
    } catch {}
    this.resolvePending(null);
  }

  private async readLoop(proc: ReturnType<typeof Bun.spawn>): Promise<void> {
    const stdout = proc.stdout;
    if (!isReadableStream(stdout)) {
      this.connected = false;
      this.process = null;
      this.resolvePending(null);
      return;
    }
    const reader = stdout.getReader();
    try {
      while (this.connected) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        this.buffer = concatBytes(this.buffer, value);
        this.consumeBuffer();
      }
    } catch {} finally {
      reader.releaseLock();
      if (this.process === proc) {
        this.connected = false;
        this.process = null;
      }
      this.resolvePending(null);
    }
  }

  private consumeBuffer(): void {
    while (true) {
      const headerEnd = indexOfSequence(this.buffer, [13, 10, 13, 10]);
      if (headerEnd === -1) return;
      const header = this.decoder.decode(this.buffer.slice(0, headerEnd));
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const contentLength = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.byteLength < bodyStart + contentLength) return;
      const body = this.decoder.decode(this.buffer.slice(bodyStart, bodyStart + contentLength));
      this.buffer = this.buffer.slice(bodyStart + contentLength);
      this.handleMessage(body);
    }
  }

  private handleMessage(body: string): void {
    try {
      const message = JSON.parse(body) as JsonRpcMessage;
      if (typeof message.id !== 'undefined' && (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))) {
        const resolve = this.pending.get(message.id);
        if (!resolve) return;
        this.pending.delete(message.id);
        resolve(Object.hasOwn(message, 'error') ? null : (message.result ?? null));
      } else if (message.method === 'textDocument/publishDiagnostics') {
        this.options.onDiagnostics?.(message.params);
      }
    } catch {}
  }

  private writeMessage(message: JsonRpcMessage): boolean {
    const stdin = this.process?.stdin;
    if (!isWritablePipe(stdin)) return false;
    try {
      const body = this.encoder.encode(JSON.stringify(message));
      const header = this.encoder.encode(`Content-Length: ${body.byteLength}\r\n\r\n`);
      stdin.write(concatBytes(header, body));
      return true;
    } catch {
      return false;
    }
  }

  private resolvePending(value: unknown | null): void {
    for (const resolve of this.pending.values()) resolve(value);
    this.pending.clear();
  }
}

function spawnDefault(command: string[]): ReturnType<typeof Bun.spawn> {
  return spawnWithPipes(command);
}
