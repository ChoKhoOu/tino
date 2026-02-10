import { describe, expect, test } from 'bun:test';
import {
  calculateIndicators,
  calculateRiskMetrics,
  priceOption,
  runFactorAnalysis,
  optimizePortfolio,
  analyzeCorrelation,
  calculateStatistics,
  QUANT_TOOLS,
  QUANT_TOOL_MAP,
} from './tools.js';

// Test data
const closePrices = [44, 44.15, 43.9, 44.35, 44.8, 45.1, 44.7, 44.9, 45.2, 45.6, 45.9, 45.3, 45.7, 46.0, 45.8];
const highPrices = closePrices.map((c) => c + 0.5);
const lowPrices = closePrices.map((c) => c - 0.3);
const volumes = closePrices.map(() => Math.floor(Math.random() * 1000) + 100);
const dailyReturns = [0.01, -0.005, 0.008, -0.003, 0.012, -0.007, 0.004, 0.006, -0.002, 0.009, -0.004, 0.003, 0.007, -0.001, 0.005];

function parseResult(raw: string): unknown {
  const parsed = JSON.parse(raw);
  return parsed.data;
}

describe('quant sub-tools', () => {
  // --- calculate_indicators ---
  describe('calculate_indicators', () => {
    test('calculates SMA', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'sma', closes: closePrices, period: 5 });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('sma');
      expect(data.values.length).toBe(closePrices.length);
    });

    test('calculates EMA', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'ema', closes: closePrices, period: 5 });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('ema');
      expect(data.values.length).toBe(closePrices.length);
    });

    test('calculates RSI', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'rsi', closes: closePrices, period: 14 });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('rsi');
      expect(data.values.length).toBe(closePrices.length);
    });

    test('calculates MACD with custom parameters', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'macd', closes: closePrices, fast: 3, slow: 5, signal: 2 });
      const data = parseResult(result) as { indicator: string; macdLine: number[]; signalLine: number[]; histogram: number[] };
      expect(data.indicator).toBe('macd');
      expect(data.macdLine.length).toBe(closePrices.length);
      expect(data.signalLine.length).toBe(closePrices.length);
      expect(data.histogram.length).toBe(closePrices.length);
    });

    test('calculates Bollinger Bands', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'bollinger', closes: closePrices, period: 5 });
      const data = parseResult(result) as { indicator: string; upper: number[]; middle: number[]; lower: number[] };
      expect(data.indicator).toBe('bollinger');
      expect(data.upper.length).toBe(closePrices.length);
    });

    test('calculates ATR with highs/lows', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'atr', closes: closePrices, highs: highPrices, lows: lowPrices, period: 5 });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('atr');
      expect(data.values.length).toBe(closePrices.length);
    });

    test('throws when ATR missing highs/lows', async () => {
      expect(calculateIndicators.invoke({ indicator: 'atr', closes: closePrices })).rejects.toThrow('highs and lows are required');
    });

    test('calculates Stochastic', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'stochastic', closes: closePrices, highs: highPrices, lows: lowPrices, kPeriod: 5, dPeriod: 3 });
      const data = parseResult(result) as { indicator: string; k: number[]; d: number[] };
      expect(data.indicator).toBe('stochastic');
      expect(data.k.length).toBe(closePrices.length);
      expect(data.d.length).toBe(closePrices.length);
    });

    test('calculates OBV', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'obv', closes: closePrices, volumes });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('obv');
      expect(data.values.length).toBe(closePrices.length);
    });

    test('calculates VWAP', async () => {
      const result = await calculateIndicators.invoke({ indicator: 'vwap', closes: closePrices, highs: highPrices, lows: lowPrices, volumes });
      const data = parseResult(result) as { indicator: string; values: number[] };
      expect(data.indicator).toBe('vwap');
      expect(data.values.length).toBe(closePrices.length);
    });
  });

  // --- calculate_risk_metrics ---
  describe('calculate_risk_metrics', () => {
    test('computes all risk metrics', async () => {
      const result = await calculateRiskMetrics.invoke({ returns: dailyReturns });
      const data = parseResult(result) as Record<string, number>;
      expect(typeof data.sharpeRatio).toBe('number');
      expect(typeof data.sortinoRatio).toBe('number');
      expect(typeof data.maxDrawdown).toBe('number');
      expect(typeof data.valueAtRisk).toBe('number');
      expect(typeof data.conditionalValueAtRisk).toBe('number');
      expect(typeof data.calmarRatio).toBe('number');
      expect(typeof data.winRate).toBe('number');
      expect(typeof data.profitFactor).toBe('number');
      expect(data.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(data.winRate).toBeGreaterThan(0);
      expect(data.winRate).toBeLessThanOrEqual(1);
    });

    test('accepts custom risk-free rate and confidence level', async () => {
      const result = await calculateRiskMetrics.invoke({ returns: dailyReturns, riskFreeRate: 0.05, confidenceLevel: 0.99 });
      const data = parseResult(result) as Record<string, number>;
      expect(typeof data.sharpeRatio).toBe('number');
      expect(typeof data.valueAtRisk).toBe('number');
    });
  });

  // --- price_option ---
  describe('price_option', () => {
    test('prices a call option', async () => {
      const result = await priceOption.invoke({
        optionType: 'call',
        spot: 100,
        strike: 105,
        rate: 0.05,
        timeToExpiry: 0.5,
        volatility: 0.3,
      });
      const data = parseResult(result) as { optionType: string; price: number; greeks: Record<string, number>; inputs: Record<string, number> };
      expect(data.optionType).toBe('call');
      expect(data.price).toBeGreaterThan(0);
      expect(data.greeks.delta).toBeGreaterThan(0);
      expect(data.greeks.delta).toBeLessThan(1);
      expect(data.greeks.gamma).toBeGreaterThan(0);
      expect(typeof data.greeks.theta).toBe('number');
      expect(data.greeks.vega).toBeGreaterThan(0);
    });

    test('prices a put option', async () => {
      const result = await priceOption.invoke({
        optionType: 'put',
        spot: 100,
        strike: 95,
        rate: 0.05,
        timeToExpiry: 0.25,
        volatility: 0.2,
      });
      const data = parseResult(result) as { optionType: string; price: number; greeks: Record<string, number> };
      expect(data.optionType).toBe('put');
      expect(data.price).toBeGreaterThan(0);
      expect(data.greeks.delta).toBeLessThan(0);
    });

    test('calculates implied volatility from market price', async () => {
      const result = await priceOption.invoke({
        optionType: 'call',
        spot: 100,
        strike: 100,
        rate: 0.05,
        timeToExpiry: 1,
        marketPrice: 10,
      });
      const data = parseResult(result) as { impliedVolatility: number; price: number };
      expect(data.impliedVolatility).toBeGreaterThan(0);
      expect(Math.abs(data.price - 10)).toBeLessThan(0.01);
    });

    test('throws when neither volatility nor marketPrice provided', async () => {
      expect(
        priceOption.invoke({ optionType: 'call', spot: 100, strike: 100, rate: 0.05, timeToExpiry: 1 }),
      ).rejects.toThrow('Either volatility or marketPrice must be provided');
    });
  });

  // --- run_factor_analysis ---
  describe('run_factor_analysis', () => {
    test('runs Fama-French regression', async () => {
      const n = 20;
      const assetReturns = Array.from({ length: n }, () => (Math.random() - 0.48) * 0.02);
      const marketExcessReturns = Array.from({ length: n }, () => (Math.random() - 0.48) * 0.015);
      const smbReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.01);
      const hmlReturns = Array.from({ length: n }, () => (Math.random() - 0.5) * 0.008);

      const result = await runFactorAnalysis.invoke({
        assetReturns,
        marketExcessReturns,
        smbReturns,
        hmlReturns,
      });
      const data = parseResult(result) as { regression: Record<string, number>; factorExposure: Record<string, number> };
      expect(typeof data.regression.alpha).toBe('number');
      expect(typeof data.regression.betaMarket).toBe('number');
      expect(typeof data.regression.rSquared).toBe('number');
      expect(data.regression.rSquared).toBeGreaterThanOrEqual(0);
      expect(data.regression.rSquared).toBeLessThanOrEqual(1);
      expect(typeof data.factorExposure.market).toBe('number');
      expect(typeof data.factorExposure.size).toBe('number');
      expect(typeof data.factorExposure.value).toBe('number');
    });
  });

  // --- optimize_portfolio ---
  describe('optimize_portfolio', () => {
    const returnsMatrix = [
      [0.01, 0.02, -0.01, 0.015, 0.005],
      [-0.005, 0.01, 0.02, -0.01, 0.008],
      [0.008, -0.003, 0.01, 0.012, -0.002],
    ];

    test('equal weight', async () => {
      const result = await optimizePortfolio.invoke({ method: 'equal_weight', assetCount: 3 });
      const data = parseResult(result) as { method: string; weights: number[] };
      expect(data.method).toBe('equal_weight');
      expect(data.weights.length).toBe(3);
      const weightSum = data.weights.reduce((a, b) => a + b, 0);
      expect(Math.abs(weightSum - 1)).toBeLessThan(1e-10);
    });

    test('min variance', async () => {
      const result = await optimizePortfolio.invoke({ method: 'min_variance', returnsMatrix });
      const data = parseResult(result) as { method: string; weights: number[]; portfolioReturn: number };
      expect(data.method).toBe('min_variance');
      expect(data.weights.length).toBe(3);
      const weightSum = data.weights.reduce((a, b) => a + b, 0);
      expect(Math.abs(weightSum - 1)).toBeLessThan(1e-10);
      expect(typeof data.portfolioReturn).toBe('number');
    });

    test('mean variance', async () => {
      const result = await optimizePortfolio.invoke({ method: 'mean_variance', returnsMatrix, riskAversion: 5 });
      const data = parseResult(result) as { method: string; weights: number[]; riskAversion: number };
      expect(data.method).toBe('mean_variance');
      expect(data.weights.length).toBe(3);
      expect(data.riskAversion).toBe(5);
    });

    test('risk parity', async () => {
      const result = await optimizePortfolio.invoke({ method: 'risk_parity', returnsMatrix });
      const data = parseResult(result) as { method: string; weights: number[] };
      expect(data.method).toBe('risk_parity');
      expect(data.weights.length).toBe(3);
      const weightSum = data.weights.reduce((a, b) => a + b, 0);
      expect(Math.abs(weightSum - 1)).toBeLessThan(1e-10);
    });

    test('throws when returnsMatrix missing for non-equal-weight', async () => {
      expect(optimizePortfolio.invoke({ method: 'min_variance' })).rejects.toThrow('returnsMatrix is required');
    });
  });

  // --- analyze_correlation ---
  describe('analyze_correlation', () => {
    test('computes correlation matrix', async () => {
      const series = [
        [1, 2, 3, 4, 5],
        [2, 4, 6, 8, 10],
        [5, 4, 3, 2, 1],
      ];
      const result = await analyzeCorrelation.invoke({ series, labels: ['A', 'B', 'C'] });
      const data = parseResult(result) as { correlationMatrix: number[][]; labels: string[] };
      expect(data.correlationMatrix.length).toBe(3);
      expect(data.correlationMatrix[0]![0]).toBeCloseTo(1.0, 10);
      // A and B are perfectly correlated
      expect(data.correlationMatrix[0]![1]).toBeCloseTo(1.0, 10);
      // A and C are perfectly negatively correlated
      expect(data.correlationMatrix[0]![2]).toBeCloseTo(-1.0, 10);
      expect(data.labels).toEqual(['A', 'B', 'C']);
    });

    test('computes rolling correlation', async () => {
      const series = [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      ];
      const result = await analyzeCorrelation.invoke({ series, rollingWindow: 5 });
      const data = parseResult(result) as { rollingCorrelation: number[] };
      expect(data.rollingCorrelation.length).toBe(10);
    });

    test('throws with fewer than 2 series', async () => {
      expect(analyzeCorrelation.invoke({ series: [[1, 2, 3]] })).rejects.toThrow('At least 2 series are required');
    });
  });

  // --- calculate_statistics ---
  describe('calculate_statistics', () => {
    test('descriptive stats', async () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = await calculateStatistics.invoke({ operation: 'descriptive', values });
      const data = parseResult(result) as { operation: string; stats: Record<string, number> };
      expect(data.operation).toBe('descriptive');
      expect(data.stats.mean).toBeCloseTo(5.5, 10);
      expect(data.stats.median).toBe(5.5);
      expect(data.stats.min).toBe(1);
      expect(data.stats.max).toBe(10);
      expect(data.stats.variance).toBeGreaterThan(0);
      expect(typeof data.stats.skewness).toBe('number');
      expect(typeof data.stats.kurtosis).toBe('number');
    });

    test('linear regression', async () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2.1, 3.9, 6.1, 8.0, 9.9];
      const result = await calculateStatistics.invoke({ operation: 'regression', x, y });
      const data = parseResult(result) as { operation: string; result: { slope: number; intercept: number; rSquared: number } };
      expect(data.operation).toBe('regression');
      expect(data.result.slope).toBeCloseTo(2, 0);
      expect(data.result.rSquared).toBeGreaterThan(0.99);
    });

    test('rolling mean', async () => {
      const values = [1, 2, 3, 4, 5];
      const result = await calculateStatistics.invoke({ operation: 'rolling_mean', values, window: 3 });
      const data = parseResult(result) as { operation: string; values: number[] };
      expect(data.values.length).toBe(5);
    });

    test('rolling std', async () => {
      const values = [1, 2, 3, 4, 5];
      const result = await calculateStatistics.invoke({ operation: 'rolling_std', values, window: 3 });
      const data = parseResult(result) as { operation: string; values: number[] };
      expect(data.values.length).toBe(5);
    });

    test('throws when values missing', async () => {
      expect(calculateStatistics.invoke({ operation: 'descriptive' })).rejects.toThrow('values is required');
    });
  });
});

describe('quant tool registry', () => {
  test('QUANT_TOOLS contains all 7 sub-tools', () => {
    expect(QUANT_TOOLS.length).toBe(7);
    const names = QUANT_TOOLS.map((t) => t.name);
    expect(names).toContain('calculate_indicators');
    expect(names).toContain('calculate_risk_metrics');
    expect(names).toContain('price_option');
    expect(names).toContain('run_factor_analysis');
    expect(names).toContain('optimize_portfolio');
    expect(names).toContain('analyze_correlation');
    expect(names).toContain('calculate_statistics');
  });

  test('QUANT_TOOL_MAP has correct size', () => {
    expect(QUANT_TOOL_MAP.size).toBe(7);
  });

  test('all tools have descriptions', () => {
    for (const tool of QUANT_TOOLS) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});
