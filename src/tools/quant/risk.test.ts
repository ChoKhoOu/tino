import { describe, expect, test } from 'bun:test';
import { sharpeRatio } from './risk.js';

describe('quant risk', () => {
  test('sharpe ratio matches manual calculation', () => {
    const returns = [0.01, 0.02, -0.01, 0.015, 0.005];
    const riskFreeRate = 0;

    const mean = returns.reduce((acc, value) => acc + value, 0) / returns.length;
    const variance = returns.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (returns.length - 1);
    const stdev = Math.sqrt(variance);
    const manualSharpe = mean / stdev;

    expect(sharpeRatio(returns, riskFreeRate, 1)).toBeCloseTo(manualSharpe, 10);
  });
});
