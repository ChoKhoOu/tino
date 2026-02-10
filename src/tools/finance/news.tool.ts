import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple.",
  ),
  start_date: z.string().optional().describe('The start date to fetch news from (YYYY-MM-DD).'),
  end_date: z.string().optional().describe('The end date to fetch news to (YYYY-MM-DD).'),
  limit: z.number().default(10).describe('The number of news articles to retrieve. Max is 100.'),
});

export default defineToolPlugin({
  id: 'get_news',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves recent news articles for a given company ticker, covering financial announcements, market trends, and other significant events. Useful for staying up-to-date with market-moving information and investor sentiment.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      limit: input.limit,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const { data, url } = await callApi('/news/', params);
    return JSON.stringify({ data: data.news || [], sourceUrls: [url] });
  },
});
