import { z } from 'zod';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { definePlugin } from '@/domain/index.js';
import { getTradingClient } from '../trading/grpc-clients.js';
import { TRADING_LIVE_DESCRIPTION } from '../descriptions/trading-live.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const schema = z.object({
  action: z.enum([
    'submit_order',
    'kill_switch',
  ]).describe('The live trading action to perform'),
  order: z.record(z.string(), z.unknown()).optional().describe('Order details (instrument, side, type, quantity, price)'),
  confirmed: z.boolean().describe('REQUIRED: Must be true to execute live orders. This uses REAL MONEY.'),
  venue: z.enum(['SIM', 'BINANCE', 'OKX', 'BYBIT']).default('SIM').describe('Trading venue'),
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

  const client = ctx.grpc?.trading ?? getTradingClient();
  const order = input.order ?? {};

  ctx.onProgress('Submitting live order...');

  const response = await client.submitOrder({
    instrument: String(order.instrument ?? ''),
    side: String(order.side ?? ''),
    type: String(order.type ?? 'market'),
    quantity: Number(order.quantity ?? 0),
    price: Number(order.price ?? 0),
    venue: input.venue,
  });

  return JSON.stringify({
    data: {
      status: 'submitted',
      orderId: response.orderId,
      success: response.success,
      venue: input.venue,
    },
  });
}

async function handleKillSwitch(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.trading ?? getTradingClient();
  ctx.onProgress('Stopping all trading — closing positions, cancelling orders...');

  const response = await client.stopTrading(true);

  logRiskEvent('kill_switch_executed', {
    success: response.success,
    flattenedPositions: true,
  });

  return JSON.stringify({
    data: {
      status: response.success ? 'stopped' : 'failed',
      flattenedPositions: true,
      cancelledOrders: true,
      success: response.success,
    },
  });
}

function logRiskEvent(event: string, data: Record<string, unknown>): void {
  try {
    if (!existsSync('.tino')) mkdirSync('.tino', { recursive: true });
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), event, ...data });
    appendFileSync('.tino/risk-events.log', entry + '\n');
  } catch {
    // Non-fatal: logging should never break trading operations
  }
}

export default definePlugin({
  id: 'trading_live',
  domain: 'trading',
  riskLevel: 'dangerous',
  description: TRADING_LIVE_DESCRIPTION,
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
