import { mean, quantileSorted, sampleStandardDeviation } from 'simple-statistics';

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function assertReturns(returns: number[]): void {
  if (returns.length < 2) {
    throw new Error('returns must contain at least 2 values');
  }
}

export function sharpeRatio(returns: number[], riskFreeRate = 0, periodsPerYear = 252): number {
  assertReturns(returns);
  const excessReturns = returns.map((value) => value - riskFreeRate / periodsPerYear);
  const std = sampleStandardDeviation(excessReturns);
  if (std === 0) {
    return 0;
  }
  return (mean(excessReturns) / std) * Math.sqrt(periodsPerYear);
}

export function sortinoRatio(returns: number[], riskFreeRate = 0, periodsPerYear = 252): number {
  assertReturns(returns);
  const threshold = riskFreeRate / periodsPerYear;
  const excess = returns.map((value) => value - threshold);
  const downside = excess.map((value) => Math.min(0, value));
  const downsideDeviation = Math.sqrt(downside.reduce((acc, value) => acc + value * value, 0) / downside.length);
  if (downsideDeviation === 0) {
    return 0;
  }
  return (mean(excess) / downsideDeviation) * Math.sqrt(periodsPerYear);
}

export function maxDrawdown(returns: number[]): number {
  assertReturns(returns);

  let wealth = 1;
  let peak = 1;
  let minDrawdown = 0;

  for (const periodReturn of returns) {
    wealth *= 1 + periodReturn;
    peak = Math.max(peak, wealth);
    const drawdown = wealth / peak - 1;
    minDrawdown = Math.min(minDrawdown, drawdown);
  }

  return Math.abs(minDrawdown);
}

export function valueAtRisk(returns: number[], confidenceLevel = 0.95): number {
  assertReturns(returns);
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error('confidenceLevel must be between 0 and 1');
  }

  const varThreshold = quantileSorted(sorted(returns), 1 - confidenceLevel);
  return Math.abs(varThreshold);
}

export function conditionalValueAtRisk(returns: number[], confidenceLevel = 0.95): number {
  assertReturns(returns);
  const sortedReturns = sorted(returns);
  const threshold = quantileSorted(sortedReturns, 1 - confidenceLevel);
  const tailLosses = sortedReturns.filter((value) => value <= threshold);

  if (tailLosses.length === 0) {
    return 0;
  }

  return Math.abs(mean(tailLosses));
}

export function calmarRatio(returns: number[], periodsPerYear = 252): number {
  assertReturns(returns);
  const compounded = returns.reduce((acc, value) => acc * (1 + value), 1);
  const years = returns.length / periodsPerYear;
  const annualizedReturn = years > 0 ? compounded ** (1 / years) - 1 : 0;
  const drawdown = maxDrawdown(returns);
  if (drawdown === 0) {
    return 0;
  }
  return annualizedReturn / drawdown;
}

export function winRate(returns: number[]): number {
  assertReturns(returns);
  const wins = returns.filter((value) => value > 0).length;
  return wins / returns.length;
}

export function profitFactor(returns: number[]): number {
  assertReturns(returns);

  const grossProfit = returns.filter((value) => value > 0).reduce((acc, value) => acc + value, 0);
  const grossLoss = Math.abs(returns.filter((value) => value < 0).reduce((acc, value) => acc + value, 0));

  if (grossLoss === 0) {
    return Infinity;
  }
  return grossProfit / grossLoss;
}
