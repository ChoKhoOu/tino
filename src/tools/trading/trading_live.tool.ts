/**
 * trading_live — Start live trading with REAL MONEY via gRPC TradingService.
 * riskLevel: dangerous — requires confirmed=true safety gate.
 *
 * G3 INVARIANT: The `confirmed` field MUST be true to proceed.
 * If confirmed is false or missing, execution is refused.
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
  venue: z.string().describe('Trading venue/exchange identifier'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
  confirmed: z
    .boolean()
    .describe(
      'REQUIRED: Must be explicitly set to true to start live trading. This uses REAL MONEY.',
    ),
});

type Input = z.infer<typeof schema>;

export const tradingLivePlugin = defineToolPlugin({
  id: 'trading_live',
  domain: 'trading',
  riskLevel: 'dangerous',
  description:
    'Start a LIVE trading session with real money. DANGEROUS: Requires explicit confirmed=true parameter. Prefer paper trading first.',
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw) as Input;

    // ── G3 safety gate: refuse without explicit confirmation ──
    if (!input.confirmed) {
      return JSON.stringify({
        data: {
          status: 'refused',
          error:
            'Live trading requires explicit confirmation. Set confirmed=true to proceed. This will use REAL MONEY.',
        },
      });
    }

    const client = getTradingClient();
    ctx.onProgress('⚠️ Starting LIVE trading...');

    const events: Array<{ type: string; message: string; timestamp: string }> = [];

    for await (const event of client.startTrading({
      strategyPath: input.strategy_path,
      mode: 'live',
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
          ctx.onProgress('LIVE trading started');
          break;
        case StartTradingResponse_EventType.ERROR:
          ctx.onProgress(`LIVE trading error: ${event.message}`);
          break;
        case StartTradingResponse_EventType.STOPPED:
          ctx.onProgress('LIVE trading stopped');
          break;
        default:
          ctx.onProgress(`[LIVE ${eventName}] ${event.message}`);
          break;
      }
    }

    return JSON.stringify({
      data: {
        status: 'completed',
        mode: 'live',
        strategy: input.strategy_path,
        instruments: input.instruments,
        venue: input.venue,
        events,
      },
    });
  },
});
