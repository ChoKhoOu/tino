import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolContext } from '@/domain/index.js';
import plugin from './glob.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'glob-tool-'));

  await writeFile(join(tmpDir, 'app.ts'), 'export const app = 1;');
  await writeFile(join(tmpDir, 'index.ts'), 'export default {};');
  await writeFile(join(tmpDir, 'readme.md'), '# Hello');
  await writeFile(join(tmpDir, 'data.json'), '{}');

  await mkdir(join(tmpDir, 'src'));
  await writeFile(join(tmpDir, 'src', 'main.ts'), 'console.log("main");');
  await writeFile(join(tmpDir, 'src', 'util.ts'), 'export const x = 1;');
  await writeFile(join(tmpDir, 'src', 'style.css'), 'body {}');

  await mkdir(join(tmpDir, 'src', 'nested'));
  await writeFile(join(tmpDir, 'src', 'nested', 'deep.ts'), 'export {};');

  await mkdir(join(tmpDir, '.git'));
  await writeFile(join(tmpDir, '.git', 'config'), '[core]');
  await mkdir(join(tmpDir, 'node_modules'));
  await mkdir(join(tmpDir, 'node_modules', 'pkg'));
  await writeFile(join(tmpDir, 'node_modules', 'pkg', 'index.ts'), 'module.exports = {};');

  const now = Date.now();
  await utimes(join(tmpDir, 'app.ts'), now / 1000 - 100, now / 1000 - 100);
  await utimes(join(tmpDir, 'index.ts'), now / 1000 - 50, now / 1000 - 50);
  await utimes(join(tmpDir, 'src', 'main.ts'), now / 1000 - 10, now / 1000 - 10);
  await utimes(join(tmpDir, 'src', 'util.ts'), now / 1000, now / 1000);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('glob tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('glob');
    expect(plugin.domain).toBe('coding');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('finds TypeScript files with **/*.ts pattern', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths).toBeArray();
    expect(result.filePaths.length).toBe(5);
  });

  test('excludes .git/ files', async () => {
    const raw = await plugin.execute({ pattern: '**/*', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    const gitFiles = result.filePaths.filter((p: string) => p.includes('.git'));
    expect(gitFiles.length).toBe(0);
  });

  test('excludes node_modules/ files', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    const nmFiles = result.filePaths.filter((p: string) => p.includes('node_modules'));
    expect(nmFiles.length).toBe(0);
  });

  test('finds files matching specific extension', async () => {
    const raw = await plugin.execute({ pattern: '**/*.css', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths.length).toBe(1);
    expect(result.filePaths[0]).toContain('style.css');
  });

  test('finds files in subdirectory pattern', async () => {
    const raw = await plugin.execute({ pattern: 'src/**/*.ts', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths.length).toBe(3);
  });

  test('returns results sorted by modification time (most recent first)', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    const paths = result.filePaths as string[];
    const utilIdx = paths.findIndex((p: string) => p.includes('util.ts'));
    const appIdx = paths.findIndex((p: string) => p.includes('app.ts'));
    expect(utilIdx).toBeLessThan(appIdx);
  });

  test('limits results to 100 files', async () => {
    const bigDir = await mkdtemp(join(tmpdir(), 'glob-big-'));
    for (let i = 0; i < 110; i++) {
      await writeFile(join(bigDir, `file${i.toString().padStart(3, '0')}.ts`), `${i}`);
    }

    const raw = await plugin.execute({ pattern: '**/*.ts', path: bigDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths.length).toBeLessThanOrEqual(100);
    expect(result.truncated).toBe(true);

    await rm(bigDir, { recursive: true, force: true });
  });

  test('returns message when no matches found', async () => {
    const raw = await plugin.execute({ pattern: '**/*.xyz', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths).toBeArray();
    expect(result.filePaths.length).toBe(0);
    expect(result.message).toContain('No files found');
  });

  test('defaults path to current directory when not provided', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts' }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths).toBeArray();
  });

  test('returns absolute file paths', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts', path: tmpDir }, ctx);
    const result = JSON.parse(raw);
    for (const p of result.filePaths) {
      expect(p).toMatch(/^\//);
    }
  });

  test('handles non-existent path gracefully', async () => {
    const raw = await plugin.execute({ pattern: '**/*.ts', path: '/tmp/nonexistent-glob-test-dir' }, ctx);
    const result = JSON.parse(raw);
    expect(result.filePaths.length).toBe(0);
  });
});
