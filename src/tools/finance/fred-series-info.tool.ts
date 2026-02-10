import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getFredSeriesInfo } from './fred/index.js';

const schema = z.object({
  seriesId: z.string().describe('FRED series ID'),
});

export default defineToolPlugin({
  id: 'fred_series_info',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get metadata about a FRED series (title, frequency, units, seasonal adjustment).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFredSeriesInfo(input.seriesId);
    return JSON.stringify({ data });
  },
});
