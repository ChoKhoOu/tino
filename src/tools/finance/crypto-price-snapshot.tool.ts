import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The crypto ticker symbol to fetch the price snapshot for. Format: 'CRYPTO-USD' (e.g., 'BTC-USD') or 'CRYPTO-CRYPTO' (e.g., 'BTC-ETH').",
  ),
});

export default definePlugin({
  id: 'get_crypto_price_snapshot',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Fetches the most recent price snapshot for a specific cryptocurrency, including the latest price, trading volume, and OHLC data. Ticker format: 'CRYPTO-USD' for USD prices (e.g., 'BTC-USD') or 'CRYPTO-CRYPTO' for crypto-to-crypto prices.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/crypto/prices/snapshot/', { ticker: input.ticker });
    return JSON.stringify({ data: data.snapshot || {}, sourceUrls: [url] });
  },
});
