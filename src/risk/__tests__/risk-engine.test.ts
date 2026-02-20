import { describe, test, expect, beforeEach } from 'bun:test';
import { RiskEngine } from '../risk-engine.js';
import type { RiskConfig } from '../risk-config.js';
import type { OrderInput } from '../risk-rules.js';

const testConfig: RiskConfig = {
  maxPositionSize: { BTCUSDT: 1.0, '*': 100.0 },
  maxGrossExposure: 50_000,
  maxDailyLoss: 500,
  maxDrawdown: 0.15,
  maxOrderRate: 5,
};

const validOrder: OrderInput = {
  venue: 'BINANCE',
  instrument: 'BTCUSDT',
  side: 'buy',
  quantity: 0.3,
  price: 40_000,
};

describe('RiskEngine', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine(testConfig);
  });

  test('allows valid order within all limits', () => {
    const result = engine.preTradeCheck(validOrder);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('refuses order exceeding position size', () => {
    engine.updatePosition('BTCUSDT', 0.9);
    const result = engine.preTradeCheck(validOrder);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exceeds limit');
  });

  test('refuses order when daily loss reached', () => {
    engine.updatePnl(-500);
    const result = engine.preTradeCheck(validOrder);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily loss');
  });

  test('refuses order when drawdown triggers kill switch', () => {
    engine.updateEquity(10_000);
    engine.updateEquity(8_400);
    const result = engine.preTradeCheck(validOrder);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Drawdown');
  });

  test('refuses when order rate exceeded', () => {
    for (let i = 0; i < 5; i++) engine.recordOrder();
    const result = engine.preTradeCheck(validOrder);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Order rate');
  });

  test('tracks peak equity correctly', () => {
    engine.updateEquity(10_000);
    engine.updateEquity(12_000);
    engine.updateEquity(11_000);
    const state = engine.getState();
    expect(state.peakEquity).toBe(12_000);
    expect(state.currentEquity).toBe(11_000);
  });

  test('resetDaily clears PnL and order timestamps', () => {
    engine.updatePnl(-300);
    engine.recordOrder();
    engine.resetDaily();
    const state = engine.getState();
    expect(state.dailyPnl).toBe(0);
    expect(state.recentOrderTimestamps).toHaveLength(0);
  });

  test('getConfig returns loaded config', () => {
    expect(engine.getConfig()).toEqual(testConfig);
  });
});
