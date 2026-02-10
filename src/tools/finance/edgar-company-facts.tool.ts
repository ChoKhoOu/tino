import { z } from 'zod';
import { defineToolPlugin } from '@/domain/index.js';
import { getEdgarCompanyFacts } from './edgar/index.js';

const schema = z.object({
  cik: z.string().describe('SEC CIK number (e.g. "320193" for Apple)'),
});

export default defineToolPlugin({
  id: 'edgar_company_facts',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Get XBRL-structured financial data from EDGAR (all reported facts: revenue, net income, assets, etc.).',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const data = await getEdgarCompanyFacts(input.cik);
    return JSON.stringify({ data });
  },
});
