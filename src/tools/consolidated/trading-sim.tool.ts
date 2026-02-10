import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const schema = z.object({
  action: z.enum([
    'backtest',
    'paper_trade',
    'positions',
  ]).describe('The trading simulation action to perform'),
  strategy: z.string().optional().describe('Strategy name or code to execute'),
  symbol: z.string().optional().describe('Trading instrument symbol'),
  startDate: z.string().optional().describe('Simulation start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('Simulation end date (YYYY-MM-DD)'),
});

export default definePlugin({
  id: 'trading_sim',
  domain: 'trading',
  riskLevel: 'moderate',
  description:
    'Run backtests and paper trading simulations. View simulated positions and performance metrics.',
  schema,
  execute: async (raw) => {
    const { action } = schema.parse(raw);
    return JSON.stringify({ error: `Not implemented: ${action}` });
  },
});
