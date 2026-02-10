import { z } from 'zod';
import { defineToolPlugin } from '@/domain/tool-plugin.js';
import { regression, descriptiveStats, rollingMean, rollingStd } from './stats.js';

const schema = z.object({
  operation: z
    .enum(['descriptive', 'regression', 'rolling_mean', 'rolling_std'])
    .describe('Statistical operation to perform'),
  values: z
    .array(z.number())
    .optional()
    .describe('Data values (for descriptive stats, rolling_mean, rolling_std)'),
  x: z.array(z.number()).optional().describe('Independent variable for regression'),
  y: z.array(z.number()).optional().describe('Dependent variable for regression'),
  window: z.number().int().positive().optional().describe('Window size for rolling operations'),
});

function compute(input: z.infer<typeof schema>): Record<string, unknown> {
  const { operation, values, x, y, window } = input;

  switch (operation) {
    case 'descriptive': {
      if (!values) throw new Error('values is required for descriptive stats');
      return { operation: 'descriptive', stats: descriptiveStats(values) };
    }
    case 'regression': {
      if (!x || !y) throw new Error('x and y are required for regression');
      return { operation: 'regression', result: regression(x, y) };
    }
    case 'rolling_mean': {
      if (!values) throw new Error('values is required for rolling_mean');
      if (!window) throw new Error('window is required for rolling_mean');
      return { operation: 'rolling_mean', values: rollingMean(values, window) };
    }
    case 'rolling_std': {
      if (!values) throw new Error('values is required for rolling_std');
      if (!window) throw new Error('window is required for rolling_std');
      return { operation: 'rolling_std', values: rollingStd(values, window) };
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

export default defineToolPlugin({
  id: 'calculate_statistics',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Compute descriptive statistics (mean, median, std, skewness, kurtosis), linear regression, or rolling statistics. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    return JSON.stringify({ data: compute(input) });
  },
});
