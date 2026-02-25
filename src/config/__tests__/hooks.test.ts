import { afterAll, describe, test, expect, spyOn, beforeEach } from 'bun:test';
import * as fs from 'fs';
import { loadHooks } from '../hooks.js';

const mockExistsSync = spyOn(fs, 'existsSync');
const mockReadFileSync = spyOn(fs, 'readFileSync') as unknown as ReturnType<typeof spyOn>;

afterAll(() => {
  mockExistsSync.mockRestore();
  mockReadFileSync.mockRestore();
});

describe('loadHooks', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  test('returns empty array when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadHooks();
    expect(result).toEqual([]);
  });

  test('returns empty array when file is not valid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not json {{{');
    const result = loadHooks();
    expect(result).toEqual([]);
  });

  test('returns empty array when parsed value is not an array', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ event: 'PreToolUse' }));
    const result = loadHooks();
    expect(result).toEqual([]);
  });

  test('returns hooks when file contains valid array', () => {
    const hooks = [
      { event: 'PreToolUse' as const, type: 'command' as const, command: 'echo hello' },
      { event: 'SessionStart' as const, type: 'function' as const },
    ];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(hooks));
    const result = loadHooks();
    expect(result).toEqual(hooks);
  });

  test('returns empty array when file is empty string', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');
    const result = loadHooks();
    expect(result).toEqual([]);
  });
});
