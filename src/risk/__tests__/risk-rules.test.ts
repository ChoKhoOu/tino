import { describe, test, expect } from 'bun:test';
import {
  checkMaxPositionSize,
  checkMaxGrossExposure,
  checkMaxDailyLoss,
  checkMaxDrawdown,
  checkMaxOrderRate,
  type OrderInput,
  type RiskState,
} from '../risk-rules.js';
import type { RiskConfig } from '../risk-config.js';

const baseOrder: OrderInput = {
  venue: 'BINANCE',
  instrument: 'BTCUSDT',
  side: 'buy',
  quantity: 0.5,
  price: 40_000,
};

const baseState: RiskState = {
  positions: {},
  prices: {},
  dailyPnl: 0,
  peakEquity: 10_000,
  currentEquity: 10_000,
  recentOrderTimestamps: [],
};

const baseConfig: RiskConfig = {
  maxPositionSize: { BTCUSDT: 1.0, '*': 100.0 },
  maxGrossExposure: 50_000,
  maxDailyLoss: 500,
  maxDrawdown: 0.15,
  maxOrderRate: 10,
};

describe('checkMaxPositionSize', () => {
  test('passes when position is within limit', () => {
    const result = checkMaxPositionSize(baseOrder, baseState, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails when position exceeds instrument limit', () => {
    const state = { ...baseState, positions: { BTCUSDT: 0.8 } };
    const result = checkMaxPositionSize(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('exceeds limit');
  });

  test('uses wildcard limit for unknown instruments', () => {
    const order = { ...baseOrder, instrument: 'SOLUSDT', quantity: 50 };
    const result = checkMaxPositionSize(order, baseState, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails with wildcard limit exceeded', () => {
    const order = { ...baseOrder, instrument: 'SOLUSDT', quantity: 101 };
    const result = checkMaxPositionSize(order, baseState, baseConfig);
    expect(result.pass).toBe(false);
  });
});

describe('checkMaxGrossExposure', () => {
  test('passes when exposure is within limit', () => {
    const result = checkMaxGrossExposure(baseOrder, baseState, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails when exposure exceeds limit', () => {
    const order = { ...baseOrder, quantity: 2, price: 40_000 };
    const result = checkMaxGrossExposure(order, baseState, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Gross exposure');
  });

  test('fails when existing positions plus new order exceed limit', () => {
    const state: RiskState = {
      ...baseState,
      positions: { BTCUSDT: 1.0 },
      prices: { BTCUSDT: 40_000 },
    };
    // Existing: 1.0 * 40_000 = 40_000. New: 0.5 * 40_000 = 20_000. Total: 60_000 > 50_000
    const result = checkMaxGrossExposure(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Gross exposure');
  });

  test('uses order price for matching instrument in existing positions', () => {
    const state: RiskState = {
      ...baseState,
      positions: { BTCUSDT: 0.2 },
      prices: { BTCUSDT: 30_000 },
    };
    // order.price = 40_000 used for BTCUSDT (matching instrument)
    // Existing: 0.2 * 40_000 = 8_000. New: 0.5 * 40_000 = 20_000. Total: 28_000 < 50_000
    const result = checkMaxGrossExposure(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('uses stored price for non-matching instruments', () => {
    const state: RiskState = {
      ...baseState,
      positions: { ETHUSDT: 10.0 },
      prices: { ETHUSDT: 3_000 },
    };
    // ETHUSDT uses stored price: 10 * 3_000 = 30_000. New BTCUSDT: 0.5 * 40_000 = 20_000. Total: 50_000
    const config = { ...baseConfig, maxGrossExposure: 49_999 };
    const result = checkMaxGrossExposure(baseOrder, state, config);
    expect(result.pass).toBe(false);
  });

  test('treats unknown instrument price as zero', () => {
    const state: RiskState = {
      ...baseState,
      positions: { ETHUSDT: 10.0 },
      prices: {},
    };
    // ETHUSDT has no stored price → 0. New BTCUSDT: 0.5 * 40_000 = 20_000. Total: 20_000 < 50_000
    const result = checkMaxGrossExposure(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });
});

describe('checkMaxDailyLoss', () => {
  test('passes when daily loss is within limit', () => {
    const state = { ...baseState, dailyPnl: -200 };
    const result = checkMaxDailyLoss(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails when daily loss reaches limit', () => {
    const state = { ...baseState, dailyPnl: -500 };
    const result = checkMaxDailyLoss(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Daily loss');
  });

  test('fails when daily loss exceeds limit', () => {
    const state = { ...baseState, dailyPnl: -750 };
    const result = checkMaxDailyLoss(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
  });
});

describe('checkMaxDrawdown', () => {
  test('passes when drawdown is within limit', () => {
    const state = { ...baseState, peakEquity: 10_000, currentEquity: 9_000 };
    const result = checkMaxDrawdown(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails when drawdown reaches limit', () => {
    const state = { ...baseState, peakEquity: 10_000, currentEquity: 8_500 };
    const result = checkMaxDrawdown(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Drawdown');
  });

  test('passes when peak equity is zero', () => {
    const state = { ...baseState, peakEquity: 0, currentEquity: 0 };
    const result = checkMaxDrawdown(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });
});

describe('checkMaxOrderRate', () => {
  test('passes when order rate is within limit', () => {
    const result = checkMaxOrderRate(baseOrder, baseState, baseConfig);
    expect(result.pass).toBe(true);
  });

  test('fails when order rate reaches limit', () => {
    const now = Date.now();
    const timestamps = Array.from({ length: 10 }, (_, i) => now - i * 1000);
    const state = { ...baseState, recentOrderTimestamps: timestamps };
    const result = checkMaxOrderRate(baseOrder, state, baseConfig);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain('Order rate');
  });

  test('ignores old timestamps beyond one minute', () => {
    const old = Date.now() - 120_000;
    const timestamps = Array.from({ length: 15 }, () => old);
    const state = { ...baseState, recentOrderTimestamps: timestamps };
    const result = checkMaxOrderRate(baseOrder, state, baseConfig);
    expect(result.pass).toBe(true);
  });
});
