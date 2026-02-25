/**
 * Example Tino Plugin: Technical Indicators
 *
 * A strategy plugin that calculates common technical indicators
 * from price data. Useful as a building block for trading strategies.
 *
 * Usage:
 *   Copy this file (or the entire directory) to ~/.tino/plugins/
 *   Then start Tino and ask: "Calculate the RSI for AAPL using market_data prices"
 */
import { z } from 'zod';

const schema = z.object({
  action: z.enum([
    'rsi',
    'sma',
    'ema',
    'bollinger_bands',
  ]).describe('The technical indicator to calculate'),
  prices: z.array(z.number()).min(2).describe('Array of price values (oldest first)'),
  period: z.number().min(1).optional().describe('Calculation period (default varies by indicator)'),
});

const description = `
Calculate technical indicators from price arrays.

## When to Use

- Computing RSI, SMA, EMA, or Bollinger Bands from historical prices
- Building analysis pipelines that combine market_data with indicator calculations
- Evaluating trade signals based on technical analysis

## When NOT to Use

- Fetching price data (use market_data first, then pass prices here)
- Complex multi-indicator strategies (use strategy_lab)
- Backtesting (use backtest_history)

## Actions

| Action | Description | Default Period |
|--------|-------------|---------------|
| rsi | Relative Strength Index (0-100) | 14 |
| sma | Simple Moving Average | 20 |
| ema | Exponential Moving Average | 20 |
| bollinger_bands | Bollinger Bands (middle, upper, lower) | 20 |

## Usage Notes

- Prices array must be ordered oldest-first
- Minimum array length must be greater than the period
- RSI returns values 0-100 (>70 = overbought, <30 = oversold)
- Bollinger Bands use 2 standard deviations by default
`.trim();

function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j]!;
    }
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(prices: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i]!;
  }
  let ema = sum / period;
  result.push(ema);

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i]! - ema) * multiplier + ema;
    result.push(ema);
  }
  return result;
}

function calculateRSI(prices: number[], period: number): number[] {
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i]! - prices[i - 1]!);
  }

  const result: number[] = [];

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const change = changes[i]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  // Subsequent values using smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const smoothedRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + smoothedRS));
  }

  return result;
}

function calculateBollingerBands(
  prices: number[],
  period: number,
): { middle: number[]; upper: number[]; lower: number[] } {
  const middle = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < middle.length; i++) {
    const sliceStart = i;
    const sliceEnd = i + period;
    const slice = prices.slice(sliceStart, sliceEnd);
    const mean = middle[i]!;
    const variance = slice.reduce((sum, p) => sum + (p - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper.push(mean + 2 * stdDev);
    lower.push(mean - 2 * stdDev);
  }

  return { middle, upper, lower };
}

function roundArray(arr: number[], decimals = 4): number[] {
  const factor = 10 ** decimals;
  return arr.map((v) => Math.round(v * factor) / factor);
}

export default {
  id: 'technical_indicators',
  domain: 'finance',
  riskLevel: 'safe' as const,
  description,
  schema,
  execute: async (raw: unknown) => {
    const { action, prices, period } = schema.parse(raw);

    try {
      switch (action) {
        case 'rsi': {
          const p = period ?? 14;
          if (prices.length < p + 1) {
            return JSON.stringify({ error: `RSI requires at least ${p + 1} prices, got ${prices.length}` });
          }
          const values = calculateRSI(prices, p);
          const latest = values[values.length - 1]!;
          return JSON.stringify({
            indicator: 'RSI',
            period: p,
            values: roundArray(values),
            latest: Math.round(latest * 100) / 100,
            signal: latest > 70 ? 'overbought' : latest < 30 ? 'oversold' : 'neutral',
          });
        }

        case 'sma': {
          const p = period ?? 20;
          if (prices.length < p) {
            return JSON.stringify({ error: `SMA requires at least ${p} prices, got ${prices.length}` });
          }
          const values = calculateSMA(prices, p);
          return JSON.stringify({
            indicator: 'SMA',
            period: p,
            values: roundArray(values),
            latest: Math.round(values[values.length - 1]! * 10000) / 10000,
          });
        }

        case 'ema': {
          const p = period ?? 20;
          if (prices.length < p) {
            return JSON.stringify({ error: `EMA requires at least ${p} prices, got ${prices.length}` });
          }
          const values = calculateEMA(prices, p);
          return JSON.stringify({
            indicator: 'EMA',
            period: p,
            values: roundArray(values),
            latest: Math.round(values[values.length - 1]! * 10000) / 10000,
          });
        }

        case 'bollinger_bands': {
          const p = period ?? 20;
          if (prices.length < p) {
            return JSON.stringify({ error: `Bollinger Bands requires at least ${p} prices, got ${prices.length}` });
          }
          const bands = calculateBollingerBands(prices, p);
          return JSON.stringify({
            indicator: 'Bollinger Bands',
            period: p,
            stdDev: 2,
            middle: roundArray(bands.middle),
            upper: roundArray(bands.upper),
            lower: roundArray(bands.lower),
            latest: {
              middle: Math.round(bands.middle[bands.middle.length - 1]! * 10000) / 10000,
              upper: Math.round(bands.upper[bands.upper.length - 1]! * 10000) / 10000,
              lower: Math.round(bands.lower[bands.lower.length - 1]! * 10000) / 10000,
            },
          });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};
