import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { routeQuantCompute } from './quant-compute-router.js';

const schema = z.object({
  action: z.enum([
    'indicators',
    'risk',
    'options',
    'factor',
    'portfolio',
    'correlation',
    'stats',
  ]).describe('The quantitative computation to perform'),
  inputs: z.record(z.string(), z.unknown()).describe('Input parameters specific to the chosen action'),
  config: z.record(z.string(), z.unknown()).optional().describe('Optional configuration overrides'),
});

export default definePlugin({
  id: 'quant_compute',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Perform quantitative computations including technical indicators, risk metrics, options pricing, factor analysis, and portfolio optimization.',
  schema,
  execute: async (raw) => {
    try {
      const { action, inputs } = schema.parse(raw);
      const data = routeQuantCompute(action, inputs);
      return JSON.stringify({ data });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});
