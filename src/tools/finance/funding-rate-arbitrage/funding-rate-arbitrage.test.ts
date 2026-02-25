import { describe, test, expect } from 'bun:test';
import {
  toBaseSymbol,
  estimateFees,
  alignSettlements,
  computeBacktestMetrics,
} from './index.js';
import type { HistoricalFundingRate, SettlementRecord } from './types.js';

// ============================================================================
// Symbol normalization
// ============================================================================

describe('toBaseSymbol', () => {
  test('strips USDT suffix', () => {
    expect(toBaseSymbol('BTCUSDT')).toBe('BTC');
    expect(toBaseSymbol('ETHUSDT')).toBe('ETH');
  });

  test('strips OKX swap format', () => {
    expect(toBaseSymbol('BTC-USDT-SWAP')).toBe('BTC');
    expect(toBaseSymbol('ETH-USDT-SWAP')).toBe('ETH');
  });

  test('handles plain base symbol', () => {
    expect(toBaseSymbol('BTC')).toBe('BTC');
    expect(toBaseSymbol('SOL')).toBe('SOL');
  });

  test('normalizes to uppercase', () => {
    expect(toBaseSymbol('btcusdt')).toBe('BTC');
    expect(toBaseSymbol('eth-usdt-swap')).toBe('ETH');
    expect(toBaseSymbol('sol')).toBe('SOL');
  });
});

// ============================================================================
// Fee estimation
// ============================================================================

describe('estimateFees', () => {
  test('returns known exchange fees', () => {
    const fees = estimateFees('Binance', 'OKX');
    // Binance taker: 0.04%, OKX taker: 0.05%
    expect(fees.totalEntryFee).toBeCloseTo(0.0004 + 0.0005, 6);
    expect(fees.totalExitFee).toBeCloseTo(0.0004 + 0.0005, 6);
    expect(fees.roundTripFee).toBeCloseTo(2 * (0.0004 + 0.0005), 6);
  });

  test('uses default fees for unknown exchanges', () => {
    const fees = estimateFees('UnknownExchange', 'Binance');
    // Unknown: taker 0.06%, Binance: 0.04%
    expect(fees.totalEntryFee).toBeCloseTo(0.0006 + 0.0004, 6);
  });
});

// ============================================================================
// Settlement alignment
// ============================================================================

describe('alignSettlements', () => {
  const EIGHT_HOURS = 8 * 3600_000;
  const baseTime = 1706745600000; // fixed reference point

  test('aligns matching timestamps', () => {
    const longRates: HistoricalFundingRate[] = [
      { timestamp: baseTime, fundingRate: 0.0001 },
      { timestamp: baseTime + EIGHT_HOURS, fundingRate: 0.0002 },
    ];
    const shortRates: HistoricalFundingRate[] = [
      { timestamp: baseTime, fundingRate: 0.0005 },
      { timestamp: baseTime + EIGHT_HOURS, fundingRate: 0.0003 },
    ];

    const result = alignSettlements(longRates, shortRates);
    expect(result).toHaveLength(2);
    expect(result[0]!.spread).toBeCloseTo(0.0004, 6); // 0.0005 - 0.0001
    expect(result[1]!.spread).toBeCloseTo(0.0001, 6); // 0.0003 - 0.0002
  });

  test('aligns timestamps within 1h tolerance', () => {
    const longRates: HistoricalFundingRate[] = [
      { timestamp: baseTime, fundingRate: 0.0001 },
    ];
    const shortRates: HistoricalFundingRate[] = [
      // 30 minutes offset — should still match
      { timestamp: baseTime + 30 * 60_000, fundingRate: 0.0005 },
    ];

    const result = alignSettlements(longRates, shortRates);
    expect(result).toHaveLength(1);
    expect(result[0]!.spread).toBeCloseTo(0.0004, 6);
  });

  test('returns empty for non-overlapping data', () => {
    const longRates: HistoricalFundingRate[] = [
      { timestamp: baseTime, fundingRate: 0.0001 },
    ];
    const shortRates: HistoricalFundingRate[] = [
      { timestamp: baseTime + 10 * EIGHT_HOURS, fundingRate: 0.0005 },
    ];

    const result = alignSettlements(longRates, shortRates);
    expect(result).toHaveLength(0);
  });

  test('handles empty arrays', () => {
    expect(alignSettlements([], [])).toHaveLength(0);
    expect(alignSettlements([{ timestamp: 0, fundingRate: 0 }], [])).toHaveLength(0);
  });
});

// ============================================================================
// Backtest metrics
// ============================================================================

