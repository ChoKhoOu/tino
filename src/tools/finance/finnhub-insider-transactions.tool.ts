import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFinnhubInsiderTransactions } from './finnhub/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
});

export default definePlugin({
  id: 'finnhub_insider_transactions',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get insider transactions for a stock from Finnhub.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFinnhubInsiderTransactions(input.ticker);
    return JSON.stringify({ data });
  },
});
