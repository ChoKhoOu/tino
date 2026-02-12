import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import type { ToolContext } from '@/domain/index.js';
import type { LspManager } from '@/lsp/lsp-manager.js';
import { configureLspDiagnostics, resetLspDiagnostics } from './lsp-diagnostics-helper.js';
import plugin from './edit.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'edit-tool-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('edit_file tool metadata', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('edit_file');
    expect(plugin.domain).toBe('coding');
    expect(plugin.riskLevel).toBe('moderate');
  });
});

describe('exact match replacement', () => {
  test('replaces exact match in file', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'hello world\ngoodbye world\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'hello world', newString: 'hi world' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hi world\ngoodbye world\n');
  });

  test('replaces multi-line exact match', async () => {
    const filePath = join(tempDir, 'multi.txt');
    await writeFile(filePath, 'line1\nline2\nline3\nline4\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'line2\nline3', newString: 'replaced2\nreplaced3' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('line1\nreplaced2\nreplaced3\nline4\n');
  });
});

describe('oldString not found', () => {
  test('returns error when oldString not in file', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'hello world\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'does not exist', newString: 'replacement' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toContain('not found');
  });
});

describe('multiple matches', () => {
  test('returns error when multiple matches found without replaceAll', async () => {
    const filePath = join(tempDir, 'dup.txt');
    await writeFile(filePath, 'foo bar\nfoo baz\nfoo qux\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'foo', newString: 'replaced' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toContain('multiple matches');
  });

  test('replaceAll=true replaces all occurrences', async () => {
    const filePath = join(tempDir, 'dup.txt');
    await writeFile(filePath, 'foo bar\nfoo baz\nfoo qux\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'foo', newString: 'replaced', replaceAll: true },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.replacements).toBe(3);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('replaced bar\nreplaced baz\nreplaced qux\n');
  });
});

describe('whitespace-normalized match', () => {
  test('matches despite trailing whitespace differences', async () => {
    const filePath = join(tempDir, 'ws.txt');
    await writeFile(filePath, 'line A\nline B\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'line A  \nline B  ', newString: 'replaced A\nreplaced B' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('replaced A\nreplaced B\n');
  });

  test('matches despite CRLF vs LF differences', async () => {
    const filePath = join(tempDir, 'crlf.txt');
    await writeFile(filePath, 'line1\r\nline2\r\nline3\r\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'line1\nline2', newString: 'replaced1\nreplaced2' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('replaced1');
    expect(content).toContain('replaced2');
  });
});

describe('indent-flexible match', () => {
  test('matches when oldString has different indentation level', async () => {
    const filePath = join(tempDir, 'indent.ts');
    await writeFile(filePath, '    function foo() {\n        return 1;\n    }\n');

    const raw = await plugin.execute(
      {
        filePath,
        oldString: '  function foo() {\n      return 1;\n  }',
        newString: '    function bar() {\n        return 2;\n    }',
      },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('    function bar() {\n        return 2;\n    }\n');
  });

  test('matches when oldString uses tabs but file uses spaces', async () => {
    const filePath = join(tempDir, 'tabs.ts');
    await writeFile(filePath, '    if (true) {\n        doStuff();\n    }\n');

    const raw = await plugin.execute(
      {
        filePath,
        oldString: '\tif (true) {\n\t\tdoStuff();\n\t}',
        newString: '    if (false) {\n        doOther();\n    }',
      },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('    if (false) {\n        doOther();\n    }\n');
  });
});

describe('security: .git/ path rejection', () => {
  test('rejects edits to .git/ directory', async () => {
    const filePath = join(tempDir, '.git', 'config');
    const raw = await plugin.execute(
      { filePath, oldString: 'foo', newString: 'bar' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toContain('.git');
  });

  test('rejects edits to nested .git/ path', async () => {
    const filePath = join(tempDir, 'repo', '.git', 'hooks', 'pre-commit');
    const raw = await plugin.execute(
      { filePath, oldString: 'foo', newString: 'bar' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toContain('.git');
  });
});

describe('edge cases', () => {
  test('rejects empty oldString', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'hello world\n');

    const raw = await plugin.execute(
      { filePath, oldString: '', newString: 'something' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toContain('empty');
  });

  test('returns error when file does not exist', async () => {
    const filePath = join(tempDir, 'nonexistent.txt');

    const raw = await plugin.execute(
      { filePath, oldString: 'foo', newString: 'bar' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.error).toBeDefined();
  });

  test('can delete text by replacing with empty string', async () => {
    const filePath = join(tempDir, 'delete.txt');
    await writeFile(filePath, 'keep this\nremove this\nkeep this too\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'remove this\n', newString: '' },
      ctx,
    );
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('keep this\nkeep this too\n');
  });
});

describe('LSP diagnostics integration', () => {
  afterEach(() => {
    resetLspDiagnostics();
  });

  afterAll(() => {
    resetLspDiagnostics();
  });

  function mockManager(diagnosticsResponse: unknown): LspManager {
    return {
      getClientForFile: async () => ({
        didOpen: async () => {},
        didChange: async () => {},
        request: async () => diagnosticsResponse,
      }),
    } as unknown as LspManager;
  }

  test('appends diagnostics to single-match edit result', async () => {
    configureLspDiagnostics(mockManager({
      items: [{
        range: { start: { line: 0, character: 0 } },
        message: "Type 'string' is not assignable to type 'number'",
        severity: 1,
      }],
    }));

    const filePath = join(tempDir, 'diag.ts');
    await writeFile(filePath, 'const x: number = 1;');

    const raw = await plugin.execute(
      { filePath, oldString: 'const x: number = 1;', newString: 'const x: number = "bad";' },
      ctx,
    );

    expect(raw).toContain('"success":true');
    expect(raw).toContain('LSP Diagnostics (1 error)');
    expect(raw).toContain("Type 'string' is not assignable to type 'number'");
  });

  test('appends diagnostics to replaceAll edit result', async () => {
    configureLspDiagnostics(mockManager({
      items: [{
        range: { start: { line: 0, character: 0 } },
        message: "Cannot find name 'y'",
        severity: 1,
      }],
    }));

    const filePath = join(tempDir, 'diag2.ts');
    await writeFile(filePath, 'let x = 1;\nlet x = 2;\n');

    const raw = await plugin.execute(
      { filePath, oldString: 'let x', newString: 'let y', replaceAll: true },
      ctx,
    );

    expect(raw).toContain('"success":true');
    expect(raw).toContain('LSP Diagnostics');
  });

  test('returns clean result when no LSP errors', async () => {
    configureLspDiagnostics(mockManager({ items: [] }));

    const filePath = join(tempDir, 'clean.ts');
    await writeFile(filePath, 'const a = 1;');

    const raw = await plugin.execute(
      { filePath, oldString: 'const a = 1;', newString: 'const a = 2;' },
      ctx,
    );

    expect(raw).not.toContain('LSP Diagnostics');
    const result = JSON.parse(raw);
    expect(result.success).toBe(true);
  });
});
