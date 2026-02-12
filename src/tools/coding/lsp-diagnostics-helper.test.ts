import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { configureLspDiagnostics, getPostEditDiagnostics, resetLspDiagnostics } from './lsp-diagnostics-helper.js';
import type { LspManager } from '@/lsp/lsp-manager.js';

function createMockClient(diagnosticsResponse: unknown = null) {
  return {
    didOpen: async (_uri: string, _lang: string, _text: string) => {},
    didChange: async (_uri: string, _text: string, _version: number) => {},
    request: async (_method: string, _params?: unknown) => diagnosticsResponse,
  };
}

function createMockManager(client: ReturnType<typeof createMockClient> | null = null): LspManager {
  return {
    getClientForFile: async (_filePath: string) => client,
  } as unknown as LspManager;
}

beforeEach(() => {
  resetLspDiagnostics();
});

afterAll(() => {
  resetLspDiagnostics();
});

describe('configureLspDiagnostics', () => {
  test('sets the LspManager instance', () => {
    const manager = createMockManager();
    configureLspDiagnostics(manager);
  });
});

describe('getPostEditDiagnostics', () => {
  test('returns empty string when no manager configured', async () => {
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'const x: number = 1;');
    expect(result).toBe('');
  });

  test('returns empty string when client not available for file', async () => {
    configureLspDiagnostics(createMockManager(null));
    const result = await getPostEditDiagnostics('/tmp/test.txt', 'hello');
    expect(result).toBe('');
  });

  test('returns empty string when no diagnostics returned', async () => {
    const client = createMockClient(null);
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'const x = 1;');
    expect(result).toBe('');
  });

  test('returns empty string when diagnostics has no error-level items', async () => {
    const client = createMockClient({
      items: [
        { range: { start: { line: 0, character: 0 } }, message: 'Unused variable', severity: 4 },
      ],
    });
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'const x = 1;');
    expect(result).toBe('');
  });

  test('formats error-level diagnostics', async () => {
    const client = createMockClient({
      items: [
        {
          range: { start: { line: 4, character: 10 } },
          message: "Type 'string' is not assignable to type 'number'",
          severity: 1,
        },
      ],
    });
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'const x: number = "hello";');

    expect(result).toContain('LSP Diagnostics (1 error)');
    expect(result).toContain("line 5: Type 'string' is not assignable to type 'number'");
  });

  test('formats multiple error diagnostics', async () => {
    const client = createMockClient({
      items: [
        {
          range: { start: { line: 2, character: 0 } },
          message: "Cannot find name 'foo'",
          severity: 1,
        },
        {
          range: { start: { line: 7, character: 5 } },
          message: "Property 'bar' does not exist on type 'X'",
          severity: 1,
        },
        {
          range: { start: { line: 10, character: 0 } },
          message: 'Unused import',
          severity: 2, // warning — should be excluded
        },
      ],
    });
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'some content');

    expect(result).toContain('LSP Diagnostics (2 errors)');
    expect(result).toContain("line 3: Cannot find name 'foo'");
    expect(result).toContain("line 8: Property 'bar' does not exist on type 'X'");
    expect(result).not.toContain('Unused import');
  });

  test('handles publishDiagnostics format (array of diagnostics)', async () => {
    const client = createMockClient({
      items: [
        {
          range: { start: { line: 0, character: 0 } },
          message: 'Syntax error',
          severity: 1,
        },
      ],
    });
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'bad code');

    expect(result).toContain('LSP Diagnostics');
    expect(result).toContain('Syntax error');
  });

  test('gracefully handles request throwing an error', async () => {
    const client = createMockClient(null);
    client.request = async () => { throw new Error('LSP crashed'); };
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'const x = 1;');
    expect(result).toBe('');
  });

  test('calls didOpen with correct URI and content', async () => {
    let capturedUri = '';
    let capturedText = '';
    const client = createMockClient(null);
    client.didOpen = async (uri: string, _lang: string, text: string) => {
      capturedUri = uri;
      capturedText = text;
    };
    configureLspDiagnostics(createMockManager(client));
    await getPostEditDiagnostics('/tmp/test.ts', 'const x = 1;');

    expect(capturedUri).toBe('file:///tmp/test.ts');
    expect(capturedText).toBe('const x = 1;');
  });

  test('caps diagnostics output at 10 items', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      range: { start: { line: i, character: 0 } },
      message: `Error ${i + 1}`,
      severity: 1,
    }));
    const client = createMockClient({ items });
    configureLspDiagnostics(createMockManager(client));
    const result = await getPostEditDiagnostics('/tmp/test.ts', 'bad code');

    expect(result).toContain('LSP Diagnostics (15 errors)');
    expect(result).toContain('Error 1');
    expect(result).toContain('Error 10');
    expect(result).toContain('... and 5 more');
    expect(result).not.toContain('Error 11');
  });
});
