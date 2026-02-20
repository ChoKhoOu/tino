import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { validateApiKey } from '../api-key-validator.js';

describe('validateApiKey', () => {
  beforeEach(() => {
    // Reset global fetch mock between tests
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{}', { status: 200 })),
    ) as unknown as typeof fetch;
  });

  test('returns valid for binance with 200 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{}', { status: 200 })),
    ) as unknown as typeof fetch;
    const result = await validateApiKey('binance', 'test-key', 'test-secret');
    expect(result.valid).toBe(true);
  });

  test('returns invalid for binance with 401 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"code":-2015}', { status: 401 })),
    ) as unknown as typeof fetch;
    const result = await validateApiKey('binance', 'bad-key', 'bad-secret');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('returns valid for okx with 200 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{"code":"0"}', { status: 200 })),
    ) as unknown as typeof fetch;
    const result = await validateApiKey('okx', 'test-key', 'test-secret');
    expect(result.valid).toBe(true);
  });

  test('returns valid for bybit with 200 response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{}', { status: 200 })),
    ) as unknown as typeof fetch;
    const result = await validateApiKey('bybit', 'test-key', 'test-secret');
    expect(result.valid).toBe(true);
  });

  test('returns error for unsupported exchange', async () => {
    const result = await validateApiKey('unknown', 'key', 'secret');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported exchange');
  });

  test('returns error on network failure', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error')),
    ) as unknown as typeof fetch;
    const result = await validateApiKey('binance', 'key', 'secret');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
