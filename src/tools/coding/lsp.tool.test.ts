import { describe, test, expect, beforeEach } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import type { LspManager } from '@/lsp/lsp-manager.js';
import type { LspClient } from '@/lsp/lsp-client.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

function makeMockClient(overrides: Partial<LspClient> = {}): LspClient {
  return {
    definition: async () => null,
    references: async () => null,
    hover: async () => null,
    documentSymbol: async () => null,
    ...overrides,
  } as unknown as LspClient;
}

function makeMockManager(client: LspClient | null = null): LspManager {
  return {
    getClientForFile: async () => client,
  } as unknown as LspManager;
}

async function loadTool() {
  const mod = await import('./lsp.tool.js');
  return mod;
}

let toolModule: Awaited<ReturnType<typeof loadTool>>;

beforeEach(async () => { toolModule = await loadTool(); });

function configure(client: LspClient | null = null) {
  toolModule.configureLspTool(makeMockManager(client));
}

function run(args: Record<string, unknown>) {
  return toolModule.default.execute(args, ctx);
}

const pos = (action: string, line = 1, character = 0) =>
  ({ action, filePath: '/tmp/test.ts', line, character });

const loc = (line: number, char: number) =>
  ({ range: { start: { line, character: char } } });

describe('lsp tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(toolModule.default.id).toBe('lsp');
    expect(toolModule.default.domain).toBe('coding');
    expect(toolModule.default.riskLevel).toBe('safe');
  });

  test('returns error when LSP manager not configured', async () => {
    toolModule.configureLspTool(null as unknown as LspManager);
    expect(await run(pos('hover'))).toContain('LSP not available');
  });

  test('returns error when no client found for file', async () => {
    configure(null);
    expect(await run(pos('hover'))).toContain('No LSP server available');
  });

  test('goto_definition formats location', async () => {
    configure(makeMockClient({
      definition: async () => ({ uri: 'file:///src/foo.ts', ...loc(41, 9) }),
    }));
    const result = await run(pos('goto_definition', 10, 5));
    expect(result).toContain('Definition found at');
    expect(result).toContain('/src/foo.ts');
    expect(result).toContain('42');
    expect(result).toContain('10');
  });

  test('goto_definition handles array result', async () => {
    configure(makeMockClient({
      definition: async () => [
        { uri: 'file:///src/a.ts', ...loc(0, 0) },
        { uri: 'file:///src/b.ts', ...loc(9, 4) },
      ],
    }));
    const result = await run(pos('goto_definition'));
    expect(result).toContain('/src/a.ts');
    expect(result).toContain('/src/b.ts');
  });

  test('goto_definition returns message when no result', async () => {
    configure(makeMockClient({ definition: async () => null }));
    expect(await run(pos('goto_definition'))).toContain('No definition found');
  });

  test('find_references formats list', async () => {
    configure(makeMockClient({
      references: async () => [
        { uri: 'file:///src/a.ts', ...loc(9, 4) },
        { uri: 'file:///src/b.ts', ...loc(19, 2) },
        { uri: 'file:///src/c.ts', ...loc(0, 0) },
      ],
    }));
    const result = await run(pos('find_references', 5, 3));
    expect(result).toContain('Found 3 references');
    expect(result).toContain('/src/a.ts:10:5');
    expect(result).toContain('/src/b.ts:20:3');
    expect(result).toContain('/src/c.ts:1:1');
  });

  test('find_references returns message when empty', async () => {
    configure(makeMockClient({ references: async () => [] }));
    expect(await run(pos('find_references'))).toContain('No references found');
  });

  test('hover shows type info', async () => {
    configure(makeMockClient({
      hover: async () => ({
        contents: { kind: 'markdown', value: '```typescript\nfunction foo(): void\n```' },
      }),
    }));
    expect(await run(pos('hover'))).toContain('function foo(): void');
  });

  test('hover handles string contents', async () => {
    configure(makeMockClient({ hover: async () => ({ contents: 'string type info' }) }));
    expect(await run(pos('hover'))).toContain('string type info');
  });

  test('hover returns message when no result', async () => {
    configure(makeMockClient({ hover: async () => null }));
    expect(await run(pos('hover'))).toContain('No hover information');
  });

  test('document_symbols formats list', async () => {
    configure(makeMockClient({
      documentSymbol: async () => [
        { name: 'MyClass', kind: 5, ...loc(0, 0) },
        { name: 'myFunc', kind: 12, ...loc(10, 0) },
      ],
    }));
    const result = await run({ action: 'document_symbols', filePath: '/tmp/test.ts' });
    expect(result).toContain('Found 2 symbols');
    expect(result).toContain('MyClass');
    expect(result).toContain('myFunc');
  });

  test('document_symbols returns message when empty', async () => {
    configure(makeMockClient({ documentSymbol: async () => [] }));
    expect(await run({ action: 'document_symbols', filePath: '/tmp/test.ts' })).toContain('No symbols found');
  });

  test('diagnostics returns info message', async () => {
    configure(makeMockClient());
    const result = await run({ action: 'diagnostics', filePath: '/tmp/test.ts' });
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('diagnostic');
  });

  test('handles LSP errors gracefully', async () => {
    configure(makeMockClient({
      definition: async () => { throw new Error('LSP crashed'); },
    }));
    expect(await run(pos('goto_definition'))).toContain('LSP crashed');
  });

  test('requires line and character for position-based actions', async () => {
    configure(makeMockClient());
    const result = await run({ action: 'goto_definition', filePath: '/tmp/test.ts' });
    expect(result).toContain('line');
    expect(result).toContain('character');
  });
});
