import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpRatios } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  period: z.enum(['annual', 'quarterly']).default('annual'),
  limit: z.number().default(5),
});

export default definePlugin({
  id: 'fmp_ratios',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get financial ratios from FMP (profitability, liquidity, leverage, efficiency ratios).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpRatios(input.ticker, input.period, input.limit);
    return JSON.stringify({ data });
  },
});
