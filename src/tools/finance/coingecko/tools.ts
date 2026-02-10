/**
 * CoinGecko sub-tools for the financial_research meta-tool.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../../types.js';
import { getCoinPrice, getCoinMarketData, getCoinHistory, getTopCoins } from './index.js';

export const coinPrice = new DynamicStructuredTool({
  name: 'coingecko_price',
  description: 'Get current cryptocurrency price from CoinGecko.',
  schema: z.object({
    coinId: z.string().describe('CoinGecko coin ID (e.g. "bitcoin", "ethereum", "solana")'),
    vsCurrency: z.string().default('usd').describe('Target currency'),
  }),
  func: async ({ coinId, vsCurrency }) => {
    const data = await getCoinPrice(coinId, vsCurrency);
    return formatToolResult(data);
  },
});

export const coinMarketData = new DynamicStructuredTool({
  name: 'coingecko_market_data',
  description: 'Get detailed crypto market data from CoinGecko (market cap, volume, supply, price changes).',
  schema: z.object({
    coinId: z.string().describe('CoinGecko coin ID'),
  }),
  func: async ({ coinId }) => {
    const data = await getCoinMarketData(coinId);
    return formatToolResult(data);
  },
});

export const coinHistory = new DynamicStructuredTool({
  name: 'coingecko_history',
  description: 'Get historical crypto price data from CoinGecko for a date range.',
  schema: z.object({
    coinId: z.string().describe('CoinGecko coin ID'),
    from: z.number().describe('Start timestamp (Unix seconds)'),
    to: z.number().describe('End timestamp (Unix seconds)'),
  }),
  func: async ({ coinId, from, to }) => {
    const data = await getCoinHistory(coinId, from, to);
    return formatToolResult(data);
  },
});

export const topCoins = new DynamicStructuredTool({
  name: 'coingecko_top_coins',
  description: 'Get top cryptocurrencies ranked by market cap from CoinGecko.',
  schema: z.object({
    limit: z.number().default(20).describe('Number of coins to return'),
  }),
  func: async ({ limit }) => {
    const data = await getTopCoins(limit);
    return formatToolResult(data);
  },
});

/** All CoinGecko sub-tools */
export const COINGECKO_TOOLS = [coinPrice, coinMarketData, coinHistory, topCoins];
