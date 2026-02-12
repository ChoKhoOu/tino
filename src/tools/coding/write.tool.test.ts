import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm, mkdir, symlink, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import type { ToolContext } from '@/domain/index.js';
import type { LspManager } from '@/lsp/lsp-manager.js';
import { configureLspDiagnostics, resetLspDiagnostics } from './lsp-diagnostics-helper.js';
import plugin from './write.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'write-tool-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('write_file tool metadata', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('write_file');
    expect(plugin.domain).toBe('coding');
    expect(plugin.riskLevel).toBe('moderate');
  });
});

describe('create new files', () => {
  test('creates a new file with content', async () => {
    const filePath = join(tempDir, 'hello.txt');
    const raw = await plugin.execute({ filePath, content: 'Hello, world!' }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(13);
    expect(result.filePath).toBe(filePath);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('Hello, world!');
  });

  test('auto-creates parent directories', async () => {
    const filePath = join(tempDir, 'a', 'b', 'c', 'deep.txt');
    const raw = await plugin.execute({ filePath, content: 'deep content' }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('deep content');
  });

  test('creates empty file', async () => {
    const filePath = join(tempDir, 'empty.txt');
    const raw = await plugin.execute({ filePath, content: '' }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(0);
  });
});

describe('overwrite existing files', () => {
  test('overwrites existing file and returns diff summary', async () => {
    const filePath = join(tempDir, 'existing.txt');
    await writeFile(filePath, 'line1\nline2\nline3\n');

    const raw = await plugin.execute({ filePath, content: 'line1\nmodified\nline3\nline4\n' }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.overwritten).toBe(true);
    expect(result.diff).toBeDefined();
    expect(result.diff.linesAdded).toBeGreaterThan(0);
    expect(result.diff.linesRemoved).toBeGreaterThan(0);

    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('line1\nmodified\nline3\nline4\n');
  });

  test('no diff when creating new file', async () => {
    const filePath = join(tempDir, 'brand-new.txt');
    const raw = await plugin.execute({ filePath, content: 'new content' }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
    expect(result.overwritten).toBe(false);
    expect(result.diff).toBeUndefined();
  });
});

describe('security: .git/ rejection', () => {
  test('rejects writes to .git/ directory', async () => {
    const filePath = join(tempDir, '.git', 'config');
    const raw = await plugin.execute({ filePath, content: 'malicious' }, ctx);
    const result = JSON.parse(raw);

    expect(result.error).toContain('.git');
  });

  test('rejects writes to nested .git/ path', async () => {
    const filePath = join(tempDir, 'repo', '.git', 'hooks', 'pre-commit');
    const raw = await plugin.execute({ filePath, content: 'malicious' }, ctx);
    const result = JSON.parse(raw);

    expect(result.error).toContain('.git');
  });
});

describe('security: size limit', () => {
  test('rejects content larger than 5MB', async () => {
    const filePath = join(tempDir, 'huge.bin');
    const bigContent = 'x'.repeat(5 * 1024 * 1024 + 1);
    const raw = await plugin.execute({ filePath, content: bigContent }, ctx);
    const result = JSON.parse(raw);

    expect(result.error).toContain('5MB');
  });

  test('accepts content exactly 5MB', async () => {
    const filePath = join(tempDir, 'exact.bin');
    const content = 'x'.repeat(5 * 1024 * 1024);
    const raw = await plugin.execute({ filePath, content }, ctx);
    const result = JSON.parse(raw);

    expect(result.success).toBe(true);
  });
});

describe('security: symlink outside project', () => {
  let cwdLinkDir: string;

  beforeEach(async () => {
    cwdLinkDir = join(process.cwd(), '.test-symlink-escape');
    await mkdir(cwdLinkDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(cwdLinkDir, { recursive: true, force: true });
  });

  test('rejects symlinks pointing outside project root', async () => {
    const linkPath = join(cwdLinkDir, 'escape-link');
    await symlink('/tmp', linkPath);

    const filePath = join(linkPath, 'evil.txt');
    const raw = await plugin.execute({ filePath, content: 'escape' }, ctx);
    const result = JSON.parse(raw);

    expect(result.error).toMatch(/symlink|outside/i);
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

  test('appends diagnostics to write result', async () => {
    configureLspDiagnostics(mockManager({
      items: [{
        range: { start: { line: 2, character: 0 } },
        message: "Cannot find name 'foo'",
        severity: 1,
      }],
    }));

    const filePath = join(tempDir, 'diag.ts');
    const raw = await plugin.execute({ filePath, content: 'const x = foo;' }, ctx);

    expect(raw).toContain('"success":true');
    expect(raw).toContain('LSP Diagnostics (1 error)');
    expect(raw).toContain("Cannot find name 'foo'");
  });

  test('returns clean result when no LSP errors', async () => {
    configureLspDiagnostics(mockManager({ items: [] }));

    const filePath = join(tempDir, 'clean.ts');
    const raw = await plugin.execute({ filePath, content: 'const x = 1;' }, ctx);

    expect(raw).not.toContain('LSP Diagnostics');
    const result = JSON.parse(raw);
    expect(result.success).toBe(true);
  });

  test('does not append diagnostics when manager not configured', async () => {
    const filePath = join(tempDir, 'no-lsp.ts');
    const raw = await plugin.execute({ filePath, content: 'const x = 1;' }, ctx);

    expect(raw).not.toContain('LSP Diagnostics');
    const result = JSON.parse(raw);
    expect(result.success).toBe(true);
  });
});
