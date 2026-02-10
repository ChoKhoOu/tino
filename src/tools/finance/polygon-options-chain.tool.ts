import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getPolygonOptionsChain } from './polygon/index.js';

const schema = z.object({
  underlyingTicker: z.string().describe('Underlying stock ticker'),
  expirationDate: z.string().optional().describe('Filter by expiration date (YYYY-MM-DD)'),
});

export default definePlugin({
  id: 'polygon_options_chain',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get options chain data from Polygon.io (available contracts, strikes, expirations).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getPolygonOptionsChain(input.underlyingTicker, input.expirationDate);
    return JSON.stringify({ data });
  },
});
