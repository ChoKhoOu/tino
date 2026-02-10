/**
 * trading_killswitch — Emergency stop: cancel all orders, flatten positions.
 * riskLevel: dangerous (mutates live trading state).
 */
import { z } from 'zod';
import { defineToolPlugin } from '../../domain/tool-plugin.js';
import { getTradingClient } from './grpc-clients.js';

const schema = z.object({
  flatten_positions: z
    .boolean()
    .default(true)
    .describe('Whether to flatten (close) all open positions. Default: true (recommended).'),
});

type Input = z.infer<typeof schema>;

export const tradingKillswitchPlugin = defineToolPlugin({
  id: 'trading_killswitch',
  domain: 'trading',
  riskLevel: 'dangerous',
  description:
    'KILL SWITCH: Stop all trading immediately. Cancels open orders and optionally flattens all positions. Use in emergencies or when done trading.',
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw) as Input;
    const client = getTradingClient();

    ctx.onProgress('Stopping all trading...');

    const response = await client.stopTrading(input.flatten_positions);

    return JSON.stringify({
      data: {
        status: response.success ? 'stopped' : 'failed',
        flattenedPositions: input.flatten_positions,
        success: response.success,
      },
    });
  },
});
