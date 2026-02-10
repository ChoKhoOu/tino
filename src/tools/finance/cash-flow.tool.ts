import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch cash flow statements for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly', 'ttm']).describe(
    "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, 'ttm' for trailing twelve months.",
  ),
  limit: z.number().default(10).describe(
    'Maximum number of report periods to return (default: 10).',
  ),
  report_period_gte: z.string().optional().describe(
    'Filter for cash flow statements with report periods on or after this date (YYYY-MM-DD).',
  ),
  report_period_lte: z.string().optional().describe(
    'Filter for cash flow statements with report periods on or before this date (YYYY-MM-DD).',
  ),
});

export default definePlugin({
  id: 'get_cash_flow_statements',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Retrieves a company's cash flow statements, showing how cash is generated and used across operating, investing, and financing activities. Useful for understanding a company's liquidity and solvency.",
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
    const { data, url } = await callApi('/financials/cash-flow-statements/', params);
    return JSON.stringify({ data: data.cash_flow_statements || {}, sourceUrls: [url] });
  },
});
