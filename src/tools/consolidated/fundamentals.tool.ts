import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  action: z.enum([
    'income_statement',
    'balance_sheet',
    'cash_flow',
    'ratios',
    'company_facts',
    'analyst_estimates',
    'insider_trades',
    'news',
    'all_financials',
    'deep_dive',
  ]).describe('The fundamentals action to perform'),
  symbol: z.string().optional().describe('Ticker symbol (e.g., AAPL)'),
  query: z.string().optional().describe('Search query for news or company lookup'),
  period: z.string().optional().describe('Reporting period (annual, quarterly)'),
  limit: z.number().optional().describe('Number of results to return'),
});

export default definePlugin({
  id: 'fundamentals',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Access company financial statements, ratios, analyst estimates, insider trades, news, and deep fundamental analysis.',
  schema,
  execute: async (raw) => {
    const { action } = schema.parse(raw);
    return JSON.stringify({ error: `Not implemented: ${action}` });
  },
});
