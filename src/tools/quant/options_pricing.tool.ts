import { z } from 'zod';
import { defineToolPlugin } from '@/domain/tool-plugin.js';
import { blackScholesCall, blackScholesPut, blackScholesGreeks, impliedVolatility } from './options.js';

const schema = z.object({
  optionType: z.enum(['call', 'put']).describe('Option type'),
  spot: z.number().positive().describe('Current price of the underlying asset'),
  strike: z.number().positive().describe('Strike price'),
  rate: z.number().describe('Annual risk-free interest rate (e.g. 0.05 for 5%)'),
  timeToExpiry: z.number().positive().describe('Time to expiration in years (e.g. 0.5 for 6 months)'),
  volatility: z
    .number()
    .positive()
    .optional()
    .describe(
      'Annual volatility (e.g. 0.3 for 30%). If omitted and marketPrice is provided, implied volatility is calculated.',
    ),
  dividendYield: z.number().optional().describe('Continuous dividend yield (default 0)'),
  marketPrice: z
    .number()
    .positive()
    .optional()
    .describe('Market price of the option (used to calculate implied volatility when volatility is omitted)'),
});

export default defineToolPlugin({
  id: 'price_option',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Price a European option using Black-Scholes model. Returns theoretical price, Greeks (delta, gamma, theta, vega, rho), and optionally implied volatility. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { optionType, spot, strike, rate, timeToExpiry, dividendYield } = input;
    let { volatility } = input;

    let impliedVol: number | undefined;
    if (!volatility && input.marketPrice) {
      impliedVol = impliedVolatility(
        input.marketPrice,
        { spot, strike, rate, timeToExpiry, dividendYield },
        optionType,
      );
      volatility = impliedVol;
    }

    if (!volatility) {
      throw new Error('Either volatility or marketPrice must be provided');
    }

    const params = { spot, strike, rate, timeToExpiry, volatility, dividendYield };
    const price = optionType === 'call' ? blackScholesCall(params) : blackScholesPut(params);
    const greeks = blackScholesGreeks(params, optionType);

    const data = {
      optionType,
      price,
      greeks,
      ...(impliedVol !== undefined ? { impliedVolatility: impliedVol } : {}),
      inputs: { spot, strike, rate, timeToExpiry, volatility, dividendYield: dividendYield ?? 0 },
    };

    return JSON.stringify({ data });
  },
});
