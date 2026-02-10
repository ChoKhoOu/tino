import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  action: z.enum([
    'search',
    'series',
    'series_info',
  ]).describe('The macroeconomic data action to perform'),
  query: z.string().optional().describe('Search query for FRED series'),
  seriesId: z.string().optional().describe('FRED series ID (e.g., GDP, UNRATE, CPIAUCSL)'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Number of results to return'),
});

export default definePlugin({
  id: 'macro_data',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Access FRED macroeconomic data including series search, historical observations, and series metadata.',
  schema,
  execute: async (raw) => {
    const { action } = schema.parse(raw);
    return JSON.stringify({ error: `Not implemented: ${action}` });
  },
});
