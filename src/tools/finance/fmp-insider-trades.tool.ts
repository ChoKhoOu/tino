import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpInsiderTrades } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  limit: z.number().default(50).describe('Number of trades to return'),
});

export default definePlugin({
  id: 'fmp_insider_trades',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get insider trading activity from FMP (buys, sells by executives and directors).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpInsiderTrades(input.ticker, input.limit);
    return JSON.stringify({ data });
  },
});
