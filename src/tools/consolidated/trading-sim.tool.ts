import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getBacktestClient, getTradingClient } from '../trading/grpc-clients.js';
import { TRADING_SIM_DESCRIPTION } from '../descriptions/trading-sim.js';
import {
  RunBacktestResponse_EventType,
} from '@/grpc/gen/tino/backtest/v1/backtest_pb.js';
import {
  StartTradingResponse_EventType,
} from '@/grpc/gen/tino/trading/v1/trading_pb.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const schema = z.object({
  action: z.enum([
    'backtest',
    'paper_trade',
    'positions',
  ]).describe('The trading simulation action to perform'),
  strategy_file: z.string().optional().describe('Strategy file path'),
  instrument: z.string().optional().describe('Trading instrument symbol'),
  params: z.record(z.string(), z.unknown()).optional().describe('Additional parameters'),
  account: z.string().optional().describe('Trading account identifier'),
  venue: z.enum(['SIM', 'BINANCE', 'OKX', 'BYBIT']).default('SIM').describe('Trading venue'),
});

type Input = z.infer<typeof schema>;

async function handleBacktest(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.backtest ?? getBacktestClient();
  ctx.onProgress('Starting backtest...');

  let result: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;

  for await (const event of client.runBacktest({
    strategyPath: input.strategy_file ?? '',
    instrument: input.instrument ?? '',
    barType: (input.params?.bar_type as string) ?? '1-DAY-LAST-EXTERNAL',
    startDate: (input.params?.start_date as string) ?? '',
    endDate: (input.params?.end_date as string) ?? '',
    configJson: JSON.stringify(input.params ?? {}),
  })) {
    if (ctx.signal.aborted) break;

    switch (event.type) {
      case RunBacktestResponse_EventType.PROGRESS:
        ctx.onProgress(`Backtest: ${Math.round(event.progressPct)}% — ${event.message}`);
        break;
      case RunBacktestResponse_EventType.COMPLETED:
        if (event.result) {
          result = {
            id: event.result.id,
            totalReturn: event.result.totalReturn,
            sharpeRatio: event.result.sharpeRatio,
            maxDrawdown: event.result.maxDrawdown,
            sortinoRatio: event.result.sortinoRatio,
            totalTrades: event.result.totalTrades,
            winningTrades: event.result.winningTrades,
            winRate: event.result.winRate,
            profitFactor: event.result.profitFactor,
            createdAt: event.result.createdAt,
          };
        }
        break;
      case RunBacktestResponse_EventType.ERROR:
        errorMessage = event.message;
        break;
    }
  }

  if (errorMessage) {
    return JSON.stringify({ data: { status: 'error', error: errorMessage } });
  }

  return JSON.stringify({
    data: {
      status: 'completed',
      strategy: input.strategy_file,
      instrument: input.instrument,
      result,
    },
  });
}

async function handlePaperTrade(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.trading ?? getTradingClient();
  ctx.onProgress('Starting paper trading...');

  const events: Array<{ type: string; message: string; timestamp: string }> = [];

  for await (const event of client.startTrading({
    strategyPath: input.strategy_file ?? '',
    mode: 'paper',
    venue: input.venue,
    instruments: input.instrument ? [input.instrument] : [],
    configJson: JSON.stringify(input.params ?? {}),
  })) {
    if (ctx.signal.aborted) break;

    const eventName = StartTradingResponse_EventType[event.type] ?? 'UNKNOWN';
    events.push({ type: eventName, message: event.message, timestamp: event.timestamp });

    switch (event.type) {
      case StartTradingResponse_EventType.STARTED:
        ctx.onProgress('Paper trading started');
        break;
      case StartTradingResponse_EventType.ERROR:
        ctx.onProgress(`Paper trading error: ${event.message}`);
        break;
      case StartTradingResponse_EventType.STOPPED:
        ctx.onProgress('Paper trading stopped');
        break;
      default:
        ctx.onProgress(`[${eventName}] ${event.message}`);
        break;
    }
  }

  return JSON.stringify({
    data: {
      status: 'completed',
      mode: 'paper',
      strategy: input.strategy_file,
      instruments: input.instrument ? [input.instrument] : [],
      events,
    },
  });
}

async function handlePositions(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.trading ?? getTradingClient();
  const response = await client.getPositions();

  const positions = response.positions.map((p) => ({
    instrument: p.instrument,
    quantity: p.quantity,
    avgPrice: p.avgPrice,
    unrealizedPnl: p.unrealizedPnl,
    realizedPnl: p.realizedPnl,
  }));

  return JSON.stringify({
    data: { totalPositions: positions.length, positions },
  });
}

export default definePlugin({
  id: 'trading_sim',
  domain: 'trading',
  riskLevel: 'moderate',
  description: TRADING_SIM_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'backtest':
        return handleBacktest(input, ctx);
      case 'paper_trade':
        return handlePaperTrade(input, ctx);
      case 'positions':
        return handlePositions(ctx);
    }
  },
});
