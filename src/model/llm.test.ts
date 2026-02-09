import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getChatModel, clearLlmCache } from './llm.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';

const SETTINGS_DIR = '.tino';
const SETTINGS_FILE = '.tino/settings.json';

function writeSettings(settings: Record<string, unknown>): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function cleanupSettings(): void {
  if (existsSync(SETTINGS_FILE)) {
    rmSync(SETTINGS_FILE);
  }
}

describe('getChatModel', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearLlmCache();
    savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    savedEnv.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
    savedEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    savedEnv.ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
    savedEnv.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    savedEnv.GOOGLE_BASE_URL = process.env.GOOGLE_BASE_URL;
    savedEnv.XAI_API_KEY = process.env.XAI_API_KEY;
    savedEnv.XAI_BASE_URL = process.env.XAI_BASE_URL;
    savedEnv.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    savedEnv.OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL;

    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GOOGLE_API_KEY = 'test-google-key';
    process.env.XAI_API_KEY = 'test-xai-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    cleanupSettings();
    clearLlmCache();
  });

  test('returns ChatOpenAI for default model', () => {
    const model = getChatModel('gpt-5.2');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  test('returns ChatAnthropic for claude- prefix', () => {
    const model = getChatModel('claude-sonnet-4-5');
    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  test('returns ChatGoogleGenerativeAI for gemini- prefix', () => {
    const model = getChatModel('gemini-3');
    expect(model).toBeInstanceOf(ChatGoogleGenerativeAI);
  });

  test('returns ChatOpenAI for grok- prefix', () => {
    const model = getChatModel('grok-4-1-fast-reasoning');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  test('returns ChatOpenAI for openrouter: prefix', () => {
    const model = getChatModel('openrouter:openai/gpt-4o-mini');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });
});

describe('OPENAI_BASE_URL env var', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearLlmCache();
    savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    savedEnv.OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    clearLlmCache();
  });

  test('creates model without base URL when env var is not set', () => {
    delete process.env.OPENAI_BASE_URL;
    const model = getChatModel('gpt-5.2');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  test('creates model with base URL when OPENAI_BASE_URL is set', () => {
    process.env.OPENAI_BASE_URL = 'https://my-proxy.example.com/v1';
    const model = getChatModel('gpt-5.2');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });
});

describe('custom: prefix', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearLlmCache();
    savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    cleanupSettings();
    clearLlmCache();
  });

  test('creates ChatOpenAI for custom provider from settings', () => {
    writeSettings({
      customProviders: {
        mylocal: {
          baseURL: 'http://localhost:8080/v1',
          apiKey: 'local-key',
          defaultModel: 'llama-3.1-70b',
        },
      },
    });

    const model = getChatModel('custom:mylocal');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  test('uses model override from custom:provider/model format', () => {
    writeSettings({
      customProviders: {
        mylocal: {
          baseURL: 'http://localhost:8080/v1',
          defaultModel: 'llama-3.1-70b',
        },
      },
    });

    const model = getChatModel('custom:mylocal/custom-model-name');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });

  test('throws for invalid custom provider format', () => {
    expect(() => getChatModel('custom:')).toThrow('Invalid custom provider format');
  });

  test('throws when custom provider not found in settings', () => {
    writeSettings({});
    expect(() => getChatModel('custom:nonexistent')).toThrow(
      'Custom provider "nonexistent" not found in .tino/settings.json'
    );
  });

  test('throws when settings has customProviders but provider is missing', () => {
    writeSettings({
      customProviders: {
        other: {
          baseURL: 'http://localhost:8080/v1',
        },
      },
    });
    expect(() => getChatModel('custom:missing')).toThrow(
      'Custom provider "missing" not found in .tino/settings.json'
    );
  });

  test('uses "not-needed" as default apiKey when not specified', () => {
    writeSettings({
      customProviders: {
        nokey: {
          baseURL: 'http://localhost:8080/v1',
        },
      },
    });

    const model = getChatModel('custom:nokey');
    expect(model).toBeInstanceOf(ChatOpenAI);
  });
});

describe('LLM cache', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    clearLlmCache();
    savedEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    clearLlmCache();
  });

  test('returns same instance for same model name and streaming flag', () => {
    const model1 = getChatModel('gpt-5.2', false);
    const model2 = getChatModel('gpt-5.2', false);
    expect(model1).toBe(model2);
  });

  test('returns different instances for different streaming flags', () => {
    const model1 = getChatModel('gpt-5.2', false);
    const model2 = getChatModel('gpt-5.2', true);
    expect(model1).not.toBe(model2);
  });

  test('returns different instances for different model names', () => {
    const model1 = getChatModel('gpt-5.2', false);
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const model2 = getChatModel('claude-sonnet-4-5', false);
    expect(model1).not.toBe(model2);
  });

  test('clearLlmCache resets the cache', () => {
    const model1 = getChatModel('gpt-5.2', false);
    clearLlmCache();
    const model2 = getChatModel('gpt-5.2', false);
    expect(model1).not.toBe(model2);
  });
});
