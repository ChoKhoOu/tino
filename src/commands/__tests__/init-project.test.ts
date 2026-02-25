import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { runInitProject, type InitResult } from '../init-project.js';

const TEST_DIR = join(import.meta.dir, '__init_test_workspace__');
const TINO_DIR = join(TEST_DIR, '.tino');

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe('runInitProject', () => {
  test('creates .tino directory', () => {
    const result = runInitProject(TEST_DIR);
    expect(existsSync(TINO_DIR)).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
  });

  test('creates settings.json with default provider', () => {
    runInitProject(TEST_DIR);
    const settingsPath = join(TINO_DIR, 'settings.json');
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings.provider).toBe('openai');
  });

  test('creates permissions.json with default rules', () => {
    runInitProject(TEST_DIR);
    const permPath = join(TINO_DIR, 'permissions.json');
    expect(existsSync(permPath)).toBe(true);
    const perms = JSON.parse(readFileSync(permPath, 'utf-8'));
    expect(perms.rules).toBeDefined();
    expect(Array.isArray(perms.rules)).toBe(true);
    expect(perms.defaultAction).toBe('ask');
  });

  test('creates TINO.md template', () => {
    runInitProject(TEST_DIR);
    const mdPath = join(TEST_DIR, 'TINO.md');
    expect(existsSync(mdPath)).toBe(true);
    const content = readFileSync(mdPath, 'utf-8');
    expect(content).toContain('TINO');
  });

  test('returns list of created files', () => {
    const result = runInitProject(TEST_DIR);
    expect(result.created).toContain('.tino/');
    expect(result.created).toContain('.tino/settings.json');
    expect(result.created).toContain('.tino/permissions.json');
    expect(result.created).toContain('TINO.md');
  });

  test('uses provider from options when specified', () => {
    runInitProject(TEST_DIR, { provider: 'anthropic' });
    const settingsPath = join(TINO_DIR, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings.provider).toBe('anthropic');
  });

  test('skips existing files and reports them', () => {
    runInitProject(TEST_DIR);
    const result = runInitProject(TEST_DIR);
    expect(result.skipped.length).toBeGreaterThan(0);
    expect(result.created.length).toBe(0);
  });

  test('result has created and skipped arrays', () => {
    const result = runInitProject(TEST_DIR);
    expect(Array.isArray(result.created)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });
});

describe('formatInitOutput', () => {
  test('shows created files', async () => {
    const { formatInitOutput } = await import('../init-project.js');
    const result: InitResult = { created: ['.tino/', '.tino/settings.json'], skipped: [] };
    const output = formatInitOutput(result);
    expect(output).toContain('Created');
    expect(output).toContain('.tino/settings.json');
  });

  test('shows skipped files', async () => {
    const { formatInitOutput } = await import('../init-project.js');
    const result: InitResult = { created: [], skipped: ['.tino/settings.json'] };
    const output = formatInitOutput(result);
    expect(output).toContain('Skipped');
  });

  test('shows all-done message when nothing created', async () => {
    const { formatInitOutput } = await import('../init-project.js');
    const result: InitResult = { created: [], skipped: ['.tino/'] };
    const output = formatInitOutput(result);
    expect(output).toContain('already initialized');
  });
});
