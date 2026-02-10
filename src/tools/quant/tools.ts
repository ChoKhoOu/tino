import { DynamicStructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

// Import quant functions directly (avoid circular deps with index.ts)
import { sma, ema, rsi, macd, bollingerBands, atr, stochastic, obv, vwap } from './indicators.js';
import { sharpeRatio, sortinoRatio, maxDrawdown, valueAtRisk, conditionalValueAtRisk, calmarRatio, winRate, profitFactor } from './risk.js';
import { blackScholesCall, blackScholesPut, blackScholesGreeks, impliedVolatility } from './options.js';
import { famaFrenchThreeFactorRegression, factorExposure } from './factors.js';
import { equalWeightPortfolio, minVariancePortfolio, meanVarianceOptimization, riskParityPortfolio, portfolioReturn, portfolioVariance } from './portfolio.js';
import { regression, correlation, descriptiveStats, rollingMean, rollingStd, rollingCorrelation } from './stats.js';

// --- Sub-tool: calculate_indicators ---

const CalculateIndicatorsSchema = z.object({
  indicator: z.enum(['sma', 'ema', 'rsi', 'macd', 'bollinger', 'atr', 'stochastic', 'obv', 'vwap'])
    .describe('Technical indicator to calculate'),
  closes: z.array(z.number()).describe('Array of closing prices'),
  highs: z.array(z.number()).optional().describe('Array of high prices (required for atr, stochastic, vwap)'),
  lows: z.array(z.number()).optional().describe('Array of low prices (required for atr, stochastic, vwap)'),
  volumes: z.array(z.number()).optional().describe('Array of volume values (required for obv, vwap)'),
  period: z.number().int().positive().optional().describe('Lookback period (default varies by indicator)'),
  fast: z.number().int().positive().optional().describe('Fast period for MACD (default 12)'),
  slow: z.number().int().positive().optional().describe('Slow period for MACD (default 26)'),
  signal: z.number().int().positive().optional().describe('Signal period for MACD (default 9)'),
  kPeriod: z.number().int().positive().optional().describe('K period for Stochastic (default 14)'),
  dPeriod: z.number().int().positive().optional().describe('D period for Stochastic (default 3)'),
});

export const calculateIndicators = new DynamicStructuredTool({
  name: 'calculate_indicators',
  description: 'Calculate technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP) from price data.',
  schema: CalculateIndicatorsSchema,
  func: async (input) => {
    const { indicator, closes, highs, lows, volumes, period } = input;

    switch (indicator) {
      case 'sma':
        return formatToolResult({ indicator: 'sma', values: sma(closes, period ?? 14) });
      case 'ema':
        return formatToolResult({ indicator: 'ema', values: ema(closes, period ?? 14) });
      case 'rsi':
        return formatToolResult({ indicator: 'rsi', values: rsi(closes, period ?? 14) });
      case 'macd':
        return formatToolResult({ indicator: 'macd', ...macd(closes, input.fast ?? 12, input.slow ?? 26, input.signal ?? 9) });
      case 'bollinger':
        return formatToolResult({ indicator: 'bollinger', ...bollingerBands(closes, period ?? 20) });
      case 'atr': {
        if (!highs || !lows) throw new Error('highs and lows are required for ATR');
        return formatToolResult({ indicator: 'atr', values: atr(highs, lows, closes, period ?? 14) });
      }
      case 'stochastic': {
        if (!highs || !lows) throw new Error('highs and lows are required for Stochastic');
        return formatToolResult({ indicator: 'stochastic', ...stochastic(highs, lows, closes, input.kPeriod ?? 14, input.dPeriod ?? 3) });
      }
      case 'obv': {
        if (!volumes) throw new Error('volumes are required for OBV');
        return formatToolResult({ indicator: 'obv', values: obv(closes, volumes) });
      }
      case 'vwap': {
        if (!highs || !lows || !volumes) throw new Error('highs, lows, and volumes are required for VWAP');
        return formatToolResult({ indicator: 'vwap', values: vwap(highs, lows, closes, volumes) });
      }
      default:
        throw new Error(`Unknown indicator: ${indicator}`);
    }
  },
});

// --- Sub-tool: calculate_risk_metrics ---

const CalculateRiskMetricsSchema = z.object({
  returns: z.array(z.number()).describe('Array of periodic returns (e.g. daily returns as decimals like 0.01 for 1%)'),
  riskFreeRate: z.number().optional().describe('Annual risk-free rate (default 0)'),
  confidenceLevel: z.number().optional().describe('Confidence level for VaR/CVaR (default 0.95)'),
  periodsPerYear: z.number().int().positive().optional().describe('Trading periods per year for annualization (default 252)'),
});

export const calculateRiskMetrics = new DynamicStructuredTool({
  name: 'calculate_risk_metrics',
  description: 'Calculate risk metrics from a return series: Sharpe ratio, Sortino ratio, max drawdown, Value at Risk (VaR), Conditional VaR (CVaR), Calmar ratio, win rate, profit factor.',
  schema: CalculateRiskMetricsSchema,
  func: async (input) => {
    const { returns, riskFreeRate = 0, confidenceLevel = 0.95, periodsPerYear = 252 } = input;

    return formatToolResult({
      sharpeRatio: sharpeRatio(returns, riskFreeRate, periodsPerYear),
      sortinoRatio: sortinoRatio(returns, riskFreeRate, periodsPerYear),
      maxDrawdown: maxDrawdown(returns),
      valueAtRisk: valueAtRisk(returns, confidenceLevel),
      conditionalValueAtRisk: conditionalValueAtRisk(returns, confidenceLevel),
      calmarRatio: calmarRatio(returns, periodsPerYear),
      winRate: winRate(returns),
      profitFactor: profitFactor(returns),
    });
  },
});

// --- Sub-tool: price_option ---

const PriceOptionSchema = z.object({
  optionType: z.enum(['call', 'put']).describe('Option type'),
  spot: z.number().positive().describe('Current price of the underlying asset'),
  strike: z.number().positive().describe('Strike price'),
  rate: z.number().describe('Annual risk-free interest rate (e.g. 0.05 for 5%)'),
  timeToExpiry: z.number().positive().describe('Time to expiration in years (e.g. 0.5 for 6 months)'),
  volatility: z.number().positive().optional().describe('Annual volatility (e.g. 0.3 for 30%). If omitted and marketPrice is provided, implied volatility is calculated.'),
  dividendYield: z.number().optional().describe('Continuous dividend yield (default 0)'),
  marketPrice: z.number().positive().optional().describe('Market price of the option (used to calculate implied volatility when volatility is omitted)'),
});

export const priceOption = new DynamicStructuredTool({
  name: 'price_option',
  description: 'Price a European option using Black-Scholes model. Returns theoretical price, Greeks (delta, gamma, theta, vega, rho), and optionally implied volatility.',
  schema: PriceOptionSchema,
  func: async (input) => {
    const { optionType, spot, strike, rate, timeToExpiry, dividendYield } = input;
    let { volatility } = input;

    // Calculate implied volatility if market price provided but no volatility
    let impliedVol: number | undefined;
    if (!volatility && input.marketPrice) {
      impliedVol = impliedVolatility(input.marketPrice, { spot, strike, rate, timeToExpiry, dividendYield }, optionType);
      volatility = impliedVol;
    }

    if (!volatility) {
      throw new Error('Either volatility or marketPrice must be provided');
    }

    const params = { spot, strike, rate, timeToExpiry, volatility, dividendYield };
    const price = optionType === 'call' ? blackScholesCall(params) : blackScholesPut(params);
    const greeks = blackScholesGreeks(params, optionType);

    return formatToolResult({
      optionType,
      price,
      greeks,
      ...(impliedVol !== undefined ? { impliedVolatility: impliedVol } : {}),
      inputs: { spot, strike, rate, timeToExpiry, volatility, dividendYield: dividendYield ?? 0 },
    });
  },
});

// --- Sub-tool: run_factor_analysis ---

const RunFactorAnalysisSchema = z.object({
  assetReturns: z.array(z.number()).describe('Array of asset periodic returns'),
  marketExcessReturns: z.array(z.number()).describe('Array of market excess returns (market return minus risk-free rate)'),
  smbReturns: z.array(z.number()).describe('Array of SMB (Small Minus Big) factor returns'),
  hmlReturns: z.array(z.number()).describe('Array of HML (High Minus Low) factor returns'),
  riskFreeRate: z.union([z.number(), z.array(z.number())]).optional().describe('Risk-free rate: single number or array matching return length (default 0)'),
});

export const runFactorAnalysis = new DynamicStructuredTool({
  name: 'run_factor_analysis',
  description: 'Run Fama-French 3-factor regression analysis on an asset return series. Returns alpha, beta exposures (market, SMB, HML), R-squared, and residual standard error.',
  schema: RunFactorAnalysisSchema,
  func: async (input) => {
    const regression = famaFrenchThreeFactorRegression({
      assetReturns: input.assetReturns,
      marketExcessReturns: input.marketExcessReturns,
      smbReturns: input.smbReturns,
      hmlReturns: input.hmlReturns,
      riskFreeRate: input.riskFreeRate,
    });

    const exposure = factorExposure({
      assetReturns: input.assetReturns,
      marketExcessReturns: input.marketExcessReturns,
      smbReturns: input.smbReturns,
      hmlReturns: input.hmlReturns,
      riskFreeRate: input.riskFreeRate,
    });

    return formatToolResult({
      regression,
      factorExposure: exposure,
    });
  },
});

// --- Sub-tool: optimize_portfolio ---

const OptimizePortfolioSchema = z.object({
  method: z.enum(['mean_variance', 'min_variance', 'equal_weight', 'risk_parity'])
    .describe('Portfolio optimization method'),
  returnsMatrix: z.array(z.array(z.number())).optional()
    .describe('Matrix of asset returns: each inner array is one asset\'s return series (required for all methods except equal_weight)'),
  assetCount: z.number().int().positive().optional()
    .describe('Number of assets (only for equal_weight method)'),
  riskAversion: z.number().positive().optional()
    .describe('Risk aversion parameter for mean-variance optimization (default 3)'),
  enforceLongOnly: z.boolean().optional()
    .describe('Enforce long-only constraint — no short selling (default true)'),
});

export const optimizePortfolio = new DynamicStructuredTool({
  name: 'optimize_portfolio',
  description: 'Optimize portfolio weights using mean-variance (Markowitz), minimum variance, equal weight, or risk parity methods. Returns optimal weight allocation.',
  schema: OptimizePortfolioSchema,
  func: async (input) => {
    const { method, returnsMatrix, assetCount, riskAversion = 3, enforceLongOnly = true } = input;

    switch (method) {
      case 'equal_weight': {
        const count = assetCount ?? returnsMatrix?.length;
        if (!count) throw new Error('assetCount or returnsMatrix is required');
        return formatToolResult({
          method: 'equal_weight',
          weights: equalWeightPortfolio(count),
        });
      }
      case 'min_variance': {
        if (!returnsMatrix) throw new Error('returnsMatrix is required for min_variance');
        const weights = minVariancePortfolio(returnsMatrix, enforceLongOnly);
        return formatToolResult({
          method: 'min_variance',
          weights,
          portfolioReturn: portfolioReturn(weights, returnsMatrix.map((s) => s.reduce((a, b) => a + b, 0) / s.length)),
        });
      }
      case 'mean_variance': {
        if (!returnsMatrix) throw new Error('returnsMatrix is required for mean_variance');
        const weights = meanVarianceOptimization(returnsMatrix, riskAversion, enforceLongOnly);
        return formatToolResult({
          method: 'mean_variance',
          weights,
          riskAversion,
          portfolioReturn: portfolioReturn(weights, returnsMatrix.map((s) => s.reduce((a, b) => a + b, 0) / s.length)),
        });
      }
      case 'risk_parity': {
        if (!returnsMatrix) throw new Error('returnsMatrix is required for risk_parity');
        const weights = riskParityPortfolio(returnsMatrix);
        return formatToolResult({
          method: 'risk_parity',
          weights,
          portfolioReturn: portfolioReturn(weights, returnsMatrix.map((s) => s.reduce((a, b) => a + b, 0) / s.length)),
        });
      }
      default:
        throw new Error(`Unknown optimization method: ${method}`);
    }
  },
});

// --- Sub-tool: analyze_correlation ---

const AnalyzeCorrelationSchema = z.object({
  series: z.array(z.array(z.number())).describe('Array of numeric series to correlate (at least 2 series, each with at least 2 values)'),
  labels: z.array(z.string()).optional().describe('Optional labels for each series'),
  rollingWindow: z.number().int().positive().optional().describe('If provided, compute rolling correlation between first two series with this window'),
});

export const analyzeCorrelation = new DynamicStructuredTool({
  name: 'analyze_correlation',
  description: 'Compute correlation matrix between multiple numeric series, with optional rolling correlation for time-series analysis.',
  schema: AnalyzeCorrelationSchema,
  func: async (input) => {
    const { series, labels, rollingWindow } = input;

    if (series.length < 2) throw new Error('At least 2 series are required');

    // Build correlation matrix
    const n = series.length;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push(i === j ? 1.0 : correlation(series[i]!, series[j]!));
      }
      matrix.push(row);
    }

    const result: Record<string, unknown> = {
      correlationMatrix: matrix,
      labels: labels ?? series.map((_, i) => `series_${i}`),
    };

    // Optional rolling correlation between first two series
    if (rollingWindow && series.length >= 2) {
      result.rollingCorrelation = rollingCorrelation(series[0]!, series[1]!, rollingWindow);
    }

    return formatToolResult(result);
  },
});

