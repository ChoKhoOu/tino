import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';

const GLOBAL_SETTINGS_DIR = join(homedir(), '.tino');
const GLOBAL_SETTINGS_FILE = join(GLOBAL_SETTINGS_DIR, 'settings.json');
const PROJECT_SETTINGS_FILE = '.tino/settings.json';

const DEFAULT_GLOBAL_SETTINGS = { provider: 'openai' };

const MODEL_TO_PROVIDER_MAP: Record<string, string> = {
  'gpt-5.2': 'openai',
  'claude-sonnet-4-5': 'anthropic',
  'gemini-3': 'google',
};

const CustomProviderSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
});

const SettingsSchema = z.object({
  provider: z.string().optional(),
  modelId: z.string().optional(),
  model: z.string().optional(),
  customProviders: z.record(z.string(), CustomProviderSchema).optional(),
}).passthrough(); // Allow additional unknown keys for forward compatibility

export type CustomProviderConfig = z.infer<typeof CustomProviderSchema>;
export type TinoSettings = z.infer<typeof SettingsSchema>;

interface SettingsData {
  provider?: string;
  modelId?: string;
  model?: string;
  customProviders?: Record<string, CustomProviderConfig>;
  [key: string]: unknown;
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureGlobalSettings(): Record<string, unknown> {
  const existing = readJsonFile(GLOBAL_SETTINGS_FILE);
  if (existing) return existing;
  try {
    mkdirSync(GLOBAL_SETTINGS_DIR, { recursive: true });
    writeFileSync(GLOBAL_SETTINGS_FILE, JSON.stringify(DEFAULT_GLOBAL_SETTINGS, null, 2));
  } catch { /* non-fatal */ }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

export function loadSettings(): TinoSettings {
  const global = ensureGlobalSettings();
  const project = readJsonFile(PROJECT_SETTINGS_FILE) ?? {};

  const merged: Record<string, unknown> = { ...global, ...project };
  const gcp = (global.customProviders ?? {}) as Record<string, unknown>;
  const pcp = (project.customProviders ?? {}) as Record<string, unknown>;
  if (Object.keys(gcp).length || Object.keys(pcp).length) {
    merged.customProviders = { ...gcp, ...pcp };
  }

  const result = SettingsSchema.safeParse(merged);
  return result.success ? result.data : (merged as TinoSettings);
}

export function saveSettings(settings: SettingsData): boolean {
  try {
    const target = existsSync(PROJECT_SETTINGS_FILE)
      ? PROJECT_SETTINGS_FILE
      : GLOBAL_SETTINGS_FILE;
    const dir = dirname(target);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(target, JSON.stringify(settings, null, 2));
    return true;
  } catch {
    return false;
  }
}

function migrateModelToProvider(settings: SettingsData): SettingsData {
  if (settings.provider) {
    return settings;
  }

  if (settings.model) {
    const providerId = MODEL_TO_PROVIDER_MAP[settings.model];
    if (providerId) {
      settings.provider = providerId;
      delete settings.model;
      saveSettings(settings);
    }
  }

  return settings;
}

export function getSetting<T>(key: string, defaultValue: T): T {
  let settings = loadSettings() as SettingsData;

  if (key === 'provider') {
    settings = migrateModelToProvider(settings);
  }

  return (settings[key] as T) ?? defaultValue;
}

export function setSetting(key: string, value: unknown): boolean {
  const settings = loadSettings() as SettingsData;
  settings[key] = value;

  if (key === 'provider' && settings.model) {
    delete settings.model;
  }

  return saveSettings(settings);
}
