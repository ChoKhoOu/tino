import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { generateStrategyCode } from './generator.js';

const StrategyGenSchema = z.object({
  description: z.string().describe('Natural language strategy description'),
  instrument: z.string().optional().describe('Instrument symbol, e.g., AAPL or BTCUSDT'),
  timeframe: z.string().optional().describe('Timeframe, e.g., 1-DAY or 1-HOUR'),
});

/**
 * Create strategy_gen tool for generating NautilusTrader strategy code with guardrails.
 */
export function createStrategyTool(model: string): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'strategy_gen',
    description: 'Generate NautilusTrader strategy Python code from natural language with static safety validation.',
    schema: StrategyGenSchema,
    func: async (input, _runManager, config) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
      onProgress?.('Generating strategy code...');

      const result = await generateStrategyCode(
        {
          description: input.description,
          instrument: input.instrument ?? 'AAPL',
          timeframe: input.timeframe ?? '1-DAY',
        },
        model,
      );

      return formatToolResult(result, []);
    },
  });
}

export { StrategyGenSchema };
