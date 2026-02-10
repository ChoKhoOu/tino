/**
 * Polygon.io sub-tools for the financial_research meta-tool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import { getPolygonBars, getPolygonTicker, getPolygonOptionsChain, getPolygonSnapshot } from './index.js';

export const polygonBars = new DynamicStructuredTool({
  name: 'polygon_bars',
  description: 'Get historical OHLCV price bars from Polygon.io. Supports minute, hour, day, week, month timespans.',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
    timespan: z.enum(['minute', 'hour', 'day', 'week', 'month']).describe('Bar timespan'),
    from: z.string().describe('Start date (YYYY-MM-DD)'),
    to: z.string().describe('End date (YYYY-MM-DD)'),
    multiplier: z.number().default(1).describe('Timespan multiplier'),
  }),
  func: async ({ ticker, timespan, from, to, multiplier }) => {
    const data = await getPolygonBars(ticker, timespan, from, to, multiplier);
    return formatToolResult(data);
  },
});

export const polygonTicker = new DynamicStructuredTool({
  name: 'polygon_ticker_details',
  description: 'Get detailed ticker information from Polygon.io (name, market cap, description, sector, industry).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ ticker }) => {
    const data = await getPolygonTicker(ticker);
    return formatToolResult(data);
  },
});

export const polygonOptionsChain = new DynamicStructuredTool({
  name: 'polygon_options_chain',
  description: 'Get options chain data from Polygon.io (available contracts, strikes, expirations).',
  schema: z.object({
    underlyingTicker: z.string().describe('Underlying stock ticker'),
    expirationDate: z.string().optional().describe('Filter by expiration date (YYYY-MM-DD)'),
  }),
  func: async ({ underlyingTicker, expirationDate }) => {
    const data = await getPolygonOptionsChain(underlyingTicker, expirationDate);
    return formatToolResult(data);
  },
});

export const polygonSnapshot = new DynamicStructuredTool({
  name: 'polygon_snapshot',
  description: 'Get real-time market snapshot from Polygon.io (current day + previous day bars).',
  schema: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  func: async ({ ticker }) => {
    const data = await getPolygonSnapshot(ticker);
    return formatToolResult(data);
  },
});

/** All Polygon sub-tools */
export const POLYGON_TOOLS = [polygonBars, polygonTicker, polygonOptionsChain, polygonSnapshot];
