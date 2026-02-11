import { describe, expect, test } from 'bun:test';
import { resolveProviderConfig } from './model-broker.js';

describe('resolveProviderConfig', () => {
  test('prefers providers values over environment values', () => {
    const result = resolveProviderConfig('openai', {
      providers: {
        openai: {
          baseURL: 'https://settings-openai.example.com/v1',
          apiKey: 'settings-openai-key',
        },
      },
    }, {
      OPENAI_BASE_URL: 'https://env-openai.example.com/v1',
      OPENAI_API_KEY: 'env-openai-key',
    });

    expect(result.baseURL).toBe('https://settings-openai.example.com/v1');
    expect(result.apiKey).toBe('settings-openai-key');
  });

  test('falls back to environment values when providerOverrides are missing', () => {
    const result = resolveProviderConfig('anthropic', {}, {
      ANTHROPIC_API_KEY: 'env-anthropic-key',
    });

    expect(result.apiKey).toBe('env-anthropic-key');
    expect(result.baseURL).toBeUndefined();
  });

  test('accepts legacy providerOverrides field for backward compatibility', () => {
    const result = resolveProviderConfig('openai', {
      providerOverrides: {
        openai: {
          apiKey: 'legacy-key',
        },
      },
    }, {
      OPENAI_API_KEY: 'env-openai-key',
    });

    expect(result.apiKey).toBe('legacy-key');
  });

  test('allows providers for openrouter and ollama baseURL', () => {
    const openrouter = resolveProviderConfig('openrouter', {
      providers: {
        openrouter: {
          baseURL: 'https://router.example.com/api/v1',
          apiKey: 'router-key',
        },
      },
    }, {});
    const ollama = resolveProviderConfig('ollama', {
      providers: {
        ollama: {
          baseURL: 'http://localhost:11435/v1',
        },
      },
    }, {});

    expect(openrouter.baseURL).toBe('https://router.example.com/api/v1');
    expect(openrouter.apiKey).toBe('router-key');
    expect(ollama.baseURL).toBe('http://localhost:11435/v1');
  });
});
