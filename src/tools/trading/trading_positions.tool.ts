/**
 * trading_positions — View current open positions via gRPC TradingService.
 * riskLevel: safe (read-only query).
 */
import { z } from 'zod';
import { defineToolPlugin } from '../../domain/tool-plugin.js';
import { getTradingClient } from './grpc-clients.js';

const schema = z.object({});

export const tradingPositionsPlugin = defineToolPlugin({
  id: 'trading_positions',
  domain: 'trading',
  riskLevel: 'safe',
  description:
    'Query current open positions. Shows instrument, quantity, avg price, and unrealized/realized PnL.',
  schema,
  execute: async (_raw, _ctx) => {
    const client = getTradingClient();
    const response = await client.getPositions();

    const positions = response.positions.map((p) => ({
      instrument: p.instrument,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl,
    }));

    return JSON.stringify({
      data: {
        totalPositions: positions.length,
        positions,
      },
    });
  },
});
