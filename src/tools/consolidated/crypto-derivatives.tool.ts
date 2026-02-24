import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { routeCryptoDerivatives } from './crypto-derivatives-router.js';
import { CRYPTO_DERIVATIVES_DESCRIPTION } from '../descriptions/crypto-derivatives.js';

const schema = z.object({
  action: z.enum([
    'funding_rates',
    'funding_rate_history',
    'open_interest',
    'open_interest_history',
    'long_short_ratio',
    'liquidations',
    'liquidation_history',
    'futures_premium',
  ]).describe('The crypto derivatives data action to perform'),
  symbol: z.string().optional().describe('Coin symbol (BTC, ETH) or trading pair (BTCUSDT) depending on action'),
  exchange: z.string().optional().describe('Exchange name (e.g., Binance, OKX, Bybit)'),
  interval: z.string().optional().describe('Time interval (1h, 4h, 12h, 1d, 1w)'),
  limit: z.number().optional().describe('Number of results to return'),
  range: z.string().optional().describe('Time range for liquidations (1h, 4h, 12h, 24h)'),
});

export type CryptoDerivativesInput = z.infer<typeof schema>;

export default definePlugin({
  id: 'crypto_derivatives',
  domain: 'finance',
  riskLevel: 'safe',
  description: CRYPTO_DERIVATIVES_DESCRIPTION,
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return routeCryptoDerivatives(input);
  },
});