// --- Sub-tool: calculate_statistics ---

const CalculateStatisticsSchema = z.object({
  operation: z.enum(['descriptive', 'regression', 'rolling_mean', 'rolling_std'])
    .describe('Statistical operation to perform'),
  values: z.array(z.number()).optional().describe('Data values (for descriptive stats, rolling_mean, rolling_std)'),
  x: z.array(z.number()).optional().describe('Independent variable for regression'),
  y: z.array(z.number()).optional().describe('Dependent variable for regression'),
  window: z.number().int().positive().optional().describe('Window size for rolling operations'),
});

export const calculateStatistics = new DynamicStructuredTool({
  name: 'calculate_statistics',
  description: 'Compute descriptive statistics (mean, median, std, skewness, kurtosis), linear regression, or rolling statistics.',
  schema: CalculateStatisticsSchema,
  func: async (input) => {
    const { operation, values, x, y, window } = input;

    switch (operation) {
      case 'descriptive': {
        if (!values) throw new Error('values is required for descriptive stats');
        return formatToolResult({ operation: 'descriptive', stats: descriptiveStats(values) });
      }
      case 'regression': {
        if (!x || !y) throw new Error('x and y are required for regression');
        return formatToolResult({ operation: 'regression', result: regression(x, y) });
      }
      case 'rolling_mean': {
        if (!values) throw new Error('values is required for rolling_mean');
        if (!window) throw new Error('window is required for rolling_mean');
        return formatToolResult({ operation: 'rolling_mean', values: rollingMean(values, window) });
      }
      case 'rolling_std': {
        if (!values) throw new Error('values is required for rolling_std');
        if (!window) throw new Error('window is required for rolling_std');
        return formatToolResult({ operation: 'rolling_std', values: rollingStd(values, window) });
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
});

// --- Exports ---

/** All quant sub-tools available for routing */
export const QUANT_TOOLS: StructuredToolInterface[] = [
  calculateIndicators,
  calculateRiskMetrics,
  priceOption,
  runFactorAnalysis,
  optimizePortfolio,
  analyzeCorrelation,
  calculateStatistics,
];

/** Map for quick tool lookup by name */
export const QUANT_TOOL_MAP = new Map(QUANT_TOOLS.map((t) => [t.name, t]));
