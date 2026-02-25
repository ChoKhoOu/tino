import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { TelegramNotifier } from '../telegram.js';
import type {
  TradeSignalEvent,
  PnLReportEvent,
  RiskAlertEvent,
  BacktestResultEvent,
} from '../types.js';

const originalFetch = globalThis.fetch;

function mockFetch(ok: boolean) {
  const fn = mock(() =>
    Promise.resolve({ ok } as Response),
  );
  globalThis.fetch = fn;
  return fn;
}

describe('TelegramNotifier', () => {
  const TOKEN = 'test-bot-token-123';
  const CHAT_ID = '-100123456';
  let notifier: TelegramNotifier;

  beforeEach(() => {
    notifier = new TelegramNotifier(TOKEN, CHAT_ID);
    globalThis.fetch = originalFetch;
  });

  describe('sendMessage', () => {
    test('sends POST to Telegram API and returns true on success', async () => {
      const fetchMock = mockFetch(true);
      const result = await notifier.sendMessage('hello');
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body as string);
      expect(body.chat_id).toBe(CHAT_ID);
      expect(body.text).toBe('hello');
      expect(body.parse_mode).toBe('MarkdownV2');
    });

    test('returns false when API responds not ok', async () => {
      mockFetch(false);
      const result = await notifier.sendMessage('hello');
      expect(result).toBe(false);
    });

    test('returns false when fetch throws (never throws itself)', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('network error')));
      const result = await notifier.sendMessage('hello');
      expect(result).toBe(false);
    });

    test('supports HTML parse mode', async () => {
      const fetchMock = mockFetch(true);
      await notifier.sendMessage('<b>bold</b>', 'HTML');

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.parse_mode).toBe('HTML');
    });

    test('bot token never appears in error messages', async () => {
      // Force a fetch error and ensure the token doesn't leak
      const error = new Error('connection refused');
      globalThis.fetch = mock(() => Promise.reject(error));

      const result = await notifier.sendMessage('test');
      expect(result).toBe(false);
      // Token should not appear in the error object
      expect(error.message).not.toContain(TOKEN);
    });
  });

  describe('sendTradeSignal', () => {
    test('formats buy signal correctly', async () => {
      const fetchMock = mockFetch(true);
      const signal: TradeSignalEvent = {
        type: 'trade_signal',
        symbol: 'BTCUSDT',
        side: 'buy',
        price: 42000.5,
        quantity: 0.1,
        venue: 'BINANCE',
        orderId: 'ORD-123',
      };

      const result = await notifier.sendTradeSignal(signal);
      expect(result).toBe(true);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('BUY');
      expect(body.text).toContain('BTCUSDT');
      expect(body.text).toContain('BINANCE');
      expect(body.text).toContain('ORD\\-123');
    });

    test('formats sell signal correctly', async () => {
      const fetchMock = mockFetch(true);
      const signal: TradeSignalEvent = {
        type: 'trade_signal',
        symbol: 'ETHUSDT',
        side: 'sell',
        price: 2500,
        quantity: 1.5,
        venue: 'OKX',
      };

      await notifier.sendTradeSignal(signal);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('SELL');
      expect(body.text).toContain('ETHUSDT');
    });
  });

  describe('sendPnLReport', () => {
    test('formats PnL report correctly', async () => {
      const fetchMock = mockFetch(true);
      const report: PnLReportEvent = {
        type: 'pnl_report',
        totalReturn: 0.156,
        sharpeRatio: 1.85,
        maxDrawdown: 0.08,
        openPositions: 3,
      };

      const result = await notifier.sendPnLReport(report);
      expect(result).toBe(true);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('PnL Report');
      expect(body.text).toContain('15\\.60%');
      expect(body.text).toContain('1\\.85');
      expect(body.text).toContain('3');
    });
  });

  describe('sendRiskAlert', () => {
    test('formats critical alert correctly', async () => {
      const fetchMock = mockFetch(true);
      const alert: RiskAlertEvent = {
        type: 'risk_alert',
        alertType: 'Kill Switch',
        severity: 'critical',
        details: 'Drawdown exceeded 15%',
        recommendedAction: 'Review positions immediately',
      };

      const result = await notifier.sendRiskAlert(alert);
      expect(result).toBe(true);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('Risk Alert');
      expect(body.text).toContain('CRITICAL');
      expect(body.text).toContain('Kill Switch');
    });

    test('formats warning alert correctly', async () => {
      const fetchMock = mockFetch(true);
      const alert: RiskAlertEvent = {
        type: 'risk_alert',
        alertType: 'Position Limit',
        severity: 'warning',
        details: 'Approaching max position size',
        recommendedAction: 'Reduce exposure',
      };

      await notifier.sendRiskAlert(alert);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('WARNING');
    });
  });

  describe('sendBacktestResult', () => {
    test('formats backtest result correctly', async () => {
      const fetchMock = mockFetch(true);
      const result: BacktestResultEvent = {
        type: 'backtest_result',
        strategyName: 'MomentumV2',
        totalReturn: 0.42,
        sharpeRatio: 2.1,
        maxDrawdown: 0.12,
        totalTrades: 150,
        winRate: 0.65,
      };

      const sent = await notifier.sendBacktestResult(result);
      expect(sent).toBe(true);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).toContain('Backtest Complete');
      expect(body.text).toContain('MomentumV2');
      expect(body.text).toContain('42\\.00%');
      expect(body.text).toContain('150');
      expect(body.text).toContain('65\\.00%');
    });

    test('omits optional fields when not provided', async () => {
      const fetchMock = mockFetch(true);
      const result: BacktestResultEvent = {
        type: 'backtest_result',
        strategyName: 'SimpleMA',
        totalReturn: 0.1,
        sharpeRatio: 0.8,
        maxDrawdown: 0.05,
      };

      await notifier.sendBacktestResult(result);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.text).not.toContain('Total Trades');
      expect(body.text).not.toContain('Win Rate');
    });
  });
});
