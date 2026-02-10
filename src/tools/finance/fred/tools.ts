/**
 * FRED sub-tools for the financial_research meta-tool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import { getFredSeries, searchFredSeries, getFredSeriesInfo } from './index.js';

export const fredSeries = new DynamicStructuredTool({
  name: 'fred_series',
  description: 'Get economic time series data from FRED (GDP, CPI, Fed Funds rate, Treasury yields, unemployment, etc.).',
  schema: z.object({
    seriesId: z.string().describe('FRED series ID (e.g. GDP, CPIAUCSL, FEDFUNDS, DGS10, UNRATE)'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  }),
  func: async ({ seriesId, startDate, endDate }) => {
    const data = await getFredSeries(seriesId, startDate, endDate);
    return formatToolResult(data);
  },
});

export const fredSearch = new DynamicStructuredTool({
  name: 'fred_search',
  description: 'Search for FRED economic data series by keyword. Use when you need to find the right series ID.',
  schema: z.object({
    query: z.string().describe('Search query (e.g. "consumer price index", "unemployment rate")'),
    limit: z.number().default(10).describe('Max results'),
  }),
  func: async ({ query, limit }) => {
    const data = await searchFredSeries(query, limit);
    return formatToolResult(data);
  },
});

export const fredSeriesInfo = new DynamicStructuredTool({
  name: 'fred_series_info',
  description: 'Get metadata about a FRED series (title, frequency, units, seasonal adjustment).',
  schema: z.object({
    seriesId: z.string().describe('FRED series ID'),
  }),
  func: async ({ seriesId }) => {
    const data = await getFredSeriesInfo(seriesId);
    return formatToolResult(data);
  },
});

/** All FRED sub-tools */
export const FRED_TOOLS = [fredSeries, fredSearch, fredSeriesInfo];
