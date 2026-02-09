import { dot, inv, matrix, multiply, transpose } from 'mathjs';
import { mean, sampleStandardDeviation } from 'simple-statistics';
import type { PortfolioWeights } from './types.js';

function assertReturnsMatrix(returnsMatrix: number[][]): void {
  if (returnsMatrix.length === 0) {
    throw new Error('returnsMatrix must contain at least one asset');
  }
  const periods = returnsMatrix[0]?.length ?? 0;
  if (periods < 2) {
    throw new Error('each asset return series must contain at least 2 points');
  }
  if (!returnsMatrix.every((series) => series.length === periods)) {
    throw new Error('all asset return series must have the same length');
  }
}

function normalize(weights: number[]): number[] {
  const sum = weights.reduce((acc, value) => acc + value, 0);
  if (sum === 0) {
    return new Array<number>(weights.length).fill(1 / weights.length);
  }
  return weights.map((weight) => weight / sum);
}

function covariance(x: number[], y: number[]): number {
  const xMean = mean(x);
  const yMean = mean(y);
  const numerator = x.reduce((acc, xValue, index) => {
    return acc + (xValue - xMean) * (y[index]! - yMean);
  }, 0);
  return numerator / (x.length - 1);
}

function covarianceMatrix(returnsMatrix: number[][]): number[][] {
  return returnsMatrix.map((seriesI) => returnsMatrix.map((seriesJ) => covariance(seriesI, seriesJ)));
}

function meanReturns(returnsMatrix: number[][]): number[] {
  return returnsMatrix.map((series) => mean(series));
}

function minVarWeightsFromCov(cov: number[][]): number[] {
  const n = cov.length;
  const ones = new Array<number>(n).fill(1);
  const invCov = inv(matrix(cov));
  const invCovOnes = multiply(invCov, matrix(ones)).toArray() as number[];
  const denominator = dot(ones, invCovOnes) as number;
  return normalize(invCovOnes.map((value) => value / denominator));
}

function longOnly(weights: number[]): number[] {
  return normalize(weights.map((weight) => Math.max(0, weight)));
}

export function equalWeightPortfolio(assetCount: number): PortfolioWeights {
  if (!Number.isInteger(assetCount) || assetCount <= 0) {
    throw new Error('assetCount must be a positive integer');
  }
  return new Array<number>(assetCount).fill(1 / assetCount);
}

export function minVariancePortfolio(returnsMatrix: number[][], enforceLongOnly = true): PortfolioWeights {
  assertReturnsMatrix(returnsMatrix);
  const cov = covarianceMatrix(returnsMatrix);
  const weights = minVarWeightsFromCov(cov);
  return enforceLongOnly ? longOnly(weights) : weights;
}

export function meanVarianceOptimization(
  returnsMatrix: number[][],
  riskAversion = 3,
  enforceLongOnly = true,
): PortfolioWeights {
  assertReturnsMatrix(returnsMatrix);
  if (riskAversion <= 0) {
    throw new Error('riskAversion must be positive');
  }

  const cov = covarianceMatrix(returnsMatrix);
  const mu = meanReturns(returnsMatrix);
  const n = mu.length;
  const ones = new Array<number>(n).fill(1);

  const invCov = inv(matrix(cov));
  const aVec = multiply(invCov, matrix(mu)).toArray() as number[];
  const bVec = multiply(invCov, matrix(ones)).toArray() as number[];

  const oneA = dot(ones, aVec) as number;
  const oneB = dot(ones, bVec) as number;
  const gamma = (oneA - riskAversion) / oneB;

  const unconstrained = aVec.map((value, index) => (1 / riskAversion) * (value - gamma * bVec[index]!));
  const normalized = normalize(unconstrained);
  return enforceLongOnly ? longOnly(normalized) : normalized;
}

export function riskParityPortfolio(returnsMatrix: number[][]): PortfolioWeights {
  assertReturnsMatrix(returnsMatrix);
  const volatilities = returnsMatrix.map((series) => sampleStandardDeviation(series));
  const inverseVol = volatilities.map((volatility) => (volatility === 0 ? 0 : 1 / volatility));
  return normalize(inverseVol);
}

export function portfolioReturn(weights: number[], expectedReturns: number[]): number {
  if (weights.length !== expectedReturns.length) {
    throw new Error('weights and expectedReturns must have the same length');
  }
  return dot(weights, expectedReturns) as number;
}

export function portfolioVariance(weights: number[], covariance: number[][]): number {
  if (covariance.length !== weights.length || covariance.some((row) => row.length !== weights.length)) {
    throw new Error('covariance matrix dimensions must match weights length');
  }

  const w = matrix([weights]);
  const covM = matrix(covariance);
  const variance = multiply(multiply(w, covM), transpose(w)).toArray() as number[][];
  return variance[0]![0]!;
}
