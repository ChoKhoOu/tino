import { streamText as aiStreamText, generateText as aiGenerateText } from 'ai';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loadSettings, type TinoSettings } from '@/config/settings.js';

export type ModelPurpose = 'reason' | 'route' | 'summarize';

export const DEFAULT_MODEL = 'gpt-5.2';
export const DEFAULT_PROVIDER = 'openai';

const FAST_MODELS: Record<string, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-3-flash-preview',
  xai: 'grok-4-1-fast-reasoning',
  openrouter: 'openrouter:openai/gpt-4o-mini',
  moonshot: 'kimi-k2-5',
};

const PREFIX_MAP: [string, string][] = [
  ['openrouter:', 'openrouter'],
  ['custom:', 'custom'],
  ['ollama:', 'ollama'],
  ['claude-', 'anthropic'],
  ['gemini-', 'google'],
  ['grok-', 'xai'],
  ['kimi-', 'moonshot'],
];

const ENV_PROVIDER_KEYS: Record<string, { apiKey?: string; baseURL?: string }> = {
  openai: { apiKey: 'OPENAI_API_KEY', baseURL: 'OPENAI_BASE_URL' },
  anthropic: { apiKey: 'ANTHROPIC_API_KEY' },
  google: { apiKey: 'GOOGLE_API_KEY' },
  xai: { apiKey: 'XAI_API_KEY' },
  moonshot: { apiKey: 'MOONSHOT_API_KEY' },
  openrouter: { apiKey: 'OPENROUTER_API_KEY' },
  ollama: { baseURL: 'OLLAMA_BASE_URL' },
};

const DEFAULT_PROVIDER_BASE_URLS: Record<string, string> = {
  moonshot: 'https://api.moonshot.cn/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://127.0.0.1:11434/v1',
};

export function resolveProviderConfig(
  provider: string,
  settings: Partial<TinoSettings> = loadSettings(),
  env: Record<string, string | undefined> = process.env,
): { baseURL?: string; apiKey?: string; defaultModel?: string } {
  const override = settings.providers?.[provider] ?? settings.providerOverrides?.[provider];
  const envKeys = ENV_PROVIDER_KEYS[provider] ?? {};
  const envBaseURL = envKeys.baseURL ? env[envKeys.baseURL] : undefined;
  const envApiKey = envKeys.apiKey ? env[envKeys.apiKey] : undefined;

  return {
    baseURL: override?.baseURL ?? envBaseURL,
    apiKey: override?.apiKey ?? envApiKey,
    defaultModel: override?.defaultModel,
  };
}

function detectProvider(model: string): string {
  for (const [prefix, provider] of PREFIX_MAP) {
    if (model.startsWith(prefix)) return provider;
  }
  return 'openai';
}

function createModel(modelName: string): LanguageModel {
  const provider = detectProvider(modelName);
  const settings = loadSettings();

  switch (provider) {
    case 'anthropic': {
      const cfg = resolveProviderConfig('anthropic', settings);
      return createAnthropic({
        apiKey: cfg.apiKey,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
      })(modelName);
    }

    case 'google': {
      const cfg = resolveProviderConfig('google', settings);
      return createGoogleGenerativeAI({
        apiKey: cfg.apiKey,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
      })(modelName);
    }

    case 'xai': {
      const cfg = resolveProviderConfig('xai', settings);
      return createXai({
        apiKey: cfg.apiKey,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
      })(modelName);
    }

    case 'moonshot': {
      const cfg = resolveProviderConfig('moonshot', settings);
      return createOpenAICompatible({
        name: 'moonshot',
        baseURL: cfg.baseURL ?? DEFAULT_PROVIDER_BASE_URLS.moonshot,
        apiKey: cfg.apiKey,
      })(modelName);
    }

    case 'ollama': {
      const cfg = resolveProviderConfig('ollama', settings);
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: cfg.baseURL ?? DEFAULT_PROVIDER_BASE_URLS.ollama,
      })(modelName.replace(/^ollama:/, ''));
    }

    case 'openrouter': {
      const cfg = resolveProviderConfig('openrouter', settings);
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: cfg.baseURL ?? DEFAULT_PROVIDER_BASE_URLS.openrouter,
        apiKey: cfg.apiKey,
      })(modelName.replace(/^openrouter:/, ''));
    }

    case 'custom': {
      const match = modelName.match(/^custom:([^/]+)\/?(.*)$/);
      if (!match) throw new Error(`Invalid custom provider format: ${modelName}`);
      const [, providerName, modelOverride] = match;
      const cfg = settings.customProviders?.[providerName!];
      if (!cfg) throw new Error(`Custom provider "${providerName}" not found in .tino/settings.json`);
      return createOpenAICompatible({
        name: providerName!,
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey || 'not-needed',
      })(modelOverride || cfg.defaultModel || 'gpt-4');
    }

    default: {
      const cfg = resolveProviderConfig('openai', settings);
      return createOpenAI({
        apiKey: cfg.apiKey,
        ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
      })(modelName);
    }
  }
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}

export class ModelBroker {
  private modelName: string;
  private providerName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    this.modelName = modelName;
    this.providerName = detectProvider(modelName);
  }

  setModel(modelName: string): void {
    this.modelName = modelName;
    this.providerName = detectProvider(modelName);
  }

  getModel(purpose: ModelPurpose): LanguageModel {
    if (purpose === 'reason') return createModel(this.modelName);
    const fastName = FAST_MODELS[this.providerName] ?? this.modelName;
    return createModel(fastName);
  }

  streamText(opts: Parameters<typeof aiStreamText>[0]): ReturnType<typeof withRetry> {
    return withRetry(() => Promise.resolve(aiStreamText(opts)));
  }

  generateText(opts: Parameters<typeof aiGenerateText>[0]): ReturnType<typeof withRetry> {
    return withRetry(() => aiGenerateText(opts));
  }
}
