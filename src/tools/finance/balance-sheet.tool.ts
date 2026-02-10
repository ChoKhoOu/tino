import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch balance sheets for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly', 'ttm']).describe(
    "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, 'ttm' for trailing twelve months.",
  ),
  limit: z.number().default(10).describe(
    'Maximum number of report periods to return (default: 10).',
  ),
  report_period_gte: z.string().optional().describe(
    'Filter for balance sheets with report periods on or after this date (YYYY-MM-DD).',
  ),
  report_period_lte: z.string().optional().describe(
    'Filter for balance sheets with report periods on or before this date (YYYY-MM-DD).',
  ),
});

export default definePlugin({
  id: 'get_balance_sheets',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Retrieves a company's balance sheets, providing a snapshot of its assets, liabilities, shareholders' equity, etc. at a specific point in time. Useful for assessing a company's financial position.",
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
    const { data, url } = await callApi('/financials/balance-sheets/', params);
    return JSON.stringify({ data: data.balance_sheets || {}, sourceUrls: [url] });
  },
});
