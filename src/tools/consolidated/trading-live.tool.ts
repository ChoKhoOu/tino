import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getTradingClient } from '../trading/grpc-clients.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const schema = z.object({
  action: z.enum([
    'submit_order',
    'kill_switch',
  ]).describe('The live trading action to perform'),
  order: z.record(z.string(), z.unknown()).optional().describe('Order details (instrument, side, type, quantity, price)'),
  confirmed: z.boolean().describe('REQUIRED: Must be true to execute live orders. This uses REAL MONEY.'),
});

type Input = z.infer<typeof schema>;

async function handleSubmitOrder(input: Input, ctx: ToolContext): Promise<string> {
  if (!input.confirmed) {
    return JSON.stringify({
      data: {
        status: 'refused',
        error: 'Live trading requires explicit confirmation. Set confirmed=true to proceed. This will use REAL MONEY.',
      },
    });
  }

  const client = getTradingClient();
  const order = input.order ?? {};

  ctx.onProgress('Submitting live order...');

  const response = await client.submitOrder({
    instrument: String(order.instrument ?? ''),
    side: String(order.side ?? ''),
    type: String(order.type ?? 'market'),
    quantity: Number(order.quantity ?? 0),
    price: Number(order.price ?? 0),
  });

  return JSON.stringify({
    data: {
      status: 'submitted',
      orderId: response.orderId,
      success: response.success,
    },
  });
}

async function handleKillSwitch(ctx: ToolContext): Promise<string> {
  const client = getTradingClient();
  ctx.onProgress('Stopping all trading...');

  const response = await client.stopTrading(true);

  return JSON.stringify({
    data: {
      status: response.success ? 'stopped' : 'failed',
      flattenedPositions: true,
      success: response.success,
    },
  });
}

export default definePlugin({
  id: 'trading_live',
  domain: 'trading',
  riskLevel: 'dangerous',
  description:
    'Submit live trading orders and activate emergency kill switch. Requires explicit user confirmation for all operations.',
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw) as Input;

    switch (input.action) {
      case 'submit_order':
        return handleSubmitOrder(input, ctx);
      case 'kill_switch':
        return handleKillSwitch(ctx);
    }
  },
});
