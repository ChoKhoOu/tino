import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { routeMarketData } from './market-data-router.js';
import { MARKET_DATA_DESCRIPTION } from '../descriptions/market-data.js';

const schema = z.object({
  action: z.enum([
    'prices',
    'bars',
    'snapshot',
    'options_chain',
    'ticker_details',
    'crypto_price',
    'crypto_market_data',
    'crypto_top_coins',
    'crypto_history',
    'crypto_exchange_quote',
    'crypto_exchange_klines',
    'crypto_exchange_overview',
    'crypto_supported_exchanges',
    'funding_rates',
    'funding_rates_history',
  ]).describe('The market data action to perform'),
  symbol: z.string().optional().describe('Ticker symbol (e.g., AAPL, BTC)'),
  exchange: z.string().optional().describe('Crypto exchange name (e.g., binance, bybit, okx)'),
  from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  to: z.string().optional().describe('End date (YYYY-MM-DD)'),
  interval: z.string().optional().describe('Kline interval for crypto exchange data (e.g., 1m, 1h, 1d)'),
  timespan: z.string().optional().describe('Bar timespan (minute, hour, day, week, month)'),
  limit: z.number().optional().describe('Number of results to return'),
  multiplier: z.number().optional().describe('Timespan multiplier for bars (default 1)'),
  expiration_date: z.string().optional().describe('Options expiration date (YYYY-MM-DD)'),
  vs_currency: z.string().optional().describe('Target currency for crypto (default usd)'),
});

export type MarketDataInput = z.infer<typeof schema>;

export default definePlugin({
  id: 'market_data',
  domain: 'finance',
  riskLevel: 'safe',
  description: MARKET_DATA_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return routeMarketData(input);
  },
});
