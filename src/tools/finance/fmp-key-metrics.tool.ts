import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpKeyMetrics } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  period: z.enum(['annual', 'quarterly']).default('annual'),
  limit: z.number().default(5),
});

export default definePlugin({
  id: 'fmp_key_metrics',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get key financial metrics from FMP (P/E, P/B, EV/EBITDA, market cap, dividend yield, ROE, ROA).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpKeyMetrics(input.ticker, input.period, input.limit);
    return JSON.stringify({ data });
  },
});
