import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getEdgarSubmissions } from './edgar/index.js';

const schema = z.object({
  cik: z.string().describe('SEC CIK number'),
});

export default definePlugin({
  id: 'edgar_submissions',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    "Get a company's SEC filing submission history from EDGAR.",
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getEdgarSubmissions(input.cik);
    return JSON.stringify({ data });
  },
});
