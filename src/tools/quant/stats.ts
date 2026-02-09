import {
  linearRegression as ssLinearRegression,
  linearRegressionLine,
  max,
  mean,
  median,
  min,
  sampleCorrelation,
  sampleStandardDeviation,
  sampleVariance,
  sum,
} from 'simple-statistics';
import type { RegressionResult } from './types.js';

export interface DescriptiveStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  variance: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
}

function assertWindow(window: number): void {
  if (!Number.isInteger(window) || window <= 0) {
    throw new Error('window must be a positive integer');
  }
}

export function regression(x: number[], y: number[]): RegressionResult {
  if (x.length !== y.length) {
    throw new Error('x and y must have the same length');
  }
  if (x.length < 2) {
    throw new Error('x and y must contain at least 2 points');
  }

  const points = x.map((xValue, index) => [xValue, y[index]!] as [number, number]);
  const fit = ssLinearRegression(points);
  const fittedLine = linearRegressionLine(fit);

  const yMean = mean(y);
  const ssResidual = y.reduce((acc, yValue, index) => {
    const residual = yValue - fittedLine(x[index]!);
    return acc + residual * residual;
  }, 0);
  const ssTotal = y.reduce((acc, yValue) => {
    const centered = yValue - yMean;
    return acc + centered * centered;
  }, 0);

  return {
    intercept: fit.b,
    slope: fit.m,
    rSquared: ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal,
  };
}

export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length) {
    throw new Error('x and y must have the same length');
  }
  if (x.length < 2) {
    throw new Error('x and y must contain at least 2 points');
  }
  return sampleCorrelation(x, y);
}

export function descriptiveStats(values: number[]): DescriptiveStats {
  if (values.length < 2) {
    throw new Error('values must contain at least 2 points');
  }

  const valuesMean = mean(values);
  const valuesStd = sampleStandardDeviation(values);
  const centered = values.map((value) => value - valuesMean);

  const skewnessNumerator = sum(centered.map((value) => value ** 3)) / values.length;
  const kurtosisNumerator = sum(centered.map((value) => value ** 4)) / values.length;
  const skewness = valuesStd === 0 ? 0 : skewnessNumerator / valuesStd ** 3;
  const kurtosis = valuesStd === 0 ? 0 : kurtosisNumerator / valuesStd ** 4 - 3;

  return {
    mean: valuesMean,
    median: median(values),
    min: min(values),
    max: max(values),
    variance: sampleVariance(values),
    standardDeviation: valuesStd,
    skewness,
    kurtosis,
  };
}

function rollingApply(values: number[], window: number, fn: (slice: number[]) => number): number[] {
  assertWindow(window);
  if (values.length === 0) {
    return [];
  }

  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    return fn(values.slice(start, index + 1));
  });
}

export function rollingMean(values: number[], window: number): number[] {
  return rollingApply(values, window, mean);
}

export function rollingStd(values: number[], window: number): number[] {
  return rollingApply(values, window, (slice) => (slice.length > 1 ? sampleStandardDeviation(slice) : 0));
}

export function rollingCorrelation(x: number[], y: number[], window: number): number[] {
  if (x.length !== y.length) {
    throw new Error('x and y must have the same length');
  }
  assertWindow(window);

  return x.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const xSlice = x.slice(start, index + 1);
    const ySlice = y.slice(start, index + 1);
    return xSlice.length > 1 ? sampleCorrelation(xSlice, ySlice) : 0;
  });
}
