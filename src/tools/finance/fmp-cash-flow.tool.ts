import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpCashFlow } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  period: z.enum(['annual', 'quarterly']).default('annual'),
  limit: z.number().default(5),
});

export default definePlugin({
  id: 'fmp_cash_flow',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get cash flow statements from FMP (operating, investing, financing cash flows, free cash flow).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpCashFlow(input.ticker, input.period, input.limit);
    return JSON.stringify({ data });
  },
});
