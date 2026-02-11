import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_BASE = join(tmpdir(), `tino-config-env-${Date.now()}`);

let originalCwd: string;
let originalHome: string | undefined;
let originalAnthropic: string | undefined;

beforeEach(() => {
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  mkdirSync(TEST_BASE, { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (originalAnthropic === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalAnthropic;
  }
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('config/env checkApiKeyExistsForProvider', () => {
  test('returns true when Anthropic key exists in providerOverrides', async () => {
    const fakeProject = join(TEST_BASE, 'project');
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(
      join(fakeProject, '.tino', 'settings.json'),
      JSON.stringify({ providerOverrides: { anthropic: { apiKey: 'settings-key' } } }, null, 2),
    );

    process.chdir(fakeProject);
    const mod = await import(`./env.js?config=${Date.now()}`);

    expect(mod.checkApiKeyExistsForProvider('anthropic')).toBe(true);
  });

  test('returns false when provider override key is placeholder', async () => {
    const fakeProject = join(TEST_BASE, 'project2');
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(
      join(fakeProject, '.tino', 'settings.json'),
      JSON.stringify({ providers: { anthropic: { apiKey: 'your-anthropic-key' } } }, null, 2),
    );

    process.chdir(fakeProject);
    const mod = await import(`./env.js?config=${Date.now()}`);

    expect(mod.checkApiKeyExistsForProvider('anthropic')).toBe(false);
  });
});
