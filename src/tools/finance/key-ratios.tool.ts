import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly', 'ttm']).default('ttm').describe(
    "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, 'ttm' for trailing twelve months.",
  ),
  limit: z.number().default(4).describe('The number of past financial statements to retrieve.'),
  report_period_gte: z.string().optional().describe(
    'Filter for key ratios with report periods on or after this date (YYYY-MM-DD).',
  ),
  report_period_lte: z.string().optional().describe(
    'Filter for key ratios with report periods on or before this date (YYYY-MM-DD).',
  ),
});

export default definePlugin({
  id: 'get_key_ratios',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves historical key ratios for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.',
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
    const { data, url } = await callApi('/financial-metrics/', params);
    return JSON.stringify({ data: data.financial_metrics || [], sourceUrls: [url] });
  },
});
