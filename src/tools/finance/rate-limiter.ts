/**
 * Rate-limit tracking and API key validation for financial data sources.
 *
 * Extracted from shared.ts to keep each module under 200 LOC.
 */

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
