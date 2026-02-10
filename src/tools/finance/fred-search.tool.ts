import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { searchFredSeries } from './fred/index.js';

const schema = z.object({
  query: z.string().describe('Search query (e.g. "consumer price index", "unemployment rate")'),
  limit: z.number().default(10).describe('Max results'),
});

export default definePlugin({
  id: 'fred_search',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Search for FRED economic data series by keyword. Use when you need to find the right series ID.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await searchFredSeries(input.query, input.limit);
    return JSON.stringify({ data });
  },
});
