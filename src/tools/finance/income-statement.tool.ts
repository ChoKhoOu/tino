import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch income statements for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly', 'ttm']).describe(
    "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, 'ttm' for trailing twelve months.",
  ),
  limit: z.number().default(10).describe(
    'Maximum number of report periods to return (default: 10).',
  ),
  report_period_gte: z.string().optional().describe(
    'Filter for statements with report periods on or after this date (YYYY-MM-DD).',
  ),
  report_period_lte: z.string().optional().describe(
    'Filter for statements with report periods on or before this date (YYYY-MM-DD).',
  ),
});

export default defineToolPlugin({
  id: 'get_income_statements',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Fetches a company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period. Useful for evaluating a company's profitability and operational efficiency.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
      report_period_gte: input.report_period_gte,
      report_period_lte: input.report_period_lte,
    };
    const { data, url } = await callApi('/financials/income-statements/', params);
    return JSON.stringify({ data: data.income_statements || {}, sourceUrls: [url] });
  },
});
