import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch aggregated prices for. For example, 'AAPL' for Apple.",
  ),
  interval: z.enum(['minute', 'day', 'week', 'month', 'year']).default('day').describe(
    "The time interval for price data. Defaults to 'day'.",
  ),
  interval_multiplier: z.number().default(1).describe(
    'Multiplier for the interval. Defaults to 1.',
  ),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Must be in past. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Must be today or in the past. Required.'),
});

export default defineToolPlugin({
  id: 'get_prices',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices, and volume.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const params = {
      ticker: input.ticker,
      interval: input.interval,
      interval_multiplier: input.interval_multiplier,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const endDate = new Date(input.end_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, url } = await callApi('/prices/', params, { cacheable: endDate < today });
    return JSON.stringify({ data: data.prices || [], sourceUrls: [url] });
  },
});
