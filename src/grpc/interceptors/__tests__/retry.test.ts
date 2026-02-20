import { describe, test, expect } from 'bun:test';
import { createRetryInterceptor } from '../retry.js';
import { ConnectError, Code } from '@connectrpc/connect';
import type { Interceptor } from '@connectrpc/connect';

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    stream: false,
    signal: new AbortController().signal,
    header: new Headers(),
    url: 'http://localhost:50051',
    service: {},
    method: {},
    message: {},
    requestMethod: 'POST',
    contextValues: {},
    ...overrides,
  } as any;
}

/** Replace setTimeout so sleep() resolves instantly, capturing delay args. */
function withFakeTimers<T>(fn: (delays: number[]) => Promise<T>): Promise<T> {
  const origSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = ((cb: () => void, ms?: number) => {
    if (ms !== undefined) delays.push(ms);
    return origSetTimeout(cb, 0); // resolve immediately
  }) as any;
  return fn(delays).finally(() => {
    globalThis.setTimeout = origSetTimeout;
  });
}

describe('createRetryInterceptor', () => {
  test('succeeds on first attempt without retry', async () => {
    const interceptor = createRetryInterceptor();
    let callCount = 0;
    const expected = { message: 'ok' };

    const mockNext = (async () => {
      callCount++;
      return expected;
    }) as any;

    const wrapped = interceptor(mockNext);
    const result = await wrapped(makeReq());

    expect(result as unknown).toBe(expected);
    expect(callCount).toBe(1);
  });

  test('retries on UNAVAILABLE and succeeds', async () => {
    await withFakeTimers(async (delays) => {
      const interceptor = createRetryInterceptor(3);
      let callCount = 0;
      const expected = { message: 'ok' };

      const mockNext = (async () => {
        callCount++;
        if (callCount < 3) {
          throw new ConnectError('unavailable', Code.Unavailable);
        }
        return expected;
      }) as any;

      const wrapped = interceptor(mockNext);
      const result = await wrapped(makeReq());

      expect(result as unknown).toBe(expected);
      expect(callCount).toBe(3);
      // 2 retries: delays should be 1000ms, 2000ms (exponential backoff)
      expect(delays).toEqual([1000, 2000]);
    });
  });

  test('retries on DEADLINE_EXCEEDED and succeeds', async () => {
    await withFakeTimers(async () => {
      const interceptor = createRetryInterceptor(3);
      let callCount = 0;
      const expected = { message: 'ok' };

      const mockNext = (async () => {
        callCount++;
        if (callCount < 2) {
          throw new ConnectError('deadline exceeded', Code.DeadlineExceeded);
        }
        return expected;
      }) as any;

      const wrapped = interceptor(mockNext);
      const result = await wrapped(makeReq());

      expect(result as unknown).toBe(expected);
      expect(callCount).toBe(2);
    });
  });

  test('does NOT retry on non-retryable error codes', async () => {
    const interceptor = createRetryInterceptor(3);
    let callCount = 0;

    const mockNext = (async () => {
      callCount++;
      throw new ConnectError('invalid argument', Code.InvalidArgument);
    }) as any;

    const wrapped = interceptor(mockNext);

    try {
      await wrapped(makeReq());
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ConnectError);
      expect((err as ConnectError).code).toBe(Code.InvalidArgument);
    }

    // No retry for non-retryable codes
    expect(callCount).toBe(1);
  });

  test('stops retrying after maxRetries and throws', async () => {
    await withFakeTimers(async () => {
      const interceptor = createRetryInterceptor(2);
      let callCount = 0;

      const mockNext = (async () => {
        callCount++;
        throw new ConnectError('unavailable', Code.Unavailable);
      }) as any;

      const wrapped = interceptor(mockNext);

      try {
        await wrapped(makeReq());
        expect(true).toBe(false); // should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(ConnectError);
        expect((err as ConnectError).code).toBe(Code.Unavailable);
      }

      // 1 initial + 2 retries = 3 total calls
      expect(callCount).toBe(3);
    });
  });

  test('streaming requests skip retry and pass through directly', async () => {
    const interceptor = createRetryInterceptor(3);
    let callCount = 0;

    const mockNext = (async () => {
      callCount++;
      throw new ConnectError('unavailable', Code.Unavailable);
    }) as any;

    const wrapped = interceptor(mockNext);

    try {
      await wrapped(makeReq({ stream: true }));
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect((err as ConnectError).code).toBe(Code.Unavailable);
    }

    // Stream requests are not retried -- only 1 call
    expect(callCount).toBe(1);
  });

  test('custom maxRetries parameter works', async () => {
    await withFakeTimers(async () => {
      const interceptor = createRetryInterceptor(1);
      let callCount = 0;

      const mockNext = (async () => {
        callCount++;
        throw new ConnectError('unavailable', Code.Unavailable);
      }) as any;

      const wrapped = interceptor(mockNext);

      try {
        await wrapped(makeReq());
        expect(true).toBe(false);
      } catch {
        // Expected
      }

      // 1 initial + 1 retry = 2 total calls
      expect(callCount).toBe(2);
    });
  });

  test('default maxRetries is 3', async () => {
    await withFakeTimers(async (delays) => {
      const interceptor = createRetryInterceptor();
      let callCount = 0;

      const mockNext = (async () => {
        callCount++;
        throw new ConnectError('unavailable', Code.Unavailable);
      }) as any;

      const wrapped = interceptor(mockNext);

      try {
        await wrapped(makeReq());
        expect(true).toBe(false);
      } catch {
        // Expected
      }

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);
      // 3 backoff delays: 1000, 2000, 4000 (exponential)
      expect(delays).toEqual([1000, 2000, 4000]);
    });
  });
});
