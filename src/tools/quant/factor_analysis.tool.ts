import { z } from 'zod';
import { definePlugin } from '@/domain/tool-plugin.js';
import { famaFrenchThreeFactorRegression, factorExposure } from './factors.js';

const schema = z.object({
  assetReturns: z.array(z.number()).describe('Array of asset periodic returns'),
  marketExcessReturns: z
    .array(z.number())
    .describe('Array of market excess returns (market return minus risk-free rate)'),
  smbReturns: z.array(z.number()).describe('Array of SMB (Small Minus Big) factor returns'),
  hmlReturns: z.array(z.number()).describe('Array of HML (High Minus Low) factor returns'),
  riskFreeRate: z
    .union([z.number(), z.array(z.number())])
    .optional()
    .describe('Risk-free rate: single number or array matching return length (default 0)'),
});

export default definePlugin({
  id: 'run_factor_analysis',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Run Fama-French 3-factor regression analysis on an asset return series. Returns alpha, beta exposures (market, SMB, HML), R-squared, and residual standard error. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);

    const regressionResult = famaFrenchThreeFactorRegression({
      assetReturns: input.assetReturns,
      marketExcessReturns: input.marketExcessReturns,
      smbReturns: input.smbReturns,
      hmlReturns: input.hmlReturns,
      riskFreeRate: input.riskFreeRate,
    });

    const exposure = factorExposure({
      assetReturns: input.assetReturns,
      marketExcessReturns: input.marketExcessReturns,
      smbReturns: input.smbReturns,
      hmlReturns: input.hmlReturns,
      riskFreeRate: input.riskFreeRate,
    });

    return JSON.stringify({ data: { regression: regressionResult, factorExposure: exposure } });
  },
});
