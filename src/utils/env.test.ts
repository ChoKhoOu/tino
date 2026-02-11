import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_BASE = join(tmpdir(), `tino-utils-env-${Date.now()}`);

let originalCwd: string;
let originalHome: string | undefined;
let originalOpenAI: string | undefined;

beforeEach(() => {
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalOpenAI = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  mkdirSync(TEST_BASE, { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (originalOpenAI === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAI;
  }
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('utils/env checkApiKeyExistsForProvider', () => {
  test('returns true when OpenAI key exists in providers settings alias', async () => {
    const fakeProject = join(TEST_BASE, 'project');
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(
      join(fakeProject, '.tino', 'settings.json'),
      JSON.stringify({ providers: { openai: { apiKey: 'settings-key' } } }, null, 2),
    );

    process.chdir(fakeProject);
    const mod = await import(`./env.js?utils=${Date.now()}`);

    expect(mod.checkApiKeyExistsForProvider('openai')).toBe(true);
  });

  test('returns false when provider override key is placeholder', async () => {
    const fakeProject = join(TEST_BASE, 'project2');
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(
      join(fakeProject, '.tino', 'settings.json'),
      JSON.stringify({ providerOverrides: { openai: { apiKey: 'your-openai-key' } } }, null, 2),
    );

    process.chdir(fakeProject);
    const mod = await import(`./env.js?utils=${Date.now()}`);

    expect(mod.checkApiKeyExistsForProvider('openai')).toBe(false);
  });
});
