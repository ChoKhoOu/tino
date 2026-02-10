import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { callApi } from './api.js';

const schema = z.object({
  ticker: z.string().describe(
    "The stock ticker symbol to fetch company facts for. For example, 'AAPL' for Apple.",
  ),
});

export default definePlugin({
  id: 'get_company_facts',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Retrieves company facts and metadata for a given ticker, including sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares, and website. Useful for getting an overview of a company's profile.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { data, url } = await callApi('/company/facts', { ticker: input.ticker });
    return JSON.stringify({ data: data.company_facts || {}, sourceUrls: [url] });
  },
});
