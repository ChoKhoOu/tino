import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({});

export default defineToolPlugin({
  id: 'get_available_crypto_tickers',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Retrieves the list of available cryptocurrency tickers that can be used with the crypto price tools.',
  schema,
  execute: async () => {
    const { data, url } = await callApi('/crypto/prices/tickers/', {});
    return JSON.stringify({ data: data.tickers || [], sourceUrls: [url] });
  },
});
