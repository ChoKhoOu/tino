import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getFredSeries } from './fred/index.js';

const schema = z.object({
  seriesId: z.string().describe('FRED series ID (e.g. GDP, CPIAUCSL, FEDFUNDS, DGS10, UNRATE)'),
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
});

export default defineToolPlugin({
  id: 'fred_series',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get economic time series data from FRED (GDP, CPI, Fed Funds rate, Treasury yields, unemployment, etc.).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFredSeries(input.seriesId, input.startDate, input.endDate);
    return JSON.stringify({ data });
  },
});
