import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch insider trades for. For example, 'AAPL' for Apple.",
  ),
  limit: z.number().default(100).describe(
    'Maximum number of insider trades to return (default: 100, max: 1000).',
  ),
  filing_date_gte: z.string().optional().describe(
    'Filter for trades with filing date on or after this date (YYYY-MM-DD).',
  ),
  filing_date_lte: z.string().optional().describe(
    'Filter for trades with filing date on or before this date (YYYY-MM-DD).',
  ),
});

export default defineToolPlugin({
  id: 'get_insider_trades',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves insider trading transactions for a given company ticker. Insider trades include purchases and sales of company stock by executives, directors, and other insiders. Sourced from SEC Form 4 filings.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker.toUpperCase(),
      limit: input.limit,
      filing_date_gte: input.filing_date_gte,
      filing_date_lte: input.filing_date_lte,
    };
    const { data, url } = await callApi('/insider-trades/', params);
    return JSON.stringify({ data: data.insider_trades || [], sourceUrls: [url] });
  },
});
