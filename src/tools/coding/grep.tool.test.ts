import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolContext } from '@/domain/index.js';
import plugin from './grep.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'grep-test-'));
  await writeFile(join(tempDir, 'hello.ts'), 'const greeting = "hello world";\nconsole.log(greeting);\n');
  await writeFile(join(tempDir, 'math.ts'), 'function add(a: number, b: number) { return a + b; }\nfunction subtract(a: number, b: number) { return a - b; }\n');
  await writeFile(join(tempDir, 'readme.md'), '# Project\nThis is a test project.\n');
  await mkdir(join(tempDir, 'sub'));
  await writeFile(join(tempDir, 'sub', 'nested.ts'), 'export const nested = true;\n');
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('grep tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('grep');
    expect(plugin.domain).toBe('coding');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('finds matches with simple pattern', async () => {
    const result = await plugin.execute({ pattern: 'greeting', path: tempDir }, ctx);
    expect(result).toContain('hello.ts');
    expect(result).toContain('greeting');
  });

  test('finds matches across multiple files', async () => {
    const result = await plugin.execute({ pattern: 'function', path: tempDir }, ctx);
    expect(result).toContain('math.ts');
    expect(result).toContain('function');
  });

  test('searches recursively into subdirectories', async () => {
    const result = await plugin.execute({ pattern: 'nested', path: tempDir }, ctx);
    expect(result).toContain('nested.ts');
    expect(result).toContain('nested');
  });

  test('supports include filter for file types', async () => {
    const result = await plugin.execute({ pattern: '.*', include: '*.md', path: tempDir }, ctx);
    expect(result).toContain('readme.md');
    expect(result).not.toContain('hello.ts');
    expect(result).not.toContain('math.ts');
  });

  test('returns "No matches found" when no results', async () => {
    const result = await plugin.execute({ pattern: 'zzz_nonexistent_zzz', path: tempDir }, ctx);
    expect(result).toBe('No matches found.');
  });

  test('uses file:line: content format', async () => {
    const result = await plugin.execute({ pattern: 'hello world', path: tempDir }, ctx);
    const lines = result.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toMatch(/hello\.ts:\d+:/);
  });

  test('defaults path to current directory when not provided', async () => {
    const result = await plugin.execute({ pattern: 'definePlugin' }, ctx);
    expect(typeof result).toBe('string');
  });

  test('handles regex patterns', async () => {
    const result = await plugin.execute({ pattern: 'add|subtract', path: tempDir }, ctx);
    expect(result).toContain('add');
    expect(result).toContain('subtract');
  });

  test('limits results to max 100 matches', async () => {
    const manyLines = Array.from({ length: 200 }, (_, i) => `match_line_${i}`).join('\n');
    await writeFile(join(tempDir, 'many.txt'), manyLines);

    const result = await plugin.execute({ pattern: 'match_line', path: tempDir }, ctx);
    const matchLines = result.trim().split('\n').filter((l: string) => l.includes('match_line'));
    expect(matchLines.length).toBeLessThanOrEqual(100);
  });
});
