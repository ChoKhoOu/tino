import { atr as libAtr, bb as libBb, ema as libEma, macd as libMacd, obv as libObv, rsi as libRsi, sma as libSma, stoch as libStoch, vwap as libVwap } from 'indicatorts';

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertSameLength(a: number[], b: number[], aName: string, bName: string): void {
  if (a.length !== b.length) {
    throw new Error(`${aName} and ${bName} must have the same length`);
  }
}

function assertOHLCVLengths(highs: number[], lows: number[], closes: number[], volumes?: number[]): void {
  assertSameLength(highs, lows, 'highs', 'lows');
  assertSameLength(highs, closes, 'highs', 'closes');
  if (volumes) {
    assertSameLength(highs, volumes, 'highs', 'volumes');
  }
}

export function sma(values: number[], period = 14): number[] {
  assertPositiveInteger(period, 'period');
  return libSma(values, { period });
}

export function ema(values: number[], period = 14): number[] {
  assertPositiveInteger(period, 'period');
  return libEma(values, { period });
}

export function rsi(values: number[], period = 14): number[] {
  assertPositiveInteger(period, 'period');
  return libRsi(values, { period });
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  assertPositiveInteger(fast, 'fast');
  assertPositiveInteger(slow, 'slow');
  assertPositiveInteger(signal, 'signal');

  const result = libMacd(values, { fast, slow, signal });
  const histogram = result.macdLine.map((value, index) => value - result.signalLine[index]!);
  return {
    macdLine: result.macdLine,
    signalLine: result.signalLine,
    histogram,
  };
}

export function bollingerBands(values: number[], period = 20): { upper: number[]; middle: number[]; lower: number[] } {
  assertPositiveInteger(period, 'period');
  return libBb(values, { period });
}

export function atr(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  assertPositiveInteger(period, 'period');
  assertOHLCVLengths(highs, lows, closes);
  return libAtr(highs, lows, closes, { period }).atrLine;
}

export function stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3,
): { k: number[]; d: number[] } {
  assertPositiveInteger(kPeriod, 'kPeriod');
  assertPositiveInteger(dPeriod, 'dPeriod');
  assertOHLCVLengths(highs, lows, closes);
  return libStoch(highs, lows, closes, { kPeriod, dPeriod });
}

export function obv(closes: number[], volumes: number[]): number[] {
  assertSameLength(closes, volumes, 'closes', 'volumes');
  return libObv(closes, volumes);
}

export function vwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  assertOHLCVLengths(highs, lows, closes, volumes);
  const typicalPrices = highs.map((high, index) => (high + lows[index]! + closes[index]!) / 3);
  return libVwap(typicalPrices, volumes);
}
