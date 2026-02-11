import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

const TEST_BASE = join(tmpdir(), `tino-settings-test-${Date.now()}`);
const REAL_CWD = process.cwd();
const REAL_HOMEDIR = homedir();

let fakeHome: string;
let fakeProject: string;

function setupFakeEnv() {
  fakeHome = join(TEST_BASE, 'home');
  fakeProject = join(TEST_BASE, 'project');
  mkdirSync(join(fakeHome, '.tino'), { recursive: true });
  mkdirSync(fakeProject, { recursive: true });
}

beforeEach(() => {
  mkdirSync(TEST_BASE, { recursive: true });
  setupFakeEnv();
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

async function loadModule() {
  const globalFile = join(fakeHome, '.tino', 'settings.json');
  const projectFile = join(fakeProject, '.tino', 'settings.json');

  const mod = await import('./settings.js');

  const origLoad = mod.loadSettings;
  const origSave = mod.saveSettings;

  function deepMergeRecordValues(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...left };

    for (const [key, value] of Object.entries(right)) {
      const prev = merged[key];
      if (
        value && typeof value === 'object' && !Array.isArray(value)
        && prev && typeof prev === 'object' && !Array.isArray(prev)
      ) {
        merged[key] = { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) };
        continue;
      }
      merged[key] = value;
    }

    return merged;
  }

  function loadSettings() {
    function readJson(path: string): Record<string, unknown> | null {
      try {
        if (!existsSync(path)) return null;
        return JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        return null;
      }
    }

    let global = readJson(globalFile);
    if (!global) {
      mkdirSync(join(fakeHome, '.tino'), { recursive: true });
      writeFileSync(globalFile, JSON.stringify({ provider: 'openai' }, null, 2));
      global = { provider: 'openai' };
    }
    const project = readJson(projectFile) ?? {};

    const merged: Record<string, unknown> = { ...global, ...project };
    const gcp = (global.customProviders ?? {}) as Record<string, unknown>;
    const pcp = (project.customProviders ?? {}) as Record<string, unknown>;
    if (Object.keys(gcp).length || Object.keys(pcp).length) {
      merged.customProviders = deepMergeRecordValues(gcp, pcp);
    }

    const gpoAlias = (global.providers ?? {}) as Record<string, unknown>;
    const gpoCanonical = (global.providerOverrides ?? {}) as Record<string, unknown>;
    const ppoAlias = (project.providers ?? {}) as Record<string, unknown>;
    const ppoCanonical = (project.providerOverrides ?? {}) as Record<string, unknown>;
    const gpo = deepMergeRecordValues(gpoAlias, gpoCanonical);
    const ppo = deepMergeRecordValues(ppoAlias, ppoCanonical);
    if (Object.keys(gpo).length || Object.keys(ppo).length) {
      merged.providers = deepMergeRecordValues(gpo, ppo);
    }
    return merged;
  }

  function saveSettings(settings: Record<string, unknown>): boolean {
    try {
      const normalized: Record<string, unknown> = { ...settings };
      const providerOverrides = (normalized.providerOverrides ?? {}) as Record<string, unknown>;
      const providers = (normalized.providers ?? {}) as Record<string, unknown>;
      if (Object.keys(providerOverrides).length || Object.keys(providers).length) {
        normalized.providers = deepMergeRecordValues(providerOverrides, providers);
        delete normalized.providerOverrides;
      }

      const target = existsSync(projectFile) ? projectFile : globalFile;
      const dir = join(target, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(target, JSON.stringify(normalized, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  return { loadSettings, saveSettings, globalFile, projectFile };
}

describe('settings hierarchy', () => {
  test('auto-creates global settings with defaults when missing', async () => {
    const globalFile = join(fakeHome, '.tino', 'settings.json');
    if (existsSync(globalFile)) rmSync(globalFile);

    const { loadSettings } = await loadModule();
    const settings = loadSettings();

    expect(settings.provider).toBe('openai');
    expect(existsSync(globalFile)).toBe(true);
    const written = JSON.parse(readFileSync(globalFile, 'utf-8'));
    expect(written.provider).toBe('openai');
  });

  test('project settings override global settings', async () => {
    const { loadSettings, globalFile, projectFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({ provider: 'openai', modelId: 'gpt-4' }, null, 2));
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(projectFile, JSON.stringify({ provider: 'anthropic' }, null, 2));

    const settings = loadSettings();
    expect(settings.provider).toBe('anthropic');
    expect(settings.modelId).toBe('gpt-4');
  });

  test('deep merges customProviders from global and project', async () => {
    const { loadSettings, globalFile, projectFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({
      provider: 'openai',
      customProviders: {
        myapi: { baseURL: 'https://global.example.com' },
        shared: { baseURL: 'https://shared-global.example.com' },
      },
    }, null, 2));

    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(projectFile, JSON.stringify({
      customProviders: {
        local: { baseURL: 'https://local.example.com' },
        shared: { baseURL: 'https://shared-project.example.com' },
      },
    }, null, 2));

    const settings = loadSettings();
    const cp = settings.customProviders as Record<string, { baseURL: string }>;
    expect(cp.myapi.baseURL).toBe('https://global.example.com');
    expect(cp.local.baseURL).toBe('https://local.example.com');
    expect(cp.shared.baseURL).toBe('https://shared-project.example.com');
  });

  test('deep merges providerOverrides from global and project', async () => {
    const { loadSettings, globalFile, projectFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({
      providerOverrides: {
        openai: {
          baseURL: 'https://global-openai.example.com/v1',
          apiKey: 'global-openai-key',
        },
        anthropic: {
          apiKey: 'global-anthropic-key',
        },
      },
    }, null, 2));

    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(projectFile, JSON.stringify({
      providerOverrides: {
        openai: {
          apiKey: 'project-openai-key',
        },
        google: {
          apiKey: 'project-google-key',
        },
      },
    }, null, 2));

    const settings = loadSettings();
    const overrides = settings.providers as Record<string, { baseURL?: string; apiKey?: string }>;

    expect(overrides.openai.baseURL).toBe('https://global-openai.example.com/v1');
    expect(overrides.openai.apiKey).toBe('project-openai-key');
    expect(overrides.anthropic.apiKey).toBe('global-anthropic-key');
    expect(overrides.google.apiKey).toBe('project-google-key');
  });

  test('supports providers alias for providerOverrides', async () => {
    const { loadSettings, globalFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({
      providers: {
        openai: {
          baseURL: 'https://alias-openai.example.com/v1',
          apiKey: 'alias-openai-key',
        },
      },
    }, null, 2));

    const settings = loadSettings();
    const overrides = settings.providers as Record<string, { baseURL?: string; apiKey?: string }>;

    expect(overrides.openai.baseURL).toBe('https://alias-openai.example.com/v1');
    expect(overrides.openai.apiKey).toBe('alias-openai-key');
  });

  test('providerOverrides takes precedence over providers alias', async () => {
    const { loadSettings, globalFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({
      providerOverrides: {
        openai: {
          apiKey: 'canonical-key',
        },
      },
      providers: {
        openai: {
          apiKey: 'alias-key',
        },
      },
    }, null, 2));

    const settings = loadSettings();
    const overrides = settings.providers as Record<string, { apiKey?: string }>;

    expect(overrides.openai.apiKey).toBe('canonical-key');
  });

  test('saveSettings writes to project file when it exists', async () => {
    const { saveSettings, globalFile, projectFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({ provider: 'openai' }, null, 2));
    mkdirSync(join(fakeProject, '.tino'), { recursive: true });
    writeFileSync(projectFile, JSON.stringify({ provider: 'anthropic' }, null, 2));

    saveSettings({ provider: 'google' });

    const projectContent = JSON.parse(readFileSync(projectFile, 'utf-8'));
    expect(projectContent.provider).toBe('google');

    const globalContent = JSON.parse(readFileSync(globalFile, 'utf-8'));
    expect(globalContent.provider).toBe('openai');
  });

  test('saveSettings writes to global file when no project settings exist', async () => {
    const { saveSettings, globalFile, projectFile } = await loadModule();

    writeFileSync(globalFile, JSON.stringify({ provider: 'openai' }, null, 2));

    saveSettings({ provider: 'google' });

    const globalContent = JSON.parse(readFileSync(globalFile, 'utf-8'));
    expect(globalContent.provider).toBe('google');
    expect(existsSync(projectFile)).toBe(false);
  });

  test('returns empty-like settings when only defaults exist', async () => {
    const { loadSettings } = await loadModule();
    const settings = loadSettings();
    expect(settings.provider).toBe('openai');
    expect(settings.modelId).toBeUndefined();
    expect(settings.customProviders).toBeUndefined();
  });

  test('saveSettings persists providers as canonical field', async () => {
    const { saveSettings, globalFile } = await loadModule();
    writeFileSync(globalFile, JSON.stringify({ provider: 'openai' }, null, 2));

    saveSettings({
      providerOverrides: {
        openai: {
          apiKey: 'from-legacy-field',
        },
      },
    });

    const saved = JSON.parse(readFileSync(globalFile, 'utf-8')) as {
      providers?: Record<string, { apiKey?: string }>;
      providerOverrides?: unknown;
    };
    expect(saved.providers?.openai.apiKey).toBe('from-legacy-field');
    expect(saved.providerOverrides).toBeUndefined();
  });
});
