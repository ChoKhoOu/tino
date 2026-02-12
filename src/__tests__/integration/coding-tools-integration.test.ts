import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const TEST_DIR = join(tmpdir(), `tino-coding-test-${Date.now()}`);
const ctx = { signal: new AbortController().signal, onProgress: () => {}, config: {} };

function ensureTestDir() {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
}

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe('coding tools integration', () => {
  test('read_file tool reads content with line numbers', async () => {
    ensureTestDir();
    const filePath = join(TEST_DIR, 'sample.txt');
    writeFileSync(filePath, 'line one\nline two\nline three\n');

    const { default: readTool } = await import('../../tools/coding/read.tool.js');
    const result = await readTool.execute({ filePath }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.content).toContain('1: line one');
    expect(parsed.content).toContain('2: line two');
    expect(parsed.content).toContain('3: line three');
    expect(parsed.totalLines).toBe(3);
  });

  test('write_file tool creates file and reports success', async () => {
    ensureTestDir();
    const filePath = join(TEST_DIR, 'output.txt');

    const { default: writeTool } = await import('../../tools/coding/write.tool.js');
    const result = await writeTool.execute({ filePath, content: 'hello world' }, ctx);
    const parsed = JSON.parse(result.split('\n')[0]);

    expect(parsed.success).toBe(true);
    expect(parsed.bytesWritten).toBeGreaterThan(0);
    expect(existsSync(filePath)).toBe(true);

    const written = await Bun.file(filePath).text();
    expect(written).toBe('hello world');
  });

  test('edit_file tool replaces text in existing file', async () => {
    ensureTestDir();
    const filePath = join(TEST_DIR, 'editable.txt');
    writeFileSync(filePath, 'foo bar baz');

    const { default: editTool } = await import('../../tools/coding/edit.tool.js');
    const result = await editTool.execute(
      { filePath, oldString: 'bar', newString: 'qux' },
      ctx,
    );
    const parsed = JSON.parse(result.split('\n')[0]);

    expect(parsed.success).toBe(true);
    const updated = await Bun.file(filePath).text();
    expect(updated).toBe('foo qux baz');
  });

  test('bash tool executes shell command and captures output', async () => {
    const { default: bashTool } = await import('../../tools/coding/bash.tool.js');
    const result = await bashTool.execute({ command: 'echo hello' }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.data.exitCode).toBe(0);
    expect(parsed.data.stdout.trim()).toBe('hello');
  });

  test('grep tool finds pattern in files', async () => {
    ensureTestDir();
    writeFileSync(join(TEST_DIR, 'a.txt'), 'needle in haystack\n');
    writeFileSync(join(TEST_DIR, 'b.txt'), 'no match here\n');

    const { default: grepTool } = await import('../../tools/coding/grep.tool.js');
    const result = await grepTool.execute({ pattern: 'needle', path: TEST_DIR }, ctx);

    expect(result).toContain('needle');
    expect(result).toContain('a.txt');
  });

  test('glob tool finds files matching pattern', async () => {
    ensureTestDir();
    writeFileSync(join(TEST_DIR, 'file1.ts'), '');
    writeFileSync(join(TEST_DIR, 'file2.ts'), '');
    writeFileSync(join(TEST_DIR, 'file3.js'), '');

    const { default: globTool } = await import('../../tools/coding/glob.tool.js');
    const result = await globTool.execute({ pattern: '*.ts', path: TEST_DIR }, ctx);
    const parsed = JSON.parse(result);

    expect(parsed.filePaths.length).toBe(2);
    expect(parsed.filePaths.some((p: string) => p.endsWith('file1.ts'))).toBe(true);
    expect(parsed.filePaths.some((p: string) => p.endsWith('file2.ts'))).toBe(true);
  });
});
