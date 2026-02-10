import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import {
  searchEdgarFilings,
  getEdgarSubmissions,
  getEdgarCompanyFacts,
} from '../finance/edgar/index.js';

const schema = z.object({
  action: z.enum([
    'search',
    'submissions',
    'company_facts',
  ]).describe('The SEC filings action to perform'),
  query: z.string().optional().describe('Full-text search query for EDGAR filings'),
  ticker: z.string().optional().describe('Company CIK number for submissions or facts'),
  dateRange: z.string().optional().describe('Date range filter (e.g., 2023-01-01,2024-01-01)'),
  formType: z.string().optional().describe('SEC form type filter (e.g., 10-K, 10-Q, 8-K)'),
});

function fmt(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

export default definePlugin({
  id: 'filings',
  domain: 'finance',
  riskLevel: 'safe',
  description:
    'Search and retrieve SEC EDGAR filings including full-text search, company submissions history, and structured company facts.',
  schema,
  execute: async (raw) => {
    const { action, query, ticker, dateRange, formType } = schema.parse(raw);

    try {
      switch (action) {
        case 'search': {
          if (!query) return fmt({ error: 'query is required for search action' });
          const data = await searchEdgarFilings(query, dateRange, formType);
          return fmt({ data });
        }
        case 'submissions': {
          if (!ticker) return fmt({ error: 'ticker (CIK) is required for submissions action' });
          const data = await getEdgarSubmissions(ticker);
          return fmt({ data });
        }
        case 'company_facts': {
          if (!ticker) return fmt({ error: 'ticker (CIK) is required for company_facts action' });
          const data = await getEdgarCompanyFacts(ticker);
          return fmt({ data });
        }
        default:
          return fmt({ error: `Unknown action: ${action}` });
      }
    } catch (err) {
      return fmt({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});
