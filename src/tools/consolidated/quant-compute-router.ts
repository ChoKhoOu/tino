import { sma, ema, rsi, macd, bollingerBands, atr, stochastic, obv, vwap } from '../quant/indicators.js';
import {
  sharpeRatio, sortinoRatio, maxDrawdown, valueAtRisk,
  conditionalValueAtRisk, calmarRatio, winRate, profitFactor,
} from '../quant/risk.js';
import { blackScholesCall, blackScholesPut, blackScholesGreeks, impliedVolatility } from '../quant/options.js';
import {
  equalWeightPortfolio, minVariancePortfolio, meanVarianceOptimization,
  riskParityPortfolio, portfolioReturn,
} from '../quant/portfolio.js';
import { correlation, rollingCorrelation, regression, descriptiveStats, rollingMean, rollingStd } from '../quant/stats.js';
import { mean } from 'simple-statistics';

type Inputs = Record<string, unknown>;

function computeIndicators(inputs: Inputs): Record<string, unknown> {
  const { indicator, closes, highs, lows, volumes, period } = inputs as {
    indicator: string; closes: number[]; highs?: number[]; lows?: number[];
    volumes?: number[]; period?: number; fast?: number; slow?: number;
    signal?: number; kPeriod?: number; dPeriod?: number;
  };

  switch (indicator) {
    case 'sma': return { indicator: 'sma', values: sma(closes, period ?? 14) };
    case 'ema': return { indicator: 'ema', values: ema(closes, period ?? 14) };
    case 'rsi': return { indicator: 'rsi', values: rsi(closes, period ?? 14) };
    case 'macd': return { indicator: 'macd', ...macd(closes, (inputs.fast as number) ?? 12, (inputs.slow as number) ?? 26, (inputs.signal as number) ?? 9) };
    case 'bollinger': return { indicator: 'bollinger', ...bollingerBands(closes, period ?? 20) };
    case 'atr': {
      if (!highs || !lows) throw new Error('highs and lows are required for ATR');
      return { indicator: 'atr', values: atr(highs, lows, closes, period ?? 14) };
    }
    case 'stochastic': {
      if (!highs || !lows) throw new Error('highs and lows are required for Stochastic');
      return { indicator: 'stochastic', ...stochastic(highs, lows, closes, (inputs.kPeriod as number) ?? 14, (inputs.dPeriod as number) ?? 3) };
    }
    case 'obv': {
      if (!volumes) throw new Error('volumes are required for OBV');
      return { indicator: 'obv', values: obv(closes, volumes) };
    }
    case 'vwap': {
      if (!highs || !lows || !volumes) throw new Error('highs, lows, and volumes are required for VWAP');
      return { indicator: 'vwap', values: vwap(highs, lows, closes, volumes) };
    }
    default: throw new Error(`Unknown indicator: ${indicator}`);
  }
}

function computeRisk(inputs: Inputs): Record<string, unknown> {
  const { returns, riskFreeRate = 0, confidenceLevel = 0.95, periodsPerYear = 252 } = inputs as {
    returns: number[]; riskFreeRate?: number; confidenceLevel?: number; periodsPerYear?: number;
  };
  return {
    sharpeRatio: sharpeRatio(returns, riskFreeRate, periodsPerYear),
    sortinoRatio: sortinoRatio(returns, riskFreeRate, periodsPerYear),
    maxDrawdown: maxDrawdown(returns),
    valueAtRisk: valueAtRisk(returns, confidenceLevel),
    conditionalValueAtRisk: conditionalValueAtRisk(returns, confidenceLevel),
    calmarRatio: calmarRatio(returns, periodsPerYear),
    winRate: winRate(returns),
    profitFactor: profitFactor(returns),
  };
}

