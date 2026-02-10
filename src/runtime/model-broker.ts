import { streamText as aiStreamText, generateText as aiGenerateText } from 'ai';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loadSettings } from '@/config/settings.js';

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

function detectProvider(model: string): string {
  for (const [prefix, provider] of PREFIX_MAP) {
    if (model.startsWith(prefix)) return provider;
  }
  return 'openai';
}

function createModel(modelName: string): LanguageModel {
  const provider = detectProvider(modelName);

  switch (provider) {
    case 'anthropic':
      return createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })(modelName);

    case 'google':
      return createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
      })(modelName);

    case 'xai':
      return createXai({
        apiKey: process.env.XAI_API_KEY,
      })(modelName);

    case 'moonshot':
      return createOpenAICompatible({
        name: 'moonshot',
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: process.env.MOONSHOT_API_KEY,
      })(modelName);

    case 'ollama':
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      })(modelName.replace(/^ollama:/, ''));

    case 'openrouter':
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      })(modelName.replace(/^openrouter:/, ''));

    case 'custom': {
      const match = modelName.match(/^custom:([^/]+)\/?(.*)$/);
      if (!match) throw new Error(`Invalid custom provider format: ${modelName}`);
      const [, providerName, modelOverride] = match;
      const settings = loadSettings();
      const cfg = settings.customProviders?.[providerName!];
      if (!cfg) throw new Error(`Custom provider "${providerName}" not found in .tino/settings.json`);
      return createOpenAICompatible({
        name: providerName!,
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey || 'not-needed',
      })(modelOverride || cfg.defaultModel || 'gpt-4');
    }

    default:
      return createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
      })(modelName);
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
