/**
 * Scheduled PnL report push via Telegram.
 *
 * Calls a user-provided callback to fetch portfolio data on each tick,
 * then sends the report through TelegramNotifier.
 */

import type { TelegramNotifier } from './telegram.js';
import type { PnLReportEvent } from './types.js';

export type PnLDataFetcher = () => Promise<PnLReportEvent>;

export class PnLReportScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly notifier: TelegramNotifier;
  private readonly intervalMs: number;
  private readonly fetchData: PnLDataFetcher;

  constructor(
    notifier: TelegramNotifier,
    interval: 'hourly' | 'daily',
    fetchData: PnLDataFetcher,
  ) {
    this.notifier = notifier;
    this.intervalMs = interval === 'hourly' ? 3_600_000 : 86_400_000;
    this.fetchData = fetchData;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch(() => {});
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  private async tick(): Promise<void> {
    try {
      const data = await this.fetchData();
      await this.notifier.sendPnLReport(data);
    } catch {
      // Non-fatal: PnL report failures never break execution
    }
  }
}
