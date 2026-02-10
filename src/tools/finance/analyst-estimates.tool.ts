import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch analyst estimates for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly']).default('annual').describe(
    "The period for the estimates, either 'annual' or 'quarterly'.",
  ),
});

export default definePlugin({
  id: 'get_analyst_estimates',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves analyst estimates for a given company ticker, including metrics like estimated EPS. Useful for understanding consensus expectations, assessing future growth prospects, and performing valuation analysis.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/analyst-estimates/', {
      ticker: input.ticker,
      period: input.period,
    });
    return JSON.stringify({ data: data.analyst_estimates || [], sourceUrls: [url] });
  },
});
