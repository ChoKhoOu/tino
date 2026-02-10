import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';

const SETTINGS_FILE = '.tino/settings.json';

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

export function loadSettings(): TinoSettings {
  if (!existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    const raw = JSON.parse(content);
    const result = SettingsSchema.safeParse(raw);
    return result.success ? result.data : raw;
  } catch {
    return {};
  }
}

export function saveSettings(settings: SettingsData): boolean {
  try {
    const dir = dirname(SETTINGS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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
