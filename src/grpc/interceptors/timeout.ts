/**
 * gRPC timeout interceptor.
 * Adds deadline to every RPC: 30s unary, 60s streaming by default.
 */
import type { Interceptor } from "@connectrpc/connect";

const DEFAULT_UNARY_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 60_000;

export function createTimeoutInterceptor(
  defaultMs?: number,
): Interceptor {
  const unaryMs = defaultMs ?? DEFAULT_UNARY_TIMEOUT_MS;
  const streamMs = defaultMs ?? DEFAULT_STREAM_TIMEOUT_MS;

  return (next) => async (req) => {
    const timeoutMs = req.stream ? streamMs : unaryMs;

    // If the signal already has a timeout, don't override it
    if (req.signal.aborted) {
      return next(req);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Forward upstream abort to our controller
    const onAbort = () => controller.abort();
    req.signal.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await next({
        ...req,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
      req.signal.removeEventListener("abort", onAbort);
    }
  };
}
