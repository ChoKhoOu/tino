import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The crypto ticker symbol. Format: 'CRYPTO-USD' (e.g., 'BTC-USD') or 'CRYPTO-CRYPTO' (e.g., 'BTC-ETH').",
  ),
  interval: z.enum(['minute', 'day', 'week', 'month', 'year']).default('day').describe(
    "The time interval for price data. Defaults to 'day'.",
  ),
  interval_multiplier: z.number().default(1).describe(
    'Multiplier for the interval. Defaults to 1.',
  ),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Required.'),
});

export default defineToolPlugin({
  id: 'get_crypto_prices',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Retrieves historical price data for a cryptocurrency over a specified date range, including OHLC and volume. Ticker format: 'CRYPTO-USD' for USD prices or 'CRYPTO-CRYPTO' for cross-crypto prices.",
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
    const { data, url } = await callApi('/crypto/prices/', params, { cacheable: endDate < today });
    return JSON.stringify({ data: data.prices || [], sourceUrls: [url] });
  },
});
