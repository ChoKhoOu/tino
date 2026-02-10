import { z } from 'zod';
import { defineToolPlugin } from '@/domain/tool-plugin.js';
import { correlation, rollingCorrelation } from './stats.js';

const schema = z.object({
  series: z
    .array(z.array(z.number()))
    .describe('Array of numeric series to correlate (at least 2 series, each with at least 2 values)'),
  labels: z.array(z.string()).optional().describe('Optional labels for each series'),
  rollingWindow: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('If provided, compute rolling correlation between first two series with this window'),
});

export default defineToolPlugin({
  id: 'analyze_correlation',
  domain: 'quant',
  riskLevel: 'safe',
  description:
    'Compute correlation matrix between multiple numeric series, with optional rolling correlation for time-series analysis. Pure computation, no external API calls.',
  schema,
  execute: async (raw) => {
    const input = schema.parse(raw);
    const { series, labels, rollingWindow } = input;

    if (series.length < 2) throw new Error('At least 2 series are required');

    const n = series.length;
    const matrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        row.push(i === j ? 1.0 : correlation(series[i]!, series[j]!));
      }
      matrix.push(row);
    }

    const data: Record<string, unknown> = {
      correlationMatrix: matrix,
      labels: labels ?? series.map((_, i) => `series_${i}`),
    };

    if (rollingWindow && series.length >= 2) {
      data.rollingCorrelation = rollingCorrelation(series[0]!, series[1]!, rollingWindow);
    }

    return JSON.stringify({ data });
  },
});
