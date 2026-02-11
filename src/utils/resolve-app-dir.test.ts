import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { resolveAppDir, resolveSrcDir } from './resolve-app-dir.js';

describe('resolveAppDir', () => {
  test('returns a directory that exists on disk', () => {
    const dir = resolveAppDir();
    expect(existsSync(dir)).toBe(true);
  });

  test('returns the project root containing src/ and python/', () => {
    const root = resolveAppDir();
    expect(existsSync(join(root, 'src'))).toBe(true);
    expect(existsSync(join(root, 'python'))).toBe(true);
  });

  test('returns the project root containing package.json', () => {
    const root = resolveAppDir();
    expect(existsSync(join(root, 'package.json'))).toBe(true);
  });
});

describe('resolveSrcDir', () => {
  test('returns a directory that exists on disk', () => {
    const dir = resolveSrcDir();
    expect(existsSync(dir)).toBe(true);
  });

  test('returns the src/ directory containing tools/', () => {
    const srcDir = resolveSrcDir();
    expect(existsSync(join(srcDir, 'tools'))).toBe(true);
    expect(existsSync(join(srcDir, 'runtime'))).toBe(true);
  });

  test('tools/consolidated directory is discoverable from resolveSrcDir', () => {
    const srcDir = resolveSrcDir();
    const toolsDir = join(srcDir, 'tools', 'consolidated');
    expect(existsSync(toolsDir)).toBe(true);
  });
});
