/**
 * trading_paper — Start paper (simulated) trading via gRPC TradingService.
 * riskLevel: moderate (no real money, but affects daemon state).
 */
import { z } from 'zod';
import { defineToolPlugin } from '../../domain/tool-plugin.js';
import { getTradingClient } from './grpc-clients.js';
import {
  StartTradingResponse_EventType,
} from '../../grpc/gen/tino/trading/v1/trading_pb.js';

const schema = z.object({
  strategy_path: z.string().describe('Path to the strategy Python file'),
  instruments: z.array(z.string()).describe('List of instrument symbols to trade'),
  venue: z.string().default('SIM').describe('Trading venue (default: SIM for paper)'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
});

type Input = z.infer<typeof schema>;

export const tradingPaperPlugin = defineToolPlugin({
  id: 'trading_paper',
  domain: 'trading',
  riskLevel: 'moderate',
  description:
    'Start a paper trading session with a strategy. Runs in simulation mode with no real money at risk.',
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw) as Input;
    const client = getTradingClient();

    ctx.onProgress('Starting paper trading...');

    const events: Array<{ type: string; message: string; timestamp: string }> = [];

    for await (const event of client.startTrading({
      strategyPath: input.strategy_path,
      mode: 'paper',
      venue: input.venue,
      instruments: input.instruments,
      configJson: input.config_json,
    })) {
      if (ctx.signal.aborted) break;

      const eventName = StartTradingResponse_EventType[event.type] ?? 'UNKNOWN';
      events.push({
        type: eventName,
        message: event.message,
        timestamp: event.timestamp,
      });

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
        strategy: input.strategy_path,
        instruments: input.instruments,
        events,
      },
    });
  },
});
