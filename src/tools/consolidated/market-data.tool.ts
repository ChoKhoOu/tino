import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  action: z.enum([
    'prices',
    'bars',
    'snapshot',
    'options_chain',
    'ticker_details',
    'crypto_price',
    'crypto_market_data',
    'crypto_top_coins',
    'crypto_history',
  ]).describe('The market data action to perform'),
  symbol: z.string().optional().describe('Ticker symbol (e.g., AAPL, BTC)'),
  from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  timespan: z.string().optional().describe('Bar timespan (minute, hour, day, week, month)'),
  limit: z.number().optional().describe('Number of results to return'),
});

export default definePlugin({
  id: 'market_data',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieve real-time and historical market data including stock prices, OHLCV bars, options chains, and cryptocurrency data.',
  schema,
  execute: async (raw) => {
    const { action } = schema.parse(raw);
    return JSON.stringify({ error: `Not implemented: ${action}` });
  },
});
