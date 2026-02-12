import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolContext } from '@/domain/index.js';
import plugin from './read.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'read-tool-'));
  await writeFile(join(tmpDir, 'hello.txt'), 'line one\nline two\nline three\n');
  await writeFile(join(tmpDir, 'empty.txt'), '');
  await mkdir(join(tmpDir, 'subdir'));
  await writeFile(join(tmpDir, 'subdir', 'nested.txt'), 'nested content');

  const binaryBuf = Buffer.alloc(100);
  binaryBuf[0] = 0x89;
  binaryBuf[1] = 0x50;
  binaryBuf[2] = 0x4e;
  binaryBuf[3] = 0x47;
  binaryBuf[10] = 0x00;
  await writeFile(join(tmpDir, 'image.png'), binaryBuf);

  const manyLines = Array.from({ length: 2050 }, (_, i) => `line ${i + 1}`).join('\n');
  await writeFile(join(tmpDir, 'large.txt'), manyLines);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('read tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('read_file');
    expect(plugin.domain).toBe('coding');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('reads text file with line numbers', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'hello.txt') }, ctx);
    const result = JSON.parse(raw);
    expect(result.content).toContain('1: line one');
    expect(result.content).toContain('2: line two');
    expect(result.content).toContain('3: line three');
  });

  test('reads empty file', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'empty.txt') }, ctx);
    const result = JSON.parse(raw);
    expect(result.content).toBe('');
  });

  test('reads directory listing with trailing slash for subdirs', async () => {
    const raw = await plugin.execute({ filePath: tmpDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.type).toBe('directory');
    expect(result.entries).toBeArray();
    expect(result.entries).toContain('subdir/');
    expect(result.entries).toContain('hello.txt');
    expect(result.entries).toContain('empty.txt');
    expect(result.entries).toContain('image.png');
    expect(result.entries).toContain('large.txt');
  });

  test('supports offset parameter (1-indexed)', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'hello.txt'), offset: 2 }, ctx);
    const result = JSON.parse(raw);
    expect(result.content).toContain('2: line two');
    expect(result.content).toContain('3: line three');
    expect(result.content).not.toContain('1: line one');
  });

  test('supports limit parameter', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'hello.txt'), limit: 1 }, ctx);
    const result = JSON.parse(raw);
    expect(result.content).toContain('1: line one');
    expect(result.content).not.toContain('2: line two');
  });

  test('supports offset + limit together', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'hello.txt'), offset: 2, limit: 1 }, ctx);
    const result = JSON.parse(raw);
    expect(result.content).toContain('2: line two');
    expect(result.content).not.toContain('1: line one');
    expect(result.content).not.toContain('3: line three');
  });

  test('default limit is 2000 lines', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'large.txt') }, ctx);
    const result = JSON.parse(raw);
    const lines = result.content.split('\n').filter((l: string) => l.length > 0);
    expect(lines.length).toBe(2000);
    expect(result.totalLines).toBe(2050);
    expect(result.truncated).toBe(true);
  });

  test('detects binary files', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'image.png') }, ctx);
    const result = JSON.parse(raw);
    expect(result.error).toContain('binary');
  });

  test('returns error for non-existent path', async () => {
    const raw = await plugin.execute({ filePath: join(tmpDir, 'nope.txt') }, ctx);
    const result = JSON.parse(raw);
    expect(result.error).toContain('not found');
  });

  test('rejects .git/ directory reads', async () => {
    const raw = await plugin.execute({ filePath: '/some/repo/.git/config' }, ctx);
    const result = JSON.parse(raw);
    expect(result.error).toContain('.git');
  });

  test('rejects .git directory itself', async () => {
    const raw = await plugin.execute({ filePath: '/some/repo/.git' }, ctx);
    const result = JSON.parse(raw);
    expect(result.error).toContain('.git');
  });

  test('directory entries are sorted', async () => {
    const raw = await plugin.execute({ filePath: tmpDir }, ctx);
    const result = JSON.parse(raw);
    const entries = result.entries as string[];
    const sorted = [...entries].sort();
    expect(entries).toEqual(sorted);
  });
});
