import { describe, test, expect, afterEach } from 'bun:test';
import {
  fetchWithRetry,
  validateApiKey,
  getOptionalApiKey,
  getRateLimitDelay,
  recordRateLimit,
} from './shared.js';

/** Type-safe mock fetch helper for tests */
function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

// ============================================================================
// validateApiKey
// ============================================================================

describe('validateApiKey', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('returns the key when set', () => {
    process.env.TEST_KEY = 'abc123';
    expect(validateApiKey('TestSource', 'TEST_KEY')).toBe('abc123');
  });

  test('throws descriptive error when key is missing', () => {
    delete process.env.TEST_KEY;
    expect(() => validateApiKey('TestSource', 'TEST_KEY')).toThrow('Missing API key');
    expect(() => validateApiKey('TestSource', 'TEST_KEY')).toThrow('TEST_KEY');
  });
});

// ============================================================================
// getOptionalApiKey
// ============================================================================

describe('getOptionalApiKey', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  test('returns the key when set', () => {
    process.env.OPT_KEY = 'xyz';
    expect(getOptionalApiKey('OPT_KEY')).toBe('xyz');
  });

  test('returns undefined when key is missing', () => {
    delete process.env.OPT_KEY;
    expect(getOptionalApiKey('OPT_KEY')).toBeUndefined();
  });
});

// ============================================================================
// Rate limit tracking
// ============================================================================

describe('rate limit tracking', () => {
  test('getRateLimitDelay returns 0 when no limit is set', () => {
    expect(getRateLimitDelay('newSource')).toBe(0);
  });

  test('recordRateLimit sets a delay that decreases over time', () => {
    recordRateLimit('testSource', 1);
    const delay = getRateLimitDelay('testSource');
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(1000);
  });
});

// ============================================================================
// fetchWithRetry
// ============================================================================

describe('fetchWithRetry', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns response on successful fetch', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await fetchWithRetry('https://example.com/api', {
      source: 'test',
      maxRetries: 0,
    });
    expect(response.status).toBe(200);
  });

  test('retries on 500 and eventually returns', async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls < 2) {
        return new Response('error', { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const response = await fetchWithRetry('https://example.com/api', {
      source: 'test',
      maxRetries: 2,
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  test('throws after exhausting retries on network error', async () => {
    mockFetch(async () => {
      throw new Error('Network down');
    });

    await expect(
      fetchWithRetry('https://example.com/api', {
        source: 'test',
        maxRetries: 1,
      })
    ).rejects.toThrow('Network down');
  });
});
