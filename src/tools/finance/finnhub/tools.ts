/**
 * Finnhub sub-tools for the financial_research meta-tool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import {
  getFinnhubNews,
  getFinnhubCompanyNews,
  getFinnhubSentiment,
  getFinnhubEarningsCalendar,
  getFinnhubInsiderTransactions,
} from './index.js';

export const finnhubMarketNews = new DynamicStructuredTool({
  name: 'finnhub_market_news',
  description: 'Get general market news from Finnhub. Categories: general, forex, crypto, merger.',
  schema: z.object({
    category: z.enum(['general', 'forex', 'crypto', 'merger']).default('general'),
  }),
  func: async ({ category }) => {
    const data = await getFinnhubNews(category);
    return formatToolResult(data);
  },
});

export const finnhubCompanyNews = new DynamicStructuredTool({
  name: 'finnhub_company_news',
  description: 'Get company-specific news from Finnhub for a date range.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    from: z.string().describe('Start date (YYYY-MM-DD)'),
    to: z.string().describe('End date (YYYY-MM-DD)'),
  }),
  func: async ({ ticker, from, to }) => {
    const data = await getFinnhubCompanyNews(ticker, from, to);
    return formatToolResult(data);
  },
});

export const finnhubSentiment = new DynamicStructuredTool({
  name: 'finnhub_sentiment',
  description: 'Get social media sentiment data for a stock from Finnhub.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ ticker }) => {
    const data = await getFinnhubSentiment(ticker);
    return formatToolResult(data);
  },
});

export const finnhubEarningsCalendar = new DynamicStructuredTool({
  name: 'finnhub_earnings_calendar',
  description: 'Get upcoming earnings calendar events from Finnhub.',
  schema: z.object({
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  }),
  func: async ({ from, to }) => {
    const data = await getFinnhubEarningsCalendar(from, to);
    return formatToolResult(data);
  },
});

export const finnhubInsiderTransactions = new DynamicStructuredTool({
  name: 'finnhub_insider_transactions',
  description: 'Get insider transactions for a stock from Finnhub.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ ticker }) => {
    const data = await getFinnhubInsiderTransactions(ticker);
    return formatToolResult(data);
  },
});

/** All Finnhub sub-tools */
export const FINNHUB_TOOLS = [
  finnhubMarketNews,
  finnhubCompanyNews,
  finnhubSentiment,
  finnhubEarningsCalendar,
  finnhubInsiderTransactions,
];
