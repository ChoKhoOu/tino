import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import {
  searchFredSeries,
  getFredSeries,
  getFredSeriesInfo,
} from '../finance/fred/index.js';
import { MACRO_DATA_DESCRIPTION } from '../descriptions/macro-data.js';

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
  description: MACRO_DATA_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const { action, query, seriesId, startDate, endDate, limit } = schema.parse(raw);

    try {
      switch (action) {
        case 'search': {
          if (!query) return JSON.stringify({ error: 'query is required for search action' });
          const data = await searchFredSeries(query, limit);
          return JSON.stringify({ data });
        }
        case 'series': {
          if (!seriesId) return JSON.stringify({ error: 'seriesId is required for series action' });
          const data = await getFredSeries(seriesId, startDate, endDate);
          return JSON.stringify({ data });
        }
        case 'series_info': {
          if (!seriesId) return JSON.stringify({ error: 'seriesId is required for series_info action' });
          const data = await getFredSeriesInfo(seriesId);
          return JSON.stringify({ data });
        }
        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});
