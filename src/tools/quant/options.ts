import type { Greeks, OptionParams, OptionQuoteParams } from './types.js';

type OptionType = 'call' | 'put';

function assertOptionInputs(params: OptionQuoteParams & { volatility?: number }): void {
  if (params.spot <= 0 || params.strike <= 0 || params.timeToExpiry <= 0) {
    throw new Error('spot, strike, and timeToExpiry must be positive');
  }
  if (params.volatility !== undefined && params.volatility <= 0) {
    throw new Error('volatility must be positive');
  }
}

function standardNormalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function standardNormalCdf(x: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const polynomial =
    0.31938153 * k -
    0.356563782 * k ** 2 +
    1.781477937 * k ** 3 -
    1.821255978 * k ** 4 +
    1.330274429 * k ** 5;
  const cdf = 1 - standardNormalPdf(Math.abs(x)) * polynomial;
  return x >= 0 ? cdf : 1 - cdf;
}

function d1(params: OptionParams): number {
  const q = params.dividendYield ?? 0;
  return (
    (Math.log(params.spot / params.strike) + (params.rate - q + 0.5 * params.volatility ** 2) * params.timeToExpiry) /
    (params.volatility * Math.sqrt(params.timeToExpiry))
  );
}

function d2(params: OptionParams): number {
  return d1(params) - params.volatility * Math.sqrt(params.timeToExpiry);
}

function discountedSpot(params: OptionQuoteParams): number {
  const q = params.dividendYield ?? 0;
  return params.spot * Math.exp(-q * params.timeToExpiry);
}

function discountedStrike(params: OptionQuoteParams): number {
  return params.strike * Math.exp(-params.rate * params.timeToExpiry);
}

export function blackScholesCall(params: OptionParams): number {
  assertOptionInputs(params);
  const d1Value = d1(params);
  const d2Value = d2(params);

  return discountedSpot(params) * standardNormalCdf(d1Value) - discountedStrike(params) * standardNormalCdf(d2Value);
}

export function blackScholesPut(params: OptionParams): number {
  assertOptionInputs(params);
  const d1Value = d1(params);
  const d2Value = d2(params);

  return discountedStrike(params) * standardNormalCdf(-d2Value) - discountedSpot(params) * standardNormalCdf(-d1Value);
}

export function blackScholesGreeks(params: OptionParams, optionType: OptionType): Greeks {
  assertOptionInputs(params);

  const d1Value = d1(params);
  const d2Value = d2(params);
  const q = params.dividendYield ?? 0;
  const sqrtT = Math.sqrt(params.timeToExpiry);
  const discountQ = Math.exp(-q * params.timeToExpiry);
  const discountR = Math.exp(-params.rate * params.timeToExpiry);

  const gamma = (discountQ * standardNormalPdf(d1Value)) / (params.spot * params.volatility * sqrtT);
  const vega = params.spot * discountQ * standardNormalPdf(d1Value) * sqrtT;

  if (optionType === 'call') {
    return {
      delta: discountQ * standardNormalCdf(d1Value),
      gamma,
      theta:
        (-params.spot * discountQ * standardNormalPdf(d1Value) * params.volatility) / (2 * sqrtT) -
        params.rate * params.strike * discountR * standardNormalCdf(d2Value) +
        q * params.spot * discountQ * standardNormalCdf(d1Value),
      vega,
      rho: params.strike * params.timeToExpiry * discountR * standardNormalCdf(d2Value),
    };
  }

  return {
    delta: discountQ * (standardNormalCdf(d1Value) - 1),
    gamma,
    theta:
      (-params.spot * discountQ * standardNormalPdf(d1Value) * params.volatility) / (2 * sqrtT) +
      params.rate * params.strike * discountR * standardNormalCdf(-d2Value) -
      q * params.spot * discountQ * standardNormalCdf(-d1Value),
    vega,
    rho: -params.strike * params.timeToExpiry * discountR * standardNormalCdf(-d2Value),
  };
}

export function impliedVolatility(
  targetPrice: number,
  params: OptionQuoteParams,
  optionType: OptionType,
  tolerance = 1e-6,
  maxIterations = 200,
): number {
  assertOptionInputs(params);
  if (targetPrice <= 0) {
    throw new Error('targetPrice must be positive');
  }

  let low = 1e-4;
  let high = 5;

  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (low + high) / 2;
    const priceParams: OptionParams = { ...params, volatility: mid };
    const price = optionType === 'call' ? blackScholesCall(priceParams) : blackScholesPut(priceParams);
    const diff = price - targetPrice;

    if (Math.abs(diff) <= tolerance) {
      return mid;
    }

    if (diff > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}
