import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { routeFundingRateArbitrage } from './funding-rate-arbitrage-router.js';
import { FUNDING_RATE_ARBITRAGE_DESCRIPTION } from '../descriptions/funding-rate-arbitrage.js';

const schema = z.object({
  action: z.enum([
    'scan_rates',
    'find_opportunities',
    'backtest',
    'analyze',
  ]).describe('The funding rate arbitrage action to perform'),
  symbols: z.array(z.string()).optional().describe('Coin symbols to scan (e.g., ["BTC", "ETH"]). Defaults to top-10 majors.'),
  symbol: z.string().optional().describe('Single coin symbol for backtest/analyze (e.g., "BTC")'),
  exchange_long: z.string().optional().describe('Exchange to go long on (e.g., "Binance", "OKX", "Bybit")'),
  exchange_short: z.string().optional().describe('Exchange to go short on (e.g., "Binance", "OKX", "Bybit")'),
  top_n: z.number().optional().describe('Number of top opportunities to return (default 10)'),
  days: z.number().optional().describe('Number of days for backtest lookback (default 30)'),
});

export type FundingRateArbitrageInput = z.infer<typeof schema>;

export default definePlugin({
  id: 'funding_rate_arbitrage',
  domain: 'finance',
  riskLevel: 'safe',
  description: FUNDING_RATE_ARBITRAGE_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return routeFundingRateArbitrage(input);
  },
});
