import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpBalanceSheet } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  period: z.enum(['annual', 'quarterly']).default('annual'),
  limit: z.number().default(5),
});

export default definePlugin({
  id: 'fmp_balance_sheet',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get balance sheets from FMP (assets, liabilities, equity, debt). Use for financial health analysis.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpBalanceSheet(input.ticker, input.period, input.limit);
    return JSON.stringify({ data });
  },
});
