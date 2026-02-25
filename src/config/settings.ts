import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import {
  SettingsSchema,
  MODEL_TO_PROVIDER_MAP,
  type CustomProviderConfig,
  type ProviderOverrideConfig,
  type TinoSettings,
  type SettingsData,
} from './settings-schema.js';

// Re-export types so existing imports from settings.ts keep working
export type { CustomProviderConfig, ProviderOverrideConfig, TinoSettings } from './settings-schema.js';

const getGlobalSettingsDir = () => join(homedir(), '.tino');
const getGlobalSettingsFile = () => join(getGlobalSettingsDir(), 'settings.json');
const PROJECT_SETTINGS_FILE = '.tino/settings.json';

const DEFAULT_GLOBAL_SETTINGS = { provider: 'openai' };

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

function readJsonFile(p: string): Record<string, unknown> | null {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureGlobalSettings(): Record<string, unknown> {
  const file = getGlobalSettingsFile();
  const existing = readJsonFile(file);
  if (existing) return existing;
  try {
    mkdirSync(getGlobalSettingsDir(), { recursive: true });
    writeFileSync(file, JSON.stringify(DEFAULT_GLOBAL_SETTINGS, null, 2));
  } catch { /* non-fatal */ }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

let _settingsCache: { data: TinoSettings; timestamp: number; cwd: string } | null = null;
const CACHE_TTL_MS = 5_000;

export function invalidateSettingsCache(): void {
  _settingsCache = null;
}

export function loadSettings(): TinoSettings {
  const cwd = process.cwd();
  if (_settingsCache && _settingsCache.cwd === cwd && (Date.now() - _settingsCache.timestamp) < CACHE_TTL_MS) {
    return _settingsCache.data;
  }

  const global = ensureGlobalSettings();
  const project = readJsonFile(PROJECT_SETTINGS_FILE) ?? {};

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

  const result = SettingsSchema.safeParse(merged);
  const settings = result.success ? result.data : (merged as TinoSettings);
  _settingsCache = { data: settings, timestamp: Date.now(), cwd };
  return settings;
}

export function saveSettings(settings: SettingsData): boolean {
  invalidateSettingsCache();
  try {
    const normalizedSettings: SettingsData = { ...settings };
    const providerOverrides = (normalizedSettings.providerOverrides ?? {}) as Record<string, unknown>;
    const providers = (normalizedSettings.providers ?? {}) as Record<string, unknown>;
    if (Object.keys(providerOverrides).length || Object.keys(providers).length) {
      normalizedSettings.providers = deepMergeRecordValues(providerOverrides, providers) as Record<string, ProviderOverrideConfig>;
      delete normalizedSettings.providerOverrides;
    }

    const target = existsSync(PROJECT_SETTINGS_FILE)
      ? PROJECT_SETTINGS_FILE
      : getGlobalSettingsFile();
    const dir = dirname(target);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(target, JSON.stringify(normalizedSettings, null, 2));
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
      return { ...settings, provider: providerId, model: undefined };
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