function computeOptions(inputs: Inputs): Record<string, unknown> {
  const { optionType, spot, strike, rate, timeToExpiry, dividendYield, marketPrice } = inputs as {
    optionType: 'call' | 'put'; spot: number; strike: number; rate: number;
    timeToExpiry: number; volatility?: number; dividendYield?: number; marketPrice?: number;
  };
  let volatility = (inputs as { volatility?: number }).volatility;

  let impliedVol: number | undefined;
  if (!volatility && marketPrice) {
    impliedVol = impliedVolatility(marketPrice, { spot, strike, rate, timeToExpiry, dividendYield }, optionType);
    volatility = impliedVol;
  }
  if (!volatility) throw new Error('Either volatility or marketPrice must be provided');

  const params = { spot, strike, rate, timeToExpiry, volatility, dividendYield };
  const price = optionType === 'call' ? blackScholesCall(params) : blackScholesPut(params);
  const greeks = blackScholesGreeks(params, optionType);

  return {
    optionType, price, greeks,
    ...(impliedVol !== undefined ? { impliedVolatility: impliedVol } : {}),
    inputs: { spot, strike, rate, timeToExpiry, volatility, dividendYield: dividendYield ?? 0 },
  };
}

function computePortfolio(inputs: Inputs): Record<string, unknown> {
  const { method, returnsMatrix, assetCount, riskAversion = 3, enforceLongOnly = true } = inputs as {
    method: string; returnsMatrix?: number[][]; assetCount?: number;
    riskAversion?: number; enforceLongOnly?: boolean;
  };
  const meanReturn = (series: number[]) => mean(series);

  switch (method) {
    case 'equal_weight': {
      const count = assetCount ?? returnsMatrix?.length;
      if (!count) throw new Error('assetCount or returnsMatrix is required');
      return { method: 'equal_weight', weights: equalWeightPortfolio(count) };
    }
    case 'min_variance': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for min_variance');
      const weights = minVariancePortfolio(returnsMatrix, enforceLongOnly);
      return { method: 'min_variance', weights, portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)) };
    }
    case 'mean_variance': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for mean_variance');
      const weights = meanVarianceOptimization(returnsMatrix, riskAversion, enforceLongOnly);
      return { method: 'mean_variance', weights, riskAversion, portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)) };
    }
    case 'risk_parity': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for risk_parity');
      const weights = riskParityPortfolio(returnsMatrix);
      return { method: 'risk_parity', weights, portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)) };
    }
    default: throw new Error(`Unknown optimization method: ${method}`);
  }
}

function computeCorrelation(inputs: Inputs): Record<string, unknown> {
  const { series, labels, rollingWindow } = inputs as {
    series: number[][]; labels?: string[]; rollingWindow?: number;
  };
  if (series.length < 2) throw new Error('At least 2 series are required');

  const n = series.length;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(i === j ? 1.0 : correlation(series[i]!, series[j]!));
    }
    matrix.push(row);
  }

  const data: Record<string, unknown> = {
    correlationMatrix: matrix,
    labels: labels ?? series.map((_, i) => `series_${i}`),
  };

  if (rollingWindow && series.length >= 2) {
    data.rollingCorrelation = rollingCorrelation(series[0]!, series[1]!, rollingWindow);
  }
  return data;
}

function computeStats(inputs: Inputs): Record<string, unknown> {
  const { operation, values, x, y, window } = inputs as {
    operation: string; values?: number[]; x?: number[]; y?: number[]; window?: number;
  };

  switch (operation) {
    case 'descriptive': {
      if (!values) throw new Error('values is required for descriptive stats');
      return { operation: 'descriptive', stats: descriptiveStats(values) };
    }
    case 'regression': {
      if (!x || !y) throw new Error('x and y are required for regression');
      return { operation: 'regression', result: regression(x, y) };
    }
    case 'rolling_mean': {
      if (!values) throw new Error('values is required for rolling_mean');
      if (!window) throw new Error('window is required for rolling_mean');
      return { operation: 'rolling_mean', values: rollingMean(values, window) };
    }
    case 'rolling_std': {
      if (!values) throw new Error('values is required for rolling_std');
      if (!window) throw new Error('window is required for rolling_std');
      return { operation: 'rolling_std', values: rollingStd(values, window) };
    }
    default: throw new Error(`Unknown operation: ${operation}`);
  }
}

export function routeQuantCompute(action: string, inputs: Inputs): Record<string, unknown> {
  switch (action) {
    case 'indicators': return computeIndicators(inputs);
    case 'risk': return computeRisk(inputs);
    case 'options': return computeOptions(inputs);
    case 'portfolio': return computePortfolio(inputs);
    case 'correlation': return computeCorrelation(inputs);
    case 'stats': return computeStats(inputs);
    default: throw new Error(`Unknown action: ${action}`);
  }
}
