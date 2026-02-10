import { z } from 'zod';
import { definePlugin } from '@/domain/tool-plugin.js';
import { sma, ema, rsi, macd, bollingerBands, atr, stochastic, obv, vwap } from './indicators.js';

const schema = z.object({
  indicator: z
    .enum(['sma', 'ema', 'rsi', 'macd', 'bollinger', 'atr', 'stochastic', 'obv', 'vwap'])
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

function compute(input: z.infer<typeof schema>): Record<string, unknown> {
  const { indicator, closes, highs, lows, volumes, period } = input;

  switch (indicator) {
    case 'sma':
      return { indicator: 'sma', values: sma(closes, period ?? 14) };
    case 'ema':
      return { indicator: 'ema', values: ema(closes, period ?? 14) };
    case 'rsi':
      return { indicator: 'rsi', values: rsi(closes, period ?? 14) };
    case 'macd':
      return { indicator: 'macd', ...macd(closes, input.fast ?? 12, input.slow ?? 26, input.signal ?? 9) };
    case 'bollinger':
      return { indicator: 'bollinger', ...bollingerBands(closes, period ?? 20) };
    case 'atr': {
      if (!highs || !lows) throw new Error('highs and lows are required for ATR');
      return { indicator: 'atr', values: atr(highs, lows, closes, period ?? 14) };
    }
    case 'stochastic': {
      if (!highs || !lows) throw new Error('highs and lows are required for Stochastic');
      return { indicator: 'stochastic', ...stochastic(highs, lows, closes, input.kPeriod ?? 14, input.dPeriod ?? 3) };
    }
    case 'obv': {
      if (!volumes) throw new Error('volumes are required for OBV');
      return { indicator: 'obv', values: obv(closes, volumes) };
    }
    case 'vwap': {
      if (!highs || !lows || !volumes) throw new Error('highs, lows, and volumes are required for VWAP');
      return { indicator: 'vwap', values: vwap(highs, lows, closes, volumes) };
    }
    default:
      throw new Error(`Unknown indicator: ${indicator}`);
  }
}

export default definePlugin({
  id: 'calculate_indicators',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Calculate technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, OBV, VWAP) from price data. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return JSON.stringify({ data: compute(input) });
  },
});
