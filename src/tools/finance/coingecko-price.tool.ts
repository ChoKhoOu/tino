import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getCoinPrice } from './coingecko/index.js';

const schema = z.object({
  coinId: z.string().describe('CoinGecko coin ID (e.g. "bitcoin", "ethereum", "solana")'),
  vsCurrency: z.string().default('usd').describe('Target currency'),
});

export default definePlugin({
  id: 'coingecko_price',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get current cryptocurrency price from CoinGecko.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getCoinPrice(input.coinId, input.vsCurrency);
    return JSON.stringify({ data });
  },
});
