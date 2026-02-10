import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpPrices } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  to: z.string().optional().describe('End date (YYYY-MM-DD)'),
});

export default definePlugin({
  id: 'fmp_prices',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get historical stock prices from FMP (daily OHLCV). Use for price history and chart data.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpPrices(input.ticker, input.from, input.to);
    return JSON.stringify({ data });
  },
});
