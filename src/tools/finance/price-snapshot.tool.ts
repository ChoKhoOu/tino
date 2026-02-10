import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple.",
  ),
});

export default defineToolPlugin({
  id: 'get_price_snapshot',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Fetches the most recent price snapshot for a specific stock ticker, including the latest price, trading volume, and other open, high, low, and close price data.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/prices/snapshot/', { ticker: input.ticker });
    return JSON.stringify({ data: data.snapshot || {}, sourceUrls: [url] });
  },
});
