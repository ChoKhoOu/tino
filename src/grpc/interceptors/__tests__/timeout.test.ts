import { describe, test, expect } from 'bun:test';
import { createTimeoutInterceptor } from '../timeout.js';
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

describe('createTimeoutInterceptor', () => {
  test('unary request uses 30s default timeout', async () => {
    const interceptor = createTimeoutInterceptor();
    let capturedTimer: ReturnType<typeof setTimeout> | undefined;
    const origSetTimeout = globalThis.setTimeout;

    // Spy on setTimeout to capture the delay value
    let capturedDelay: number | undefined;
    globalThis.setTimeout = ((fn: any, delay?: number) => {
      capturedDelay = delay;
      const timer = origSetTimeout(fn, 999_999); // Don't actually fire
      capturedTimer = timer;
      return timer;
    }) as any;

    const mockNext = (async (req: any) => ({ message: 'ok' })) as any;
    const wrapped = interceptor(mockNext);

    try {
      await wrapped(makeReq({ stream: false }));
    } finally {
      globalThis.setTimeout = origSetTimeout;
      if (capturedTimer) clearTimeout(capturedTimer);
    }

    expect(capturedDelay).toBe(30_000);
  });

  test('streaming request uses 60s default timeout', async () => {
    const interceptor = createTimeoutInterceptor();
    const origSetTimeout = globalThis.setTimeout;
    let capturedTimer: ReturnType<typeof setTimeout> | undefined;

    let capturedDelay: number | undefined;
    globalThis.setTimeout = ((fn: any, delay?: number) => {
      capturedDelay = delay;
      const timer = origSetTimeout(fn, 999_999);
      capturedTimer = timer;
      return timer;
    }) as any;

    const mockNext = (async (req: any) => ({ message: 'ok' })) as any;
    const wrapped = interceptor(mockNext);

    try {
      await wrapped(makeReq({ stream: true }));
    } finally {
      globalThis.setTimeout = origSetTimeout;
      if (capturedTimer) clearTimeout(capturedTimer);
    }

    expect(capturedDelay).toBe(60_000);
  });

  test('custom timeout overrides both unary and stream defaults', async () => {
    const interceptor = createTimeoutInterceptor(5_000);
    const origSetTimeout = globalThis.setTimeout;
    let capturedTimer: ReturnType<typeof setTimeout> | undefined;

    let capturedDelay: number | undefined;
    globalThis.setTimeout = ((fn: any, delay?: number) => {
      capturedDelay = delay;
      const timer = origSetTimeout(fn, 999_999);
      capturedTimer = timer;
      return timer;
    }) as any;

    const mockNext = (async (req: any) => ({ message: 'ok' })) as any;
    const wrapped = interceptor(mockNext);

    try {
      // Unary with custom timeout
      await wrapped(makeReq({ stream: false }));
      expect(capturedDelay).toBe(5_000);

      // Reset for stream test
      capturedDelay = undefined;
      if (capturedTimer) clearTimeout(capturedTimer);

      await wrapped(makeReq({ stream: true }));
      expect(capturedDelay as unknown as number).toBe(5_000);
    } finally {
      globalThis.setTimeout = origSetTimeout;
      if (capturedTimer) clearTimeout(capturedTimer);
    }
  });

  test('already-aborted signal passes through without setting timeout', async () => {
    const interceptor = createTimeoutInterceptor();
    const origSetTimeout = globalThis.setTimeout;

    let setTimeoutCalled = false;
    globalThis.setTimeout = ((fn: any, delay?: number) => {
      setTimeoutCalled = true;
      return origSetTimeout(fn, delay);
    }) as any;

    let receivedSignal: AbortSignal | undefined;
    const mockNext = (async (req: any) => {
      receivedSignal = req.signal;
      return { message: 'ok' };
    }) as any;

    const wrapped = interceptor(mockNext);
    const controller = new AbortController();
    controller.abort();

    try {
      await wrapped(makeReq({ signal: controller.signal }));
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }

    // When signal is already aborted, next is called directly — no setTimeout
    expect(setTimeoutCalled).toBe(false);
    // The original signal is passed through unchanged
    expect(receivedSignal).toBe(controller.signal);
  });

  test('timer is cleaned up after success', async () => {
    const interceptor = createTimeoutInterceptor(10_000);
    const origClearTimeout = globalThis.clearTimeout;
    const origSetTimeout = globalThis.setTimeout;

    let timerCreated: ReturnType<typeof setTimeout> | undefined;
    let timerCleared: ReturnType<typeof setTimeout> | undefined;

    globalThis.setTimeout = ((fn: any, delay?: number) => {
      const timer = origSetTimeout(fn, 999_999);
      timerCreated = timer;
      return timer;
    }) as any;

    globalThis.clearTimeout = ((timer: any) => {
      timerCleared = timer;
      origClearTimeout(timer);
    }) as any;

    const mockNext = (async (req: any) => ({ message: 'ok' })) as any;
    const wrapped = interceptor(mockNext);

    try {
      await wrapped(makeReq());
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
    }

    expect(timerCreated).toBeDefined();
    expect(timerCleared).toBe(timerCreated);
  });

  test('upstream abort forwards to controller', async () => {
    const interceptor = createTimeoutInterceptor(999_999);
    const upstreamController = new AbortController();

    let downstreamSignal: AbortSignal | undefined;
    const mockNext = (async (req: any) => {
      downstreamSignal = req.signal;
      // Simulate async work — abort upstream while "in flight"
      upstreamController.abort();
      // Give microtask queue a tick for the abort listener to fire
      await new Promise((r) => setTimeout(r, 10));
      return { message: 'ok' };
    }) as any;

    const wrapped = interceptor(mockNext);

    await wrapped(makeReq({ signal: upstreamController.signal }));

    expect(downstreamSignal).toBeDefined();
    expect(downstreamSignal!.aborted).toBe(true);
  });
});