describe('computeBacktestMetrics', () => {
  const EIGHT_HOURS = 8 * 3600_000;
  const baseTime = 1706745600000;

  const fees = { totalEntryFee: 0.0009, totalExitFee: 0.0009, roundTripFee: 0.0018 };

  test('computes metrics for profitable settlements', () => {
    const settlements: SettlementRecord[] = [
      { timestamp: baseTime, longRate: 0.0001, shortRate: 0.0005, spread: 0.0004 },
      { timestamp: baseTime + EIGHT_HOURS, longRate: 0.0001, shortRate: 0.0006, spread: 0.0005 },
      { timestamp: baseTime + 2 * EIGHT_HOURS, longRate: 0.0002, shortRate: 0.0005, spread: 0.0003 },
    ];

    const result = computeBacktestMetrics(settlements, fees);

    expect(result.grossReturn).toBeCloseTo(0.0012, 6); // 0.0004 + 0.0005 + 0.0003
    expect(result.totalFees).toBeCloseTo(0.0018, 6);
    expect(result.netReturn).toBeCloseTo(0.0012 - 0.0018, 6);
    expect(result.winRate).toBe(1); // all positive spreads
    expect(result.avgSpread).toBeCloseTo(0.0004, 6); // 0.0012 / 3
    expect(result.maxDrawdown).toBe(0); // always increasing, no drawdown
  });

  test('computes drawdown for mixed settlements', () => {
    const settlements: SettlementRecord[] = [
      { timestamp: baseTime, longRate: 0.0001, shortRate: 0.0005, spread: 0.0004 },
      { timestamp: baseTime + EIGHT_HOURS, longRate: 0.0005, shortRate: 0.0001, spread: -0.0004 },
      { timestamp: baseTime + 2 * EIGHT_HOURS, longRate: 0.0005, shortRate: 0.0002, spread: -0.0003 },
      { timestamp: baseTime + 3 * EIGHT_HOURS, longRate: 0.0001, shortRate: 0.0006, spread: 0.0005 },
    ];

    const result = computeBacktestMetrics(settlements, fees);

    expect(result.winRate).toBe(0.5); // 2 out of 4
    expect(result.maxDrawdown).toBeGreaterThan(0);
    // Cumulative: 0.0004, 0.0000, -0.0003, 0.0002
    // Peak at 0.0004, trough at -0.0003, drawdown = 0.0007
    expect(result.maxDrawdown).toBeCloseTo(0.0007, 6);
  });

  test('handles empty settlements', () => {
    const result = computeBacktestMetrics([], fees);
    expect(result.grossReturn).toBe(0);
    expect(result.netReturn).toBe(-fees.roundTripFee);
    expect(result.winRate).toBe(0);
    expect(result.sharpeRatio).toBe(0);
  });

  test('computes sharpe ratio', () => {
    // All identical spreads → std dev = 0 → sharpe = 0
    const settlements: SettlementRecord[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: baseTime + i * EIGHT_HOURS,
      longRate: 0.0001,
      shortRate: 0.0005,
      spread: 0.0004,
    }));

    const result = computeBacktestMetrics(settlements, fees);
    expect(result.spreadStdDev).toBeCloseTo(0, 10);
    expect(result.sharpeRatio).toBe(0); // 0 std dev → 0
  });

  test('computes median correctly for odd count', () => {
    const settlements: SettlementRecord[] = [
      { timestamp: baseTime, longRate: 0, shortRate: 0, spread: 0.001 },
      { timestamp: baseTime + EIGHT_HOURS, longRate: 0, shortRate: 0, spread: 0.003 },
      { timestamp: baseTime + 2 * EIGHT_HOURS, longRate: 0, shortRate: 0, spread: 0.002 },
    ];

    const result = computeBacktestMetrics(settlements, fees);
    expect(result.medianSpread).toBeCloseTo(0.002, 6);
  });

  test('computes median correctly for even count', () => {
    const settlements: SettlementRecord[] = [
      { timestamp: baseTime, longRate: 0, shortRate: 0, spread: 0.001 },
      { timestamp: baseTime + EIGHT_HOURS, longRate: 0, shortRate: 0, spread: 0.002 },
      { timestamp: baseTime + 2 * EIGHT_HOURS, longRate: 0, shortRate: 0, spread: 0.003 },
      { timestamp: baseTime + 3 * EIGHT_HOURS, longRate: 0, shortRate: 0, spread: 0.004 },
    ];

    const result = computeBacktestMetrics(settlements, fees);
    expect(result.medianSpread).toBeCloseTo(0.0025, 6);
  });
});
