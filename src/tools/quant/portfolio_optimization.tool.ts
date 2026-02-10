import { z } from 'zod';
import { defineToolPlugin } from '@/domain/tool-plugin.js';
import {
  equalWeightPortfolio,
  minVariancePortfolio,
  meanVarianceOptimization,
  riskParityPortfolio,
  portfolioReturn,
} from './portfolio.js';

const schema = z.object({
  method: z
    .enum(['mean_variance', 'min_variance', 'equal_weight', 'risk_parity'])
    .describe('Portfolio optimization method'),
  returnsMatrix: z
    .array(z.array(z.number()))
    .optional()
    .describe(
      "Matrix of asset returns: each inner array is one asset's return series (required for all methods except equal_weight)",
    ),
  assetCount: z.number().int().positive().optional().describe('Number of assets (only for equal_weight method)'),
  riskAversion: z
    .number()
    .positive()
    .optional()
    .describe('Risk aversion parameter for mean-variance optimization (default 3)'),
  enforceLongOnly: z
    .boolean()
    .optional()
    .describe('Enforce long-only constraint — no short selling (default true)'),
});

function meanReturn(series: number[]): number {
  return series.reduce((a, b) => a + b, 0) / series.length;
}

function compute(input: z.infer<typeof schema>): Record<string, unknown> {
  const { method, returnsMatrix, assetCount, riskAversion = 3, enforceLongOnly = true } = input;

  switch (method) {
    case 'equal_weight': {
      const count = assetCount ?? returnsMatrix?.length;
      if (!count) throw new Error('assetCount or returnsMatrix is required');
      return { method: 'equal_weight', weights: equalWeightPortfolio(count) };
    }
    case 'min_variance': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for min_variance');
      const weights = minVariancePortfolio(returnsMatrix, enforceLongOnly);
      return {
        method: 'min_variance',
        weights,
        portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)),
      };
    }
    case 'mean_variance': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for mean_variance');
      const weights = meanVarianceOptimization(returnsMatrix, riskAversion, enforceLongOnly);
      return {
        method: 'mean_variance',
        weights,
        riskAversion,
        portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)),
      };
    }
    case 'risk_parity': {
      if (!returnsMatrix) throw new Error('returnsMatrix is required for risk_parity');
      const weights = riskParityPortfolio(returnsMatrix);
      return {
        method: 'risk_parity',
        weights,
        portfolioReturn: portfolioReturn(weights, returnsMatrix.map(meanReturn)),
      };
    }
    default:
      throw new Error(`Unknown optimization method: ${method}`);
  }
}

export default defineToolPlugin({
  id: 'optimize_portfolio',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Optimize portfolio weights using mean-variance (Markowitz), minimum variance, equal weight, or risk parity methods. Returns optimal weight allocation. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return JSON.stringify({ data: compute(input) });
  },
});
