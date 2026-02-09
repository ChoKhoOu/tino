/**
 * Shared utilities for external financial data source clients.
 *
 * Provides retry logic, API key validation, and rate-limit tracking
 * so each client module stays focused on endpoint-specific logic.
 */
import { readCache, writeCache, describeRequest } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

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
// Rate-limit tracking
// ============================================================================

interface RateLimitState {
  /** Timestamp (ms) when we can next make a request */
  retryAfter: number;
}

const rateLimits = new Map<string, RateLimitState>();

/**
 * Check if a source is currently rate-limited.
 * Returns the number of ms to wait, or 0 if clear.
 */
export function getRateLimitDelay(source: string): number {
  const state = rateLimits.get(source);
  if (!state) return 0;
  const now = Date.now();
  if (now >= state.retryAfter) {
    rateLimits.delete(source);
    return 0;
  }
  return state.retryAfter - now;
}

/**
 * Record a rate-limit signal from an API response.
 * @param source  - Data source identifier (e.g. "FMP")
 * @param retryAfterSecs - Seconds to wait (from Retry-After header or default)
 */
export function recordRateLimit(source: string, retryAfterSecs: number): void {
  rateLimits.set(source, { retryAfter: Date.now() + retryAfterSecs * 1000 });
}

// ============================================================================
// API key validation
// ============================================================================

/**
 * Read an API key from `process.env` at call time (lazy).
 * Throws a descriptive error when the key is missing.
 */
export function validateApiKey(keyName: string, envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `Missing API key: ${envVar} is not set. ` +
        `Please add ${envVar}=<your-key> to your .env file to use the ${keyName} data source.`
    );
  }
  return value;
}

/**
 * Optionally read an API key — returns undefined instead of throwing when absent.
 * Used for sources with free tiers (e.g. CoinGecko).
 */
export function getOptionalApiKey(envVar: string): string | undefined {
  return process.env[envVar] || undefined;
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
 * Follows the same pattern as the existing `callApi` in `api.ts`
 * but works with arbitrary base URLs and auth schemes.
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
