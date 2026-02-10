import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFmpIncomeStatement } from './fmp/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
  period: z.enum(['annual', 'quarterly']).default('annual').describe('Reporting period'),
  limit: z.number().default(5).describe('Number of periods to return'),
});

export default definePlugin({
  id: 'fmp_income_statement',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get income statements from FMP (revenue, net income, EPS, margins). Use for profitability analysis.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFmpIncomeStatement(input.ticker, input.period, input.limit);
    return JSON.stringify({ data });
  },
});
