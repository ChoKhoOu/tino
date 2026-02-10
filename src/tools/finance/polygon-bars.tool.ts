import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getPolygonBars } from './polygon/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  timespan: z.enum(['minute', 'hour', 'day', 'week', 'month']).describe('Bar timespan'),
  from: z.string().describe('Start date (YYYY-MM-DD)'),
  to: z.string().describe('End date (YYYY-MM-DD)'),
  multiplier: z.number().default(1).describe('Timespan multiplier'),
});

export default definePlugin({
  id: 'polygon_bars',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get historical OHLCV price bars from Polygon.io. Supports minute, hour, day, week, month timespans.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getPolygonBars(input.ticker, input.timespan, input.from, input.to, input.multiplier);
    return JSON.stringify({ data });
  },
});
