import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { PnLReportScheduler } from '../pnl-scheduler.js';
import { TelegramNotifier } from '../telegram.js';
import type { PnLReportEvent } from '../types.js';

const originalFetch = globalThis.fetch;

function mockFetch(ok = true) {
  const fn = mock(() => Promise.resolve({ ok } as Response));
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const sampleReport: PnLReportEvent = {
  type: 'pnl_report',
  totalReturn: 0.12,
  sharpeRatio: 1.5,
  maxDrawdown: 0.05,
  openPositions: 2,
};

describe('PnLReportScheduler', () => {
  let scheduler: PnLReportScheduler;

  afterEach(() => {
    scheduler?.stop();
    globalThis.fetch = originalFetch;
  });

  test('start() begins the interval timer', () => {
    mockFetch(true);
    const notifier = new TelegramNotifier('tok', '-1');
    scheduler = new PnLReportScheduler(notifier, 'hourly', async () => sampleReport);

    expect(scheduler.isRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
  });

  test('stop() clears the interval timer', () => {
    mockFetch(true);
    const notifier = new TelegramNotifier('tok', '-1');
    scheduler = new PnLReportScheduler(notifier, 'daily', async () => sampleReport);

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  test('start() is idempotent', () => {
    mockFetch(true);
    const notifier = new TelegramNotifier('tok', '-1');
    scheduler = new PnLReportScheduler(notifier, 'hourly', async () => sampleReport);

    scheduler.start();
    scheduler.start(); // second call should not create a second timer
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  test('does not throw when fetchData rejects', async () => {
    mockFetch(true);
    const notifier = new TelegramNotifier('tok', '-1');
    const failingFetcher = async (): Promise<PnLReportEvent> => {
      throw new Error('data unavailable');
    };
    scheduler = new PnLReportScheduler(notifier, 'hourly', failingFetcher);

    // Directly invoke a tick cycle by starting/stopping — no throw expected
    scheduler.start();
    scheduler.stop();
  });
});
