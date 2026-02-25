import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createNotificationHook } from '../notification-hook.js';
import type { HookContext } from '@/domain/index.js';
import type { TelegramSettings } from '../types.js';

const originalFetch = globalThis.fetch;

function mockFetch(ok = true) {
  const fn = mock(() => Promise.resolve({ ok } as Response));
  globalThis.fetch = fn;
  return fn;
}

const defaultSettings: TelegramSettings = {
  botToken: 'test-token',
  chatId: '-100123',
  enabled: true,
  events: {
    tradeSignals: true,
    pnlReports: true,
    riskAlerts: true,
    backtestComplete: true,
  },
  pnlReportInterval: 'daily',
};

describe('createNotificationHook', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('creates a PostToolUse function hook', () => {
    const hook = createNotificationHook(defaultSettings);
    expect(hook.event).toBe('PostToolUse');
    expect(hook.type).toBe('function');
    expect(typeof hook.fn).toBe('function');
  });

  test('always returns { allow: true } regardless of tool', async () => {
    mockFetch(true);
    const hook = createNotificationHook(defaultSettings);
    const ctx: HookContext = {
      event: 'PostToolUse',
      toolId: 'some_unrelated_tool',
      args: {},
      result: '{"data":{}}',
    };
    const result = await hook.fn!(ctx);
    expect(result.allow).toBe(true);
  });

  test('only processes trading_live and trading_sim tools', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    // Unrelated tool — should NOT trigger a fetch
    await hook.fn!({
      event: 'PostToolUse',
      toolId: 'market_data',
      args: {},
      result: '{"data":{}}',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sends notification for trading_live submit_order', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    const ctx: HookContext = {
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: {
        action: 'submit_order',
        venue: 'BINANCE',
        order: {
          instrument: 'BTCUSDT',
          side: 'buy',
          price: 42000,
          quantity: 0.1,
        },
      },
      result: JSON.stringify({
        data: { status: 'submitted', orderId: 'ORD-001', success: true },
      }),
    };

    const result = await hook.fn!(ctx);
    expect(result.allow).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain('BTCUSDT');
    expect(body.text).toContain('BUY');
  });

  test('does not send for trading_live with non-submitted status', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: { action: 'submit_order' },
      result: JSON.stringify({ data: { status: 'refused', error: 'not confirmed' } }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sends notification for trading_sim backtest complete', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    const ctx: HookContext = {
      event: 'PostToolUse',
      toolId: 'trading_sim',
      args: { action: 'backtest', strategy_file: 'momentum.py' },
      result: JSON.stringify({
        data: {
          status: 'completed',
          result: {
            totalReturn: 0.25,
            sharpeRatio: 1.5,
            maxDrawdown: 0.1,
            totalTrades: 80,
            winRate: 0.55,
          },
        },
      }),
    };

    const result = await hook.fn!(ctx);
    expect(result.allow).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.text).toContain('Backtest Complete');
    expect(body.text).toContain('momentum\\.py');
  });

  test('does not send for trading_sim with error status', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_sim',
      args: { action: 'backtest' },
      result: JSON.stringify({ data: { status: 'error', error: 'failed' } }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns { allow: true } even when notification fetch fails', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('network failure')));
    const hook = createNotificationHook(defaultSettings);

    const ctx: HookContext = {
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: {
        venue: 'SIM',
        order: { instrument: 'ETHUSDT', side: 'sell', price: 2000, quantity: 1 },
      },
      result: JSON.stringify({ data: { status: 'submitted', orderId: 'X' } }),
    };

    const result = await hook.fn!(ctx);
    expect(result.allow).toBe(true);
  });

  test('returns { allow: true } when result is invalid JSON', async () => {
    mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    const result = await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: {},
      result: 'not valid json',
    });
    expect(result.allow).toBe(true);
  });

  test('respects tradeSignals=false in events config', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook({
      ...defaultSettings,
      events: { ...defaultSettings.events, tradeSignals: false },
    });

    await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: {
        venue: 'BINANCE',
        order: { instrument: 'BTCUSDT', side: 'buy', price: 40000, quantity: 0.01 },
      },
      result: JSON.stringify({ data: { status: 'submitted', orderId: 'O1' } }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('respects backtestComplete=false in events config', async () => {
    const fetchMock = mockFetch(true);
    const hook = createNotificationHook({
      ...defaultSettings,
      events: { ...defaultSettings.events, backtestComplete: false },
    });

    await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_sim',
      args: { action: 'backtest', strategy_file: 'test.py' },
      result: JSON.stringify({
        data: { status: 'completed', result: { totalReturn: 0.1, sharpeRatio: 1, maxDrawdown: 0.05 } },
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('handles missing result gracefully', async () => {
    mockFetch(true);
    const hook = createNotificationHook(defaultSettings);

    const result = await hook.fn!({
      event: 'PostToolUse',
      toolId: 'trading_live',
      args: {},
    });
    expect(result.allow).toBe(true);
  });
});
