import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFinnhubNews } from './finnhub/index.js';

const schema = z.object({
  category: z.enum(['general', 'forex', 'crypto', 'merger']).default('general'),
});

export default definePlugin({
  id: 'finnhub_market_news',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get general market news from Finnhub. Categories: general, forex, crypto, merger.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFinnhubNews(input.category);
    return JSON.stringify({ data });
  },
});
