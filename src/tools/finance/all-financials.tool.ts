import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch all financial statements for. For example, 'AAPL' for Apple.",
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

export default definePlugin({
  id: 'get_all_financial_statements',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company in a single API call. More efficient than calling each statement type separately when you need all three for comprehensive financial analysis.',
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
    const { data, url } = await callApi('/financials/', params);
    return JSON.stringify({ data: data.financials || {}, sourceUrls: [url] });
  },
});
