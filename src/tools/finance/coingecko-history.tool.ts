import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getCoinHistory } from './coingecko/index.js';

const schema = z.object({
  coinId: z.string().describe('CoinGecko coin ID'),
  from: z.number().describe('Start timestamp (Unix seconds)'),
  to: z.number().describe('End timestamp (Unix seconds)'),
});

export default definePlugin({
  id: 'coingecko_history',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get historical crypto price data from CoinGecko for a date range.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getCoinHistory(input.coinId, input.from, input.to);
    return JSON.stringify({ data });
  },
});
