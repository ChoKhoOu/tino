import { z } from 'zod';
import { definePlugin } from '@/domain/tool-plugin.js';
import { validateStrategyCode, extractStrategyClassName } from './validator.js';
import { formatToolResult } from '../types.js';

const schema = z.object({
  code: z.string().describe('Python strategy code to validate'),
});

export default definePlugin({
  id: 'strategy_validator',
  domain: 'strategy',
  riskLevel: 'safe',
  description:
    'Validate NautilusTrader strategy Python code for dangerous imports, forbidden execution patterns, and required structure.',
  schema,
  execute: async (args) => {
    const { code } = schema.parse(args);
    const validation = validateStrategyCode(code);
    const className = extractStrategyClassName(code);

    return formatToolResult({
      className,
      validation,
    });
  },
});
