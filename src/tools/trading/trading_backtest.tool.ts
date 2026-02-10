/**
 * trading_backtest — Run backtests via gRPC BacktestService.
 * riskLevel: safe (read-only simulation on historical data).
 */
import { z } from 'zod';
import { definePlugin } from '../../domain/tool-plugin.js';
import { getBacktestClient } from './grpc-clients.js';
import {
  RunBacktestResponse_EventType,
} from '../../grpc/gen/tino/backtest/v1/backtest_pb.js';

const schema = z.object({
  strategy_path: z.string().describe('Path to the strategy Python file'),
  instrument: z.string().describe('Instrument symbol, e.g. "AAPL"'),
  bar_type: z.string().default('1-DAY-LAST-EXTERNAL').describe('Bar type'),
  start_date: z.string().describe('Backtest start date (YYYY-MM-DD)'),
  end_date: z.string().describe('Backtest end date (YYYY-MM-DD)'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
});

type Input = z.infer<typeof schema>;

export const tradingBacktestPlugin = definePlugin({
  id: 'trading_backtest',
  domain: 'trading',
  riskLevel: 'safe',
  description:
    'Execute a backtest with a NautilusTrader strategy. Streams progress and returns performance metrics (return, Sharpe, drawdown, win rate, etc.).',
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw) as Input;
    const client = getBacktestClient();

    ctx.onProgress('Starting backtest...');

    let result: Record<string, unknown> | null = null;
    let errorMessage: string | null = null;

    for await (const event of client.runBacktest({
      strategyPath: input.strategy_path,
      instrument: input.instrument,
      barType: input.bar_type,
      startDate: input.start_date,
      endDate: input.end_date,
      configJson: input.config_json,
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
        strategy: input.strategy_path,
        instrument: input.instrument,
        period: `${input.start_date} to ${input.end_date}`,
        result,
      },
    });
  },
});
