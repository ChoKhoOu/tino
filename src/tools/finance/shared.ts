/**
 * Shared utilities for external financial data source clients.
 *
 * Provides retry logic and cached JSON fetching
 * so each client module stays focused on endpoint-specific logic.
 */
import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { getRateLimitDelay, recordRateLimit } from './rate-limiter.js';

import { getSetting } from '../../config/settings.js';

// Re-export rate-limiter utilities so existing imports from shared.ts keep working
export {
  getRateLimitDelay,
  recordRateLimit,
  validateApiKey,
  getOptionalApiKey,
} from './rate-limiter.js';

// ============================================================================
// Legacy provider helpers
// ============================================================================

/**
 * Check whether a deprecated data provider is explicitly opted-in.
 *
 * Supports two mechanisms (env var takes precedence):
 *  - `TINO_LEGACY_PROVIDERS=fmp,finnhub,financialdatasets`
 *  - `enabledLegacyProviders` array in `.tino/settings.json`
 */
export function isLegacyEnabled(provider: string): boolean {
  const envOverride = process.env.TINO_LEGACY_PROVIDERS;
  if (envOverride !== undefined) {
    return envOverride.split(',').map(s => s.trim()).includes(provider);
  }
  const raw = getSetting<string[] | undefined>('enabledLegacyProviders', undefined);
  return Array.isArray(raw) && raw.includes(provider);
}

export const LEGACY_HINT = 'These providers require opt-in via enabledLegacyProviders in .tino/settings.json with the corresponding API key in .env.';

// ============================================================================
// Types
// ============================================================================

export interface FetchOptions extends RequestInit {
  /** Max retry attempts on transient failures (default 3) */
  maxRetries?: number;
  /** Source name for logging (e.g. "FMP", "FRED") */
  source?: string;
}

export interface CacheableCallOptions {
  /** Whether to use file-based caching */
  cacheable?: boolean;
  /** Source name for logging */
  source: string;
}

// ============================================================================
// Fetch with exponential-backoff retry
// ============================================================================

/** Transient HTTP status codes that warrant a retry */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL with automatic exponential-backoff retry on transient errors.
 *
 * - Network failures and 5xx / 429 responses trigger retries.
 * - Respects `Retry-After` headers on 429 responses.
 * - Throws after `maxRetries` consecutive failures.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { maxRetries = 3, source = 'unknown', ...fetchInit } = options;
  const label = source ? `[${source}]` : '';

  // Check pre-existing rate-limit
  const preDelay = getRateLimitDelay(source);
  if (preDelay > 0) {
    logger.debug(`${label} rate-limited, waiting ${preDelay}ms`);
    await sleep(preDelay);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchInit);

      // Rate-limited — record and retry
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSecs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
        const waitSecs = Number.isNaN(retryAfterSecs) ? 5 : retryAfterSecs;
        recordRateLimit(source, waitSecs);

        if (attempt < maxRetries) {
          const backoff = waitSecs * 1000;
          logger.warn(`${label} rate-limited (429), retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(backoff);
          continue;
        }
      }

      // Other retryable status codes
      if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn(
          `${label} transient error ${response.status}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(backoff);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn(
          `${label} network error: ${lastError.message}, retrying in ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(backoff);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`${label} request failed after ${maxRetries} retries`);
}

// ============================================================================
// Generic cached API call helper
// ============================================================================

/**
 * Higher-level helper: fetch JSON from a URL with optional caching.
 */
export async function fetchJson<T>(
  url: string,
  fetchOptions: FetchOptions,
  cacheOptions?: {
    cacheable: boolean;
    endpoint: string;
    params: Record<string, string | number | string[] | undefined>;
  }
): Promise<{ data: T; url: string }> {
  const source = fetchOptions.source ?? 'unknown';
  const label = cacheOptions
    ? describeRequest(cacheOptions.endpoint, cacheOptions.params)
    : url;

  // Check cache first
  if (cacheOptions?.cacheable) {
    const cached = readCache(cacheOptions.endpoint, cacheOptions.params);
    if (cached) {
      return { data: cached.data as T, url: cached.url };
    }
  }

  const response = await fetchWithRetry(url, fetchOptions);

  if (!response.ok) {
    const detail = `${response.status} ${response.statusText}`;
    logger.error(`[${source}] API error: ${label} — ${detail}`);
    throw new Error(`[${source}] API request failed: ${detail}`);
  }

  const data = (await response.json().catch(() => {
    const detail = `invalid JSON (${response.status} ${response.statusText})`;
    logger.error(`[${source}] parse error: ${label} — ${detail}`);
    throw new Error(`[${source}] API request failed: ${detail}`);
  })) as T;

  // Persist to cache
  if (cacheOptions?.cacheable) {
    writeCache(
      cacheOptions.endpoint,
      cacheOptions.params,
      data as unknown as Record<string, unknown>,
      url
    );
  }

  return { data, url };
}
