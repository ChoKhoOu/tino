/**
 * gRPC retry interceptor.
 * Retries on UNAVAILABLE / DEADLINE_EXCEEDED with exponential backoff.
 */
import type { Interceptor } from "@connectrpc/connect";
import { ConnectError, Code } from "@connectrpc/connect";

const RETRYABLE_CODES = new Set([Code.Unavailable, Code.DeadlineExceeded]);
const BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRetryInterceptor(
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Interceptor {
  return (next) => async (req) => {
    // Only retry unary RPCs — streaming retries are unsafe
    if (req.stream) {
      return next(req);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next(req);
      } catch (err) {
        lastError = err;
        const code = ConnectError.from(err).code;
        if (!RETRYABLE_CODES.has(code) || attempt === maxRetries) {
          throw err;
        }
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
    // Should be unreachable, but TypeScript wants it
    throw lastError;
  };
}
