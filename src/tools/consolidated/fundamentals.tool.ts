import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { routeFundamentals } from './fundamentals-router.js';
import { FUNDAMENTALS_DESCRIPTION } from '../descriptions/fundamentals.js';

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
  period: z.string().optional().describe('Reporting period (annual, quarterly)'),
  limit: z.number().optional().describe('Number of results to return'),
  start_date: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
  metric: z.string().optional().describe('Deep dive metric (dcf, earnings_transcripts, segmented_revenues, key_metrics, sentiment)'),
  year: z.number().optional().describe('Year for earnings transcripts'),
  quarter: z.number().optional().describe('Quarter (1-4) for earnings transcripts'),
});

export default definePlugin({
  id: 'fundamentals',
  domain: 'finance',
  riskLevel: 'safe',
  description: FUNDAMENTALS_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    try {
      return await routeFundamentals(input);
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});
