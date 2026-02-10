import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getCoinMarketData } from './coingecko/index.js';

const schema = z.object({
  coinId: z.string().describe('CoinGecko coin ID'),
});

export default defineToolPlugin({
  id: 'coingecko_market_data',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get detailed crypto market data from CoinGecko (market cap, volume, supply, price changes).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getCoinMarketData(input.coinId);
    return JSON.stringify({ data });
  },
});
