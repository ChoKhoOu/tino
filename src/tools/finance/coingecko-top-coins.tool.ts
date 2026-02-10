import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getTopCoins } from './coingecko/index.js';

const schema = z.object({
  limit: z.number().default(20).describe('Number of coins to return'),
});

export default definePlugin({
  id: 'coingecko_top_coins',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get top cryptocurrencies ranked by market cap from CoinGecko.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getTopCoins(input.limit);
    return JSON.stringify({ data });
  },
});
