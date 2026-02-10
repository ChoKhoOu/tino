import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch key ratios snapshot for. For example, 'AAPL' for Apple.",
  ),
});

export default defineToolPlugin({
  id: 'get_key_ratios_snapshot',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Fetches a snapshot of the most current key ratios for a company, including key indicators like market capitalization, P/E ratio, and dividend yield. Useful for a quick overview of a company's financial health.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/financial-metrics/snapshot/', { ticker: input.ticker });
    return JSON.stringify({ data: data.snapshot || {}, sourceUrls: [url] });
  },
});
