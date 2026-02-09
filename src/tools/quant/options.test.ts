import { describe, expect, test } from 'bun:test';
import { blackScholesCall, blackScholesPut } from './options.js';

describe('quant options', () => {
  test('black-scholes call reference value', () => {
    const call = blackScholesCall({
      spot: 100,
      strike: 100,
      rate: 0.05,
      timeToExpiry: 1,
      volatility: 0.2,
    });

    expect(call).toBeCloseTo(10.4506, 2);
  });

  test('black-scholes put reference value', () => {
    const put = blackScholesPut({
      spot: 100,
      strike: 100,
      rate: 0.05,
      timeToExpiry: 1,
      volatility: 0.2,
    });

    expect(put).toBeCloseTo(5.5735, 2);
  });
});
