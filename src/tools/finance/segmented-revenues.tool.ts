import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch segmented revenues for. For example, 'AAPL' for Apple.",
  ),
  period: z.enum(['annual', 'quarterly']).describe(
    "The reporting period. 'annual' for yearly, 'quarterly' for quarterly.",
  ),
  limit: z.number().default(10).describe('The number of past periods to retrieve.'),
});

export default defineToolPlugin({
  id: 'get_segmented_revenues',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Provides a detailed breakdown of a company's revenue by operating segments, such as products, services, or geographic regions. Useful for analyzing the composition of a company's revenue.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/financials/segmented-revenues/', {
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
    });
    return JSON.stringify({ data: data.segmented_revenues || {}, sourceUrls: [url] });
  },
});
