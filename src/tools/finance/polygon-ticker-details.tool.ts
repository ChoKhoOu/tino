import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getPolygonTicker } from './polygon/index.js';

const schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
});

export default defineToolPlugin({
  id: 'polygon_ticker_details',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get detailed ticker information from Polygon.io (name, market cap, description, sector, industry).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getPolygonTicker(input.ticker);
    return JSON.stringify({ data });
  },
});
