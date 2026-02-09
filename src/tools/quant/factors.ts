import { inv, matrix, multiply, transpose } from 'mathjs';
import { mean, sampleStandardDeviation } from 'simple-statistics';
import type { FamaFrenchThreeFactorResult } from './types.js';

export interface FamaFrenchInputs {
  assetReturns: number[];
  marketExcessReturns: number[];
  smbReturns: number[];
  hmlReturns: number[];
  riskFreeRate?: number[] | number;
}

function toRiskFreeSeries(riskFreeRate: number[] | number | undefined, length: number): number[] {
  if (riskFreeRate === undefined) {
    return new Array<number>(length).fill(0);
  }
  if (typeof riskFreeRate === 'number') {
    return new Array<number>(length).fill(riskFreeRate);
  }
  if (riskFreeRate.length !== length) {
    throw new Error('riskFreeRate length must match return series length');
  }
  return riskFreeRate;
}

function assertSeriesLengths(inputs: FamaFrenchInputs): void {
  const n = inputs.assetReturns.length;
  if (n < 4) {
    throw new Error('at least 4 observations are required');
  }
  if (
    inputs.marketExcessReturns.length !== n ||
    inputs.smbReturns.length !== n ||
    inputs.hmlReturns.length !== n
  ) {
    throw new Error('all factor arrays must have the same length');
  }
}

export function famaFrenchThreeFactorRegression(inputs: FamaFrenchInputs): FamaFrenchThreeFactorResult {
  assertSeriesLengths(inputs);
  const n = inputs.assetReturns.length;
  const rf = toRiskFreeSeries(inputs.riskFreeRate, n);
  const y = inputs.assetReturns.map((value, index) => value - rf[index]!);

  const xRows = inputs.marketExcessReturns.map((market, index) => [
    1,
    market,
    inputs.smbReturns[index]!,
    inputs.hmlReturns[index]!,
  ]);

  const x = matrix(xRows);
  const yCol = matrix(y.map((value) => [value]));
  const xt = transpose(x);
  const betaMatrix = multiply(multiply(inv(multiply(xt, x)), xt), yCol);
  const betaArray = betaMatrix.toArray() as number[][];

  const alpha = betaArray[0]![0]!;
  const betaMarket = betaArray[1]![0]!;
  const betaSMB = betaArray[2]![0]!;
  const betaHML = betaArray[3]![0]!;

  const fitted = xRows.map(
    (row) => alpha + betaMarket * row[1]! + betaSMB * row[2]! + betaHML * row[3]!,
  );
  const residuals = y.map((actual, index) => actual - fitted[index]!);
  const yMean = mean(y);
  const ssRes = residuals.reduce((acc, value) => acc + value * value, 0);
  const ssTot = y.reduce((acc, value) => acc + (value - yMean) ** 2, 0);

  return {
    alpha,
    betaMarket,
    betaSMB,
    betaHML,
    rSquared: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    residualStdError: sampleStandardDeviation(residuals),
  };
}

export function factorExposure(inputs: FamaFrenchInputs): {
  market: number;
  size: number;
  value: number;
  alpha: number;
} {
  const result = famaFrenchThreeFactorRegression(inputs);
  return {
    market: result.betaMarket,
    size: result.betaSMB,
    value: result.betaHML,
    alpha: result.alpha,
  };
}
