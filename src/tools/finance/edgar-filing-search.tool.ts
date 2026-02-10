import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { searchEdgarFilings } from './edgar/index.js';

const schema = z.object({
  query: z.string().describe('Search query (company name, topic, etc.)'),
  dateRange: z.string().optional().describe('Date range filter (e.g. "2023-01-01,2024-01-01")'),
  formTypes: z.string().optional().describe('Form type filter (e.g. "10-K,10-Q")'),
});

export default definePlugin({
  id: 'edgar_filing_search',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Search SEC EDGAR filings by keyword. Find 10-K, 10-Q, 8-K, and other SEC filings.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await searchEdgarFilings(input.query, input.dateRange, input.formTypes);
    return JSON.stringify({ data });
  },
});
