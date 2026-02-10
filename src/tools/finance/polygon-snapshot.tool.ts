import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getPolygonSnapshot } from './polygon/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
});

export default definePlugin({
  id: 'polygon_snapshot',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get real-time market snapshot from Polygon.io (current day + previous day bars).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getPolygonSnapshot(input.ticker);
    return JSON.stringify({ data });
  },
});
