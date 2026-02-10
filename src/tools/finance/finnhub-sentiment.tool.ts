import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getFinnhubSentiment } from './finnhub/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
});

export default defineToolPlugin({
  id: 'finnhub_sentiment',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get social media sentiment data for a stock from Finnhub.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFinnhubSentiment(input.ticker);
    return JSON.stringify({ data });
  },
});
