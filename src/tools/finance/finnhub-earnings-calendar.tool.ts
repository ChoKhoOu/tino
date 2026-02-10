import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getFinnhubEarningsCalendar } from './finnhub/index.js';

const schema = z.object({
  from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  to: z.string().optional().describe('End date (YYYY-MM-DD)'),
});

export default definePlugin({
  id: 'finnhub_earnings_calendar',
  domain: 'finance',
  riskLevel: 'safe',
  description: 'Get upcoming earnings calendar events from Finnhub.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getFinnhubEarningsCalendar(input.from, input.to);
    return JSON.stringify({ data });
  },
});
