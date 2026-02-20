import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getPortfolioClient } from '../portfolio/grpc-clients.js';
import { PORTFOLIO_DESCRIPTION } from '../descriptions/portfolio.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const schema = z.object({
  action: z.enum([
    'summary',
    'trades',
    'positions',
    'pnl_history',
  ]).describe('The portfolio action to perform'),
  instrument: z.string().optional().describe('Filter by instrument symbol'),
  start_date: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Max number of results to return'),
});

type Input = z.infer<typeof schema>;

async function handleSummary(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getSummary();

  return JSON.stringify({
    data: {
      totalTrades: response.totalTrades,
      openPositions: response.openPositions,
      totalRealizedPnl: response.totalRealizedPnl,
      totalUnrealizedPnl: response.totalUnrealizedPnl,
      totalFees: response.totalFees,
    },
  });
}

async function handleTrades(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getTrades({
    instrument: input.instrument,
    startDate: input.start_date,
    endDate: input.end_date,
    limit: input.limit,
  });

  const trades = response.trades.map((t) => ({
    id: t.id,
    instrument: t.instrument,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    fee: t.fee,
    venue: t.venue,
    timestamp: t.timestamp,
    orderId: t.orderId,
    strategy: t.strategy,
  }));

  return JSON.stringify({ data: { trades } });
}

async function handlePositions(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getPositions(input.instrument);

  const positions = response.positions.map((p) => ({
    instrument: p.instrument,
    quantity: p.quantity,
    avgPrice: p.avgPrice,
    unrealizedPnl: p.unrealizedPnl,
    realizedPnl: p.realizedPnl,
    updatedAt: p.updatedAt,
  }));

  return JSON.stringify({
    data: { totalPositions: positions.length, positions },
  });
}

async function handlePnLHistory(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getPnLHistory({
    instrument: input.instrument,
    startDate: input.start_date,
    endDate: input.end_date,
  });

  const entries = response.entries.map((e) => ({
    date: e.date,
    instrument: e.instrument,
    totalPnl: e.totalPnl,
    realizedPnl: e.realizedPnl,
    unrealizedPnl: e.unrealizedPnl,
  }));

  return JSON.stringify({ data: { entries } });
}

export default definePlugin({
  id: 'portfolio',
  domain: 'portfolio',
  riskLevel: 'safe',
  description: PORTFOLIO_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'summary':
        return handleSummary(ctx);
      case 'trades':
        return handleTrades(input, ctx);
      case 'positions':
        return handlePositions(input, ctx);
      case 'pnl_history':
        return handlePnLHistory(input, ctx);
    }
  },
});
