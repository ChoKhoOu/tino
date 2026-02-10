import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpDcf } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
});

export default definePlugin({
  id: 'fmp_dcf',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get DCF (Discounted Cash Flow) valuation from FMP. Returns intrinsic value estimate.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpDcf(input.ticker);
    return JSON.stringify({ data });
  },
});
