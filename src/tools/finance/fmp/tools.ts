/**
 * FMP sub-tools for the financial_research meta-tool.
 * Each tool wraps an FMP API client function as a DynamicStructuredTool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import {
  getFmpIncomeStatement,
  getFmpBalanceSheet,
  getFmpCashFlow,
  getFmpKeyMetrics,
  getFmpRatios,
  getFmpDcf,
  getFmpPrices,
  getFmpInsiderTrades,
  getFmpEarningsTranscripts,
} from './index.js';

export const fmpIncomeStatement = new DynamicStructuredTool({
  name: 'fmp_income_statement',
  description: 'Get income statements from FMP (revenue, net income, EPS, margins). Use for profitability analysis.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol (e.g. AAPL)'),
    period: z.enum(['annual', 'quarterly']).default('annual').describe('Reporting period'),
    limit: z.number().default(5).describe('Number of periods to return'),
  }),
  func: async ({ ticker, period, limit }) => {
    const data = await getFmpIncomeStatement(ticker, period, limit);
    return formatToolResult(data);
  },
});

export const fmpBalanceSheet = new DynamicStructuredTool({
  name: 'fmp_balance_sheet',
  description: 'Get balance sheets from FMP (assets, liabilities, equity, debt). Use for financial health analysis.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    period: z.enum(['annual', 'quarterly']).default('annual'),
    limit: z.number().default(5),
  }),
  func: async ({ ticker, period, limit }) => {
    const data = await getFmpBalanceSheet(ticker, period, limit);
    return formatToolResult(data);
  },
});

export const fmpCashFlow = new DynamicStructuredTool({
  name: 'fmp_cash_flow',
  description: 'Get cash flow statements from FMP (operating, investing, financing cash flows, free cash flow).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    period: z.enum(['annual', 'quarterly']).default('annual'),
    limit: z.number().default(5),
  }),
  func: async ({ ticker, period, limit }) => {
    const data = await getFmpCashFlow(ticker, period, limit);
    return formatToolResult(data);
  },
});

export const fmpKeyMetrics = new DynamicStructuredTool({
  name: 'fmp_key_metrics',
  description: 'Get key financial metrics from FMP (P/E, P/B, EV/EBITDA, market cap, dividend yield, ROE, ROA).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    period: z.enum(['annual', 'quarterly']).default('annual'),
    limit: z.number().default(5),
  }),
  func: async ({ ticker, period, limit }) => {
    const data = await getFmpKeyMetrics(ticker, period, limit);
    return formatToolResult(data);
  },
});

export const fmpRatios = new DynamicStructuredTool({
  name: 'fmp_ratios',
  description: 'Get financial ratios from FMP (profitability, liquidity, leverage, efficiency ratios).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    period: z.enum(['annual', 'quarterly']).default('annual'),
    limit: z.number().default(5),
  }),
  func: async ({ ticker, period, limit }) => {
    const data = await getFmpRatios(ticker, period, limit);
    return formatToolResult(data);
  },
});

export const fmpDcf = new DynamicStructuredTool({
  name: 'fmp_dcf',
  description: 'Get DCF (Discounted Cash Flow) valuation from FMP. Returns intrinsic value estimate.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ ticker }) => {
    const data = await getFmpDcf(ticker);
    return formatToolResult(data);
  },
});

export const fmpPrices = new DynamicStructuredTool({
  name: 'fmp_prices',
  description: 'Get historical stock prices from FMP (daily OHLCV). Use for price history and chart data.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  }),
  func: async ({ ticker, from, to }) => {
    const data = await getFmpPrices(ticker, from, to);
    return formatToolResult(data);
  },
});

export const fmpInsiderTrades = new DynamicStructuredTool({
  name: 'fmp_insider_trades',
  description: 'Get insider trading activity from FMP (buys, sells by executives and directors).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    limit: z.number().default(50).describe('Number of trades to return'),
  }),
  func: async ({ ticker, limit }) => {
    const data = await getFmpInsiderTrades(ticker, limit);
    return formatToolResult(data);
  },
});

export const fmpEarningsTranscripts = new DynamicStructuredTool({
  name: 'fmp_earnings_transcripts',
  description: 'Get earnings call transcripts from FMP. Use for qualitative analysis of management commentary.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    year: z.number().describe('Year of the earnings call'),
    quarter: z.number().min(1).max(4).describe('Quarter (1-4)'),
  }),
  func: async ({ ticker, year, quarter }) => {
    const data = await getFmpEarningsTranscripts(ticker, year, quarter);
    return formatToolResult(data);
  },
});

/** All FMP sub-tools */
export const FMP_TOOLS = [
  fmpIncomeStatement,
  fmpBalanceSheet,
  fmpCashFlow,
  fmpKeyMetrics,
  fmpRatios,
  fmpDcf,
  fmpPrices,
  fmpInsiderTrades,
  fmpEarningsTranscripts,
];
