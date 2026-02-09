import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { z } from 'zod';

const SETTINGS_FILE = '.tino/settings.json';

// Map legacy model IDs to provider IDs for migration
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
export type Settings = z.infer<typeof SettingsSchema>;

interface Config {
  provider?: string;
  modelId?: string;  // Selected model ID (e.g., "gpt-5.2", "ollama:llama3.1")
  model?: string;    // Legacy key, kept for migration
  customProviders?: Record<string, CustomProviderConfig>;
  [key: string]: unknown;
}

export function loadConfig(): Config {
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

export function loadSettings(): Settings {
  return loadConfig() as Settings;
}

export function saveConfig(config: Config): boolean {
  try {
    const dir = dirname(SETTINGS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrates legacy `model` setting to `provider` setting.
 * Called once on config load to ensure backwards compatibility.
 */
function migrateModelToProvider(config: Config): Config {
  // If already has provider, no migration needed
  if (config.provider) {
    return config;
  }

  // If has legacy model setting, convert to provider
  if (config.model) {
    const providerId = MODEL_TO_PROVIDER_MAP[config.model];
    if (providerId) {
      config.provider = providerId;
      delete config.model;
      // Save the migrated config
      saveConfig(config);
    }
  }

  return config;
}

export function getSetting<T>(key: string, defaultValue: T): T {
  let config = loadConfig();
  
  // Run migration if accessing provider setting
  if (key === 'provider') {
    config = migrateModelToProvider(config);
  }
  
  return (config[key] as T) ?? defaultValue;
}

export function setSetting(key: string, value: unknown): boolean {
  const config = loadConfig();
  config[key] = value;
  
  // If setting provider, remove legacy model key
  if (key === 'provider' && config.model) {
    delete config.model;
  }
  
  return saveConfig(config);
}
