import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  planScaffold,
  writeScaffold,
  generatePyprojectToml,
  generateSettingsJson,
  generateGitignore,
  initProject,
} from './init.js';

// Use a unique temp directory for each test run
const TEST_BASE = join(tmpdir(), `tino-test-init-${Date.now()}`);

beforeEach(() => {
  mkdirSync(TEST_BASE, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

describe('generatePyprojectToml', () => {
  test('includes project name and nautilus_trader dep', () => {
    const toml = generatePyprojectToml('my-project');
    expect(toml).toContain('name = "my-project"');
    expect(toml).toContain('nautilus_trader>=1.200.0');
    expect(toml).toContain('requires-python = ">=3.10,<3.13"');
  });
});

describe('generateSettingsJson', () => {
  test('returns valid JSON with default provider', () => {
    const json = generateSettingsJson();
    const parsed = JSON.parse(json);
    expect(parsed.provider).toBe('openai');
  });
});

describe('generateGitignore', () => {
  test('ignores expected paths', () => {
    const gi = generateGitignore();
    expect(gi).toContain('.tino/.venv/');
    expect(gi).toContain('.tino/daemon.pid');
    expect(gi).toContain('data/');
    expect(gi).toContain('backtests/');
    expect(gi).toContain('__pycache__/');
  });
});

// ---------------------------------------------------------------------------
// planScaffold
// ---------------------------------------------------------------------------

describe('planScaffold', () => {
  test('computes correct directory list', () => {
    const scaffold = planScaffold('test-proj', TEST_BASE);
    expect(scaffold.projectDir).toBe(join(TEST_BASE, 'test-proj'));
    expect(scaffold.directories).toContain('strategies');
    expect(scaffold.directories).toContain('data/catalog');
    expect(scaffold.directories).toContain('backtests');
    expect(scaffold.directories).toContain('.tino/scratchpad');
  });

  test('includes pyproject.toml, settings.json, and .gitignore', () => {
    const scaffold = planScaffold('test-proj', TEST_BASE);
    const filePaths = scaffold.files.map(f => f.path);
    expect(filePaths).toContain('pyproject.toml');
    expect(filePaths).toContain('.tino/settings.json');
    expect(filePaths).toContain('.gitignore');
  });
});

// ---------------------------------------------------------------------------
// writeScaffold
// ---------------------------------------------------------------------------

describe('writeScaffold', () => {
  test('creates all directories and files', () => {
    const scaffold = planScaffold('write-test', TEST_BASE);
    writeScaffold(scaffold);

    expect(existsSync(scaffold.projectDir)).toBe(true);
    expect(existsSync(join(scaffold.projectDir, 'strategies'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, 'data', 'catalog'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, 'backtests'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, '.tino', 'scratchpad'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, 'pyproject.toml'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, '.tino', 'settings.json'))).toBe(true);
    expect(existsSync(join(scaffold.projectDir, '.gitignore'))).toBe(true);
  });

  test('settings.json contains default provider', () => {
    const scaffold = planScaffold('settings-test', TEST_BASE);
    writeScaffold(scaffold);

    const content = readFileSync(join(scaffold.projectDir, '.tino', 'settings.json'), 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.provider).toBe('openai');
  });

  test('throws if directory already exists', () => {
    const scaffold = planScaffold('dup-test', TEST_BASE);
    mkdirSync(scaffold.projectDir, { recursive: true });

    expect(() => writeScaffold(scaffold)).toThrow('already exists');
  });
});

// ---------------------------------------------------------------------------
// initProject (with skipPython)
// ---------------------------------------------------------------------------

describe('initProject', () => {
  test('scaffolds project with skipPython', async () => {
    const result = await initProject({
      projectName: 'init-test',
      baseDir: TEST_BASE,
      skipPython: true,
    });

    expect(result.success).toBe(true);
    expect(result.projectDir).toBe(join(TEST_BASE, 'init-test'));
    expect(existsSync(join(result.projectDir, 'pyproject.toml'))).toBe(true);
    expect(existsSync(join(result.projectDir, '.tino', 'settings.json'))).toBe(true);
  });

  test('rejects invalid project names', async () => {
    const result = await initProject({
      projectName: 'bad name!',
      baseDir: TEST_BASE,
      skipPython: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid project name');
  });

  test('rejects empty project name', async () => {
    const result = await initProject({
      projectName: '',
      baseDir: TEST_BASE,
      skipPython: true,
    });
    expect(result.success).toBe(false);
  });

  test('fails if directory already exists', async () => {
    mkdirSync(join(TEST_BASE, 'existing'), { recursive: true });
    const result = await initProject({
      projectName: 'existing',
      baseDir: TEST_BASE,
      skipPython: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  test('calls onProgress callback', async () => {
    const steps: string[] = [];
    await initProject({
      projectName: 'progress-test',
      baseDir: TEST_BASE,
      skipPython: true,
      onProgress: ({ step }) => steps.push(step),
    });
    expect(steps).toContain('scaffold');
  });

  test('accepts hyphenated and underscored names', async () => {
    const r1 = await initProject({ projectName: 'my-project', baseDir: TEST_BASE, skipPython: true });
    expect(r1.success).toBe(true);

    const r2 = await initProject({ projectName: 'my_project_2', baseDir: TEST_BASE, skipPython: true });
    expect(r2.success).toBe(true);
  });
});
