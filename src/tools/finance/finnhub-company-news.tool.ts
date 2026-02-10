import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getFinnhubCompanyNews } from './finnhub/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  from: z.string().describe('Start date (YYYY-MM-DD)'),
  to: z.string().describe('End date (YYYY-MM-DD)'),
});

export default defineToolPlugin({
  id: 'finnhub_company_news',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get company-specific news from Finnhub for a date range.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFinnhubCompanyNews(input.ticker, input.from, input.to);
    return JSON.stringify({ data });
  },
});
