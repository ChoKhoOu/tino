import { describe, test, expect } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin from '../quant-compute.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

function parse(result: string) {
  return JSON.parse(result);
}

describe('quant_compute consolidated tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('quant_compute');
    expect(plugin.domain).toBe('quant');
    expect(plugin.riskLevel).toBe('safe');
  });

  describe('indicators action', () => {
    test('computes SMA from closing prices', async () => {
      const result = parse(
        await plugin.execute(
          {
            action: 'indicators',
            inputs: {
              indicator: 'sma',
              closes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
              period: 3,
            },
          },
          ctx,
        ),
      );
      expect(result.data.indicator).toBe('sma');
      expect(result.data.values).toBeInstanceOf(Array);
      expect(result.data.values.length).toBe(10);
    });

    test('computes RSI from closing prices', async () => {
      const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
      const result = parse(
        await plugin.execute(
          { action: 'indicators', inputs: { indicator: 'rsi', closes, period: 14 } },
          ctx,
        ),
      );
      expect(result.data.indicator).toBe('rsi');
      expect(result.data.values).toBeInstanceOf(Array);
    });

    test('computes MACD with custom periods', async () => {
      const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 10);
      const result = parse(
        await plugin.execute(
          { action: 'indicators', inputs: { indicator: 'macd', closes, fast: 12, slow: 26, signal: 9 } },
          ctx,
        ),
      );
      expect(result.data.indicator).toBe('macd');
      expect(result.data.macdLine).toBeInstanceOf(Array);
      expect(result.data.signalLine).toBeInstanceOf(Array);
      expect(result.data.histogram).toBeInstanceOf(Array);
    });

    test('computes ATR requiring highs and lows', async () => {
      const highs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const lows = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
      const closes = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
      const result = parse(
        await plugin.execute(
          { action: 'indicators', inputs: { indicator: 'atr', closes, highs, lows, period: 3 } },
          ctx,
        ),
      );
      expect(result.data.indicator).toBe('atr');
      expect(result.data.values).toBeInstanceOf(Array);
    });

    test('computes OBV requiring volumes', async () => {
      const closes = [10, 11, 10.5, 12, 11.5];
      const volumes = [100, 200, 150, 300, 250];
      const result = parse(
        await plugin.execute(
          { action: 'indicators', inputs: { indicator: 'obv', closes, volumes } },
          ctx,
        ),
      );
      expect(result.data.indicator).toBe('obv');
      expect(result.data.values).toBeInstanceOf(Array);
    });
  });

  describe('risk action', () => {
    test('computes all risk metrics from returns', async () => {
      const returns = [0.01, -0.02, 0.03, -0.01, 0.02, -0.005, 0.015, -0.01, 0.025, 0.005];
      const result = parse(
        await plugin.execute(
          { action: 'risk', inputs: { returns } },
          ctx,
        ),
      );
      expect(result.data.sharpeRatio).toBeTypeOf('number');
      expect(result.data.sortinoRatio).toBeTypeOf('number');
      expect(result.data.maxDrawdown).toBeTypeOf('number');
      expect(result.data.valueAtRisk).toBeTypeOf('number');
      expect(result.data.conditionalValueAtRisk).toBeTypeOf('number');
      expect(result.data.calmarRatio).toBeTypeOf('number');
      expect(result.data.winRate).toBeTypeOf('number');
      expect(result.data.profitFactor).toBeTypeOf('number');
    });

    test('accepts optional riskFreeRate and confidenceLevel', async () => {
      const returns = [0.01, -0.02, 0.03, -0.01, 0.02];
      const result = parse(
        await plugin.execute(
          { action: 'risk', inputs: { returns, riskFreeRate: 0.02, confidenceLevel: 0.99, periodsPerYear: 252 } },
          ctx,
        ),
      );
      expect(result.data.sharpeRatio).toBeTypeOf('number');
    });
  });

  describe('options action', () => {
    test('prices a call option with volatility', async () => {
      const result = parse(
        await plugin.execute(
          {
            action: 'options',
            inputs: {
              optionType: 'call',
              spot: 100,
              strike: 100,
              rate: 0.05,
              timeToExpiry: 1,
              volatility: 0.2,
            },
          },
          ctx,
        ),
      );
      expect(result.data.optionType).toBe('call');
      expect(result.data.price).toBeTypeOf('number');
      expect(result.data.price).toBeGreaterThan(0);
      expect(result.data.greeks.delta).toBeTypeOf('number');
      expect(result.data.greeks.gamma).toBeTypeOf('number');
      expect(result.data.greeks.theta).toBeTypeOf('number');
      expect(result.data.greeks.vega).toBeTypeOf('number');
      expect(result.data.greeks.rho).toBeTypeOf('number');
    });

    test('prices a put option', async () => {
      const result = parse(
        await plugin.execute(
          {
            action: 'options',
            inputs: {
              optionType: 'put',
              spot: 100,
              strike: 110,
              rate: 0.05,
              timeToExpiry: 0.5,
              volatility: 0.3,
            },
          },
          ctx,
        ),
      );
      expect(result.data.optionType).toBe('put');
      expect(result.data.price).toBeGreaterThan(0);
    });

    test('calculates implied volatility from market price', async () => {
      const result = parse(
        await plugin.execute(
          {
            action: 'options',
            inputs: {
              optionType: 'call',
              spot: 100,
              strike: 100,
              rate: 0.05,
              timeToExpiry: 1,
              marketPrice: 10,
            },
          },
          ctx,
        ),
      );
      expect(result.data.impliedVolatility).toBeTypeOf('number');
      expect(result.data.impliedVolatility).toBeGreaterThan(0);
    });
  });

  describe('factor action', () => {
    test('runs Fama-French 3-factor regression', async () => {
      const n = 20;
      const assetReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.1);
      const marketExcessReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.08);
      const smbReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.04);
      const hmlReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.04);

      const result = parse(
        await plugin.execute(
          {
            action: 'factor',
            inputs: { assetReturns, marketExcessReturns, smbReturns, hmlReturns },
          },
          ctx,
        ),
      );
      expect(result.data.regression.alpha).toBeTypeOf('number');
      expect(result.data.regression.betaMarket).toBeTypeOf('number');
      expect(result.data.regression.betaSMB).toBeTypeOf('number');
      expect(result.data.regression.betaHML).toBeTypeOf('number');
      expect(result.data.regression.rSquared).toBeTypeOf('number');
      expect(result.data.factorExposure.market).toBeTypeOf('number');
      expect(result.data.factorExposure.size).toBeTypeOf('number');
      expect(result.data.factorExposure.value).toBeTypeOf('number');
    });
  });

  describe('portfolio action', () => {
    test('computes equal weight portfolio', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'portfolio', inputs: { method: 'equal_weight', assetCount: 4 } },
          ctx,
        ),
      );
      expect(result.data.method).toBe('equal_weight');
      expect(result.data.weights).toEqual([0.25, 0.25, 0.25, 0.25]);
    });

    test('computes min variance portfolio', async () => {
      const returnsMatrix = [
        [0.01, 0.02, -0.01, 0.03, 0.01],
        [-0.01, 0.01, 0.02, -0.02, 0.03],
        [0.02, -0.01, 0.01, 0.01, -0.01],
      ];
      const result = parse(
        await plugin.execute(
          { action: 'portfolio', inputs: { method: 'min_variance', returnsMatrix } },
          ctx,
        ),
      );
      expect(result.data.method).toBe('min_variance');
      expect(result.data.weights).toBeInstanceOf(Array);
      expect(result.data.weights.length).toBe(3);
      const sum = result.data.weights.reduce((a: number, b: number) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    test('computes risk parity portfolio', async () => {
      const returnsMatrix = [
        [0.01, 0.02, -0.01, 0.03, 0.01],
        [-0.01, 0.01, 0.02, -0.02, 0.03],
      ];
      const result = parse(
        await plugin.execute(
          { action: 'portfolio', inputs: { method: 'risk_parity', returnsMatrix } },
          ctx,
        ),
      );
      expect(result.data.method).toBe('risk_parity');
      expect(result.data.weights).toBeInstanceOf(Array);
    });
  });

  describe('correlation action', () => {
    test('computes correlation matrix between series', async () => {
      const series = [
        [1, 2, 3, 4, 5],
        [2, 4, 6, 8, 10],
        [5, 4, 3, 2, 1],
      ];
      const result = parse(
        await plugin.execute(
          { action: 'correlation', inputs: { series, labels: ['A', 'B', 'C'] } },
          ctx,
        ),
      );
      expect(result.data.correlationMatrix).toBeInstanceOf(Array);
      expect(result.data.correlationMatrix.length).toBe(3);
      expect(result.data.correlationMatrix[0][1]).toBeCloseTo(1, 5);
      expect(result.data.correlationMatrix[0][2]).toBeCloseTo(-1, 5);
      expect(result.data.labels).toEqual(['A', 'B', 'C']);
    });

    test('computes rolling correlation when window provided', async () => {
      const series = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
      ];
      const result = parse(
        await plugin.execute(
          { action: 'correlation', inputs: { series, rollingWindow: 3 } },
          ctx,
        ),
      );
      expect(result.data.correlationMatrix).toBeInstanceOf(Array);
      expect(result.data.rollingCorrelation).toBeInstanceOf(Array);
      expect(result.data.rollingCorrelation.length).toBe(10);
    });
  });

  describe('stats action', () => {
    test('computes descriptive statistics', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'stats', inputs: { operation: 'descriptive', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } },
          ctx,
        ),
      );
      expect(result.data.operation).toBe('descriptive');
      expect(result.data.stats.mean).toBeCloseTo(5.5, 5);
      expect(result.data.stats.median).toBeCloseTo(5.5, 5);
      expect(result.data.stats.min).toBe(1);
      expect(result.data.stats.max).toBe(10);
      expect(result.data.stats.standardDeviation).toBeTypeOf('number');
    });

    test('computes linear regression', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'stats', inputs: { operation: 'regression', x: [1, 2, 3, 4, 5], y: [2, 4, 6, 8, 10] } },
          ctx,
        ),
      );
      expect(result.data.operation).toBe('regression');
      expect(result.data.result.slope).toBeCloseTo(2, 5);
      expect(result.data.result.intercept).toBeCloseTo(0, 5);
      expect(result.data.result.rSquared).toBeCloseTo(1, 5);
    });

    test('computes rolling mean', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'stats', inputs: { operation: 'rolling_mean', values: [1, 2, 3, 4, 5], window: 3 } },
          ctx,
        ),
      );
      expect(result.data.operation).toBe('rolling_mean');
      expect(result.data.values).toBeInstanceOf(Array);
      expect(result.data.values.length).toBe(5);
    });

    test('computes rolling std', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'stats', inputs: { operation: 'rolling_std', values: [1, 2, 3, 4, 5], window: 3 } },
          ctx,
        ),
      );
      expect(result.data.operation).toBe('rolling_std');
      expect(result.data.values).toBeInstanceOf(Array);
    });
  });

  describe('error handling', () => {
    test('returns error for unknown action', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'unknown_action', inputs: {} },
          ctx,
        ),
      );
      expect(result.error).toBeTruthy();
    });

    test('returns error when indicators missing required fields', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'indicators', inputs: { indicator: 'atr', closes: [1, 2, 3] } },
          ctx,
        ),
      );
      expect(result.error).toBeTruthy();
    });

    test('returns error when risk has insufficient returns', async () => {
      const result = parse(
        await plugin.execute(
          { action: 'risk', inputs: { returns: [0.01] } },
          ctx,
        ),
      );
      expect(result.error).toBeTruthy();
    });

    test('returns error when options missing volatility and marketPrice', async () => {
      const result = parse(
        await plugin.execute(
          {
            action: 'options',
            inputs: { optionType: 'call', spot: 100, strike: 100, rate: 0.05, timeToExpiry: 1 },
          },
          ctx,
        ),
      );
      expect(result.error).toBeTruthy();
    });
  });
});
