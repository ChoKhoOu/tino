import { describe, expect, test } from 'bun:test';
import { ema, macd, obv, rsi, sma, vwap } from './indicators.js';

describe('quant indicators', () => {
  test('sma and ema return rolling arrays', () => {
    const values = [1, 2, 3, 4, 5];
    expect(sma(values, 3)).toEqual([1, 1.5, 2, 3, 4]);
    expect(ema(values, 3).length).toBe(values.length);
  });

  test('rsi stays in 0-100 range', () => {
    const values = [44, 44.15, 43.9, 44.35, 44.8, 45.1, 44.7, 44.9, 45.2, 45.6, 45.9, 45.3, 45.7, 46.0, 45.8];
    const rsiValues = rsi(values, 14);
    for (const value of rsiValues) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  test('macd returns aligned result arrays', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = macd(values);
    expect(result.macdLine.length).toBe(values.length);
    expect(result.signalLine.length).toBe(values.length);
    expect(result.histogram.length).toBe(values.length);
  });

  test('obv and vwap match expected values', () => {
    const closes = [10, 11, 10, 12];
    const highs = [10.5, 11.5, 10.2, 12.5];
    const lows = [9.5, 10.6, 9.8, 11.2];
    const volumes = [100, 120, 80, 110];

    expect(obv(closes, volumes)).toEqual([0, 120, 40, 150]);
    expect(vwap(highs, lows, closes, volumes)).toEqual([
      10,
      10.563636363636364,
      10.413333333333334,
      10.81219512195122,
    ]);
  });
});
