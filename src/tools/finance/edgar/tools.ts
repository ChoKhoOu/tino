/**
 * EDGAR sub-tools for the financial_research meta-tool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import { searchEdgarFilings, getEdgarCompanyFacts, getEdgarSubmissions } from './index.js';

export const edgarFilingSearch = new DynamicStructuredTool({
  name: 'edgar_filing_search',
  description: 'Search SEC EDGAR filings by keyword. Find 10-K, 10-Q, 8-K, and other SEC filings.',
  schema: z.object({
    query: z.string().describe('Search query (company name, topic, etc.)'),
    dateRange: z.string().optional().describe('Date range filter (e.g. "2023-01-01,2024-01-01")'),
    formTypes: z.string().optional().describe('Form type filter (e.g. "10-K,10-Q")'),
  }),
  func: async ({ query, dateRange, formTypes }) => {
    const data = await searchEdgarFilings(query, dateRange, formTypes);
    return formatToolResult(data);
  },
});

export const edgarCompanyFacts = new DynamicStructuredTool({
  name: 'edgar_company_facts',
  description: 'Get XBRL-structured financial data from EDGAR (all reported facts: revenue, net income, assets, etc.).',
  schema: z.object({
    cik: z.string().describe('SEC CIK number (e.g. "320193" for Apple)'),
  }),
  func: async ({ cik }) => {
    const data = await getEdgarCompanyFacts(cik);
    return formatToolResult(data);
  },
});

export const edgarSubmissions = new DynamicStructuredTool({
  name: 'edgar_submissions',
  description: 'Get a company\'s SEC filing submission history from EDGAR.',
  schema: z.object({
    cik: z.string().describe('SEC CIK number'),
  }),
  func: async ({ cik }) => {
    const data = await getEdgarSubmissions(cik);
    return formatToolResult(data);
  },
});

/** All EDGAR sub-tools */
export const EDGAR_TOOLS = [edgarFilingSearch, edgarCompanyFacts, edgarSubmissions];
