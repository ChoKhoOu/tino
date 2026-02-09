import { describe, expect, test } from 'bun:test';
import { equalWeightPortfolio, meanVarianceOptimization, minVariancePortfolio, riskParityPortfolio } from './portfolio.js';

describe('quant portfolio', () => {
  const returnsMatrix = [
    [0.01, 0.02, 0.015, -0.005, 0.012],
    [0.008, 0.018, 0.01, 0.002, 0.011],
    [0.012, 0.019, 0.02, -0.002, 0.013],
  ];

  test('equal weight portfolio sums to 1', () => {
    const weights = equalWeightPortfolio(3);
    expect(weights).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  test('minimum variance portfolio sums to 1', () => {
    const weights = minVariancePortfolio(returnsMatrix);
    const sum = weights.reduce((acc, value) => acc + value, 0);

    expect(sum).toBeCloseTo(1, 4);
  });

  test('mean variance optimization sums to 1', () => {
    const weights = meanVarianceOptimization(returnsMatrix, 2.5);
    const sum = weights.reduce((acc, value) => acc + value, 0);

    expect(sum).toBeCloseTo(1, 4);
  });

  test('risk parity portfolio sums to 1', () => {
    const weights = riskParityPortfolio(returnsMatrix);
    const sum = weights.reduce((acc, value) => acc + value, 0);

    expect(sum).toBeCloseTo(1, 4);
  });
});
