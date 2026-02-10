import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import type { ModelBroker } from '@/runtime/model-broker.js';
import { validateStrategyCode, extractStrategyClassName } from '../strategy/validator.js';
import { formatToolResult } from '../types.js';
import { generateStrategy } from './strategy-lab-generate.js';
import { STRATEGY_LAB_DESCRIPTION } from '../descriptions/strategy-lab.js';

const schema = z.object({
  action: z.enum(['generate', 'validate']).describe('The strategy lab action to perform'),
  description: z.string().optional().describe('Natural language description of desired strategy'),
  code: z.string().optional().describe('Strategy code to validate'),
  instrument: z.string().optional().describe('Instrument symbol, e.g., AAPL or BTCUSDT'),
  constraints: z.string().optional().describe('Strategy constraints, e.g., max drawdown 10%'),
});

export default definePlugin({
  id: 'strategy_lab',
  domain: 'strategy',
  riskLevel: 'moderate',
  description: STRATEGY_LAB_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'generate': {
        const broker = ctx.config.broker as ModelBroker | undefined;
        if (!broker) return formatToolResult({ error: 'ModelBroker not available in tool context' });
        if (!input.description) return JSON.stringify({ error: 'description is required for generate action' });

        ctx.onProgress('Generating strategy code...');
        const result = await generateStrategy(
          {
            description: input.description,
            instrument: input.instrument,
            constraints: input.constraints,
          },
          broker,
        );
        return formatToolResult(result);
      }

      case 'validate': {
        if (!input.code) return JSON.stringify({ error: 'code is required for validate action' });
        const validation = validateStrategyCode(input.code);
        const className = extractStrategyClassName(input.code);
        return formatToolResult({ className, validation });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${input.action}` });
    }
  },
});
