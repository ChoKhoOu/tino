/**
 * Trading sub-tools that proxy operations to the Python daemon via gRPC.
 * Each tool maps to one or more gRPC service calls on DataService,
 * BacktestService, or TradingService.
 */
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';
import { DataClient } from '../../grpc/data-client.js';
import { BacktestClient } from '../../grpc/backtest-client.js';
import { TradingClient } from '../../grpc/trading-client.js';
import {
  RunBacktestResponse_EventType,
} from '../../grpc/gen/tino/backtest/v1/backtest_pb.js';
import {
  StartTradingResponse_EventType,
} from '../../grpc/gen/tino/trading/v1/trading_pb.js';

// Shared gRPC client instances (lazy-initialized)
let _dataClient: DataClient | null = null;
let _backtestClient: BacktestClient | null = null;
let _tradingClient: TradingClient | null = null;

function getDataClient(): DataClient {
  if (!_dataClient) _dataClient = new DataClient();
  return _dataClient;
}

function getBacktestClient(): BacktestClient {
  if (!_backtestClient) _backtestClient = new BacktestClient();
  return _backtestClient;
}

function getTradingClient(): TradingClient {
  if (!_tradingClient) _tradingClient = new TradingClient();
  return _tradingClient;
}

/** For testing: replace the gRPC clients with mocks */
export function __setClients(opts: {
  dataClient?: DataClient | null;
  backtestClient?: BacktestClient | null;
  tradingClient?: TradingClient | null;
}): void {
  if (opts.dataClient !== undefined) _dataClient = opts.dataClient;
  if (opts.backtestClient !== undefined) _backtestClient = opts.backtestClient;
  if (opts.tradingClient !== undefined) _tradingClient = opts.tradingClient;
}

// ─── ingest_data ───────────────────────────────────────────────

const IngestDataSchema = z.object({
  instrument: z.string().describe('Instrument symbol, e.g. "AAPL", "BTCUSDT"'),
  bar_type: z.string().default('1-DAY-LAST-EXTERNAL').describe('Bar type, e.g. "1-DAY-LAST-EXTERNAL", "1-HOUR-LAST-EXTERNAL"'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  source: z.string().default('csv').describe('Data source. Default: "csv"'),
});

export const ingestData = new DynamicStructuredTool({
  name: 'ingest_data',
  description: 'Download and catalog market data for backtesting. Streams progress as data is ingested.',
  schema: IngestDataSchema,
  func: async (input, _runManager, config) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const client = getDataClient();

    onProgress?.(`Ingesting ${input.instrument} data...`);

    let lastMessage = '';
    let rowsIngested = 0;

    for await (const event of client.ingestData({
      source: input.source,
      instrument: input.instrument,
      barType: input.bar_type,
      startDate: input.start_date,
      endDate: input.end_date,
    })) {
      lastMessage = event.message;
      if (event.rowsIngested) rowsIngested = Number(event.rowsIngested);
      if (event.progressPct > 0) {
        onProgress?.(`Ingesting ${input.instrument}: ${Math.round(event.progressPct)}%`);
      }
    }

    return formatToolResult({
      status: 'completed',
      instrument: input.instrument,
      barType: input.bar_type,
      startDate: input.start_date,
      endDate: input.end_date,
      rowsIngested,
      message: lastMessage,
    });
  },
});

// ─── list_catalog ──────────────────────────────────────────────

export const listCatalog = new DynamicStructuredTool({
  name: 'list_catalog',
  description: 'List all available market data in the local catalog. Shows instruments, bar types, date ranges, and row counts.',
  schema: z.object({}),
  func: async () => {
    const client = getDataClient();
    const response = await client.listCatalog();

    const entries = response.entries.map((e) => ({
      instrument: e.instrument,
      barType: e.barType,
      startDate: e.startDate,
      endDate: e.endDate,
      rowCount: Number(e.rowCount),
    }));

    return formatToolResult({
      totalEntries: entries.length,
      entries,
    });
  },
});

// ─── run_backtest ──────────────────────────────────────────────

const RunBacktestSchema = z.object({
  strategy_path: z.string().describe('Path to the strategy Python file'),
  instrument: z.string().describe('Instrument symbol, e.g. "AAPL"'),
  bar_type: z.string().default('1-DAY-LAST-EXTERNAL').describe('Bar type'),
  start_date: z.string().describe('Backtest start date (YYYY-MM-DD)'),
  end_date: z.string().describe('Backtest end date (YYYY-MM-DD)'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
});

export const runBacktest = new DynamicStructuredTool({
  name: 'run_backtest',
  description: 'Execute a backtest with a NautilusTrader strategy. Streams progress and returns performance metrics (return, Sharpe, drawdown, win rate, etc.).',
  schema: RunBacktestSchema,
  func: async (input, _runManager, config) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const client = getBacktestClient();

    onProgress?.('Starting backtest...');

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
      switch (event.type) {
        case RunBacktestResponse_EventType.PROGRESS:
          onProgress?.(`Backtest: ${Math.round(event.progressPct)}% — ${event.message}`);
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
      return formatToolResult({ status: 'error', error: errorMessage });
    }

    return formatToolResult({
      status: 'completed',
      strategy: input.strategy_path,
      instrument: input.instrument,
      period: `${input.start_date} to ${input.end_date}`,
      result,
    });
  },
});

// ─── start_paper_trade ─────────────────────────────────────────

const StartPaperTradeSchema = z.object({
  strategy_path: z.string().describe('Path to the strategy Python file'),
  instruments: z.array(z.string()).describe('List of instrument symbols to trade'),
  venue: z.string().default('SIM').describe('Trading venue (default: SIM for paper)'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
});

export const startPaperTrade = new DynamicStructuredTool({
  name: 'start_paper_trade',
  description: 'Start a paper trading session with a strategy. Runs in simulation mode with no real money at risk.',
  schema: StartPaperTradeSchema,
  func: async (input, _runManager, config) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const client = getTradingClient();

    onProgress?.('Starting paper trading...');

    const events: Array<{ type: string; message: string; timestamp: string }> = [];

    for await (const event of client.startTrading({
      strategyPath: input.strategy_path,
      mode: 'paper',
      venue: input.venue,
      instruments: input.instruments,
      configJson: input.config_json,
    })) {
      const eventName = StartTradingResponse_EventType[event.type] ?? 'UNKNOWN';
      events.push({
        type: eventName,
        message: event.message,
        timestamp: event.timestamp,
      });

      switch (event.type) {
        case StartTradingResponse_EventType.STARTED:
          onProgress?.('Paper trading started');
          break;
        case StartTradingResponse_EventType.ERROR:
          onProgress?.(`Paper trading error: ${event.message}`);
          break;
        case StartTradingResponse_EventType.STOPPED:
          onProgress?.('Paper trading stopped');
          break;
        default:
          // Order fills, position changes, PnL updates
          onProgress?.(`[${eventName}] ${event.message}`);
          break;
      }
    }

    return formatToolResult({
      status: 'completed',
      mode: 'paper',
      strategy: input.strategy_path,
      instruments: input.instruments,
      events,
    });
  },
});

// ─── start_live_trade ──────────────────────────────────────────

const StartLiveTradeSchema = z.object({
  strategy_path: z.string().describe('Path to the strategy Python file'),
  instruments: z.array(z.string()).describe('List of instrument symbols to trade'),
  venue: z.string().describe('Trading venue/exchange identifier'),
  config_json: z.string().default('{}').describe('Strategy configuration as JSON string'),
  confirmed: z.boolean().describe('REQUIRED: Must be explicitly set to true to start live trading. This uses REAL MONEY.'),
});

export const startLiveTrade = new DynamicStructuredTool({
  name: 'start_live_trade',
  description: 'Start a LIVE trading session with real money. DANGEROUS: Requires explicit confirmed=true parameter. Prefer paper trading first.',
  schema: StartLiveTradeSchema,
  func: async (input, _runManager, config) => {
    // Safety gate: refuse without explicit confirmation
    if (!input.confirmed) {
      return formatToolResult({
        status: 'refused',
        error: 'Live trading requires explicit confirmation. Set confirmed=true to proceed. This will use REAL MONEY.',
      });
    }

    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const client = getTradingClient();

    onProgress?.('⚠️ Starting LIVE trading...');

    const events: Array<{ type: string; message: string; timestamp: string }> = [];

    for await (const event of client.startTrading({
      strategyPath: input.strategy_path,
      mode: 'live',
      venue: input.venue,
      instruments: input.instruments,
      configJson: input.config_json,
    })) {
      const eventName = StartTradingResponse_EventType[event.type] ?? 'UNKNOWN';
      events.push({
        type: eventName,
        message: event.message,
        timestamp: event.timestamp,
      });

      switch (event.type) {
        case StartTradingResponse_EventType.STARTED:
          onProgress?.('LIVE trading started');
          break;
        case StartTradingResponse_EventType.ERROR:
          onProgress?.(`LIVE trading error: ${event.message}`);
          break;
        case StartTradingResponse_EventType.STOPPED:
          onProgress?.('LIVE trading stopped');
          break;
        default:
          onProgress?.(`[LIVE ${eventName}] ${event.message}`);
          break;
      }
    }

    return formatToolResult({
      status: 'completed',
      mode: 'live',
      strategy: input.strategy_path,
      instruments: input.instruments,
      venue: input.venue,
      events,
    });
  },
});

// ─── get_positions ─────────────────────────────────────────────

export const getPositions = new DynamicStructuredTool({
  name: 'get_positions',
  description: 'Query current open positions. Shows instrument, quantity, avg price, and unrealized/realized PnL.',
  schema: z.object({}),
  func: async () => {
    const client = getTradingClient();
    const response = await client.getPositions();

    const positions = response.positions.map((p) => ({
      instrument: p.instrument,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      unrealizedPnl: p.unrealizedPnl,
      realizedPnl: p.realizedPnl,
    }));

    return formatToolResult({
      totalPositions: positions.length,
      positions,
    });
  },
});

// ─── get_orders ────────────────────────────────────────────────

const GetOrdersSchema = z.object({
  limit: z.number().default(50).describe('Maximum number of orders to return (default 50)'),
});

export const getOrders = new DynamicStructuredTool({
  name: 'get_orders',
  description: 'Query order history. Shows order ID, instrument, side, type, quantity, price, status, and timestamp.',
  schema: GetOrdersSchema,
  func: async (input) => {
    const client = getTradingClient();
    const response = await client.getOrders(input.limit);

    const orders = response.orders.map((o) => ({
      id: o.id,
      instrument: o.instrument,
      side: o.side,
      type: o.type,
      quantity: o.quantity,
      price: o.price,
      status: o.status,
      timestamp: o.timestamp,
    }));

    return formatToolResult({
      totalOrders: orders.length,
      orders,
    });
  },
});

// ─── stop_trading ──────────────────────────────────────────────

const StopTradingSchema = z.object({
  flatten_positions: z.boolean().default(true).describe('Whether to flatten (close) all open positions. Default: true (recommended).'),
});

export const stopTrading = new DynamicStructuredTool({
  name: 'stop_trading',
  description: 'KILL SWITCH: Stop all trading immediately. Cancels open orders and optionally flattens all positions. Use in emergencies or when done trading.',
  schema: StopTradingSchema,
  func: async (input, _runManager, config) => {
    const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;
    const client = getTradingClient();

    onProgress?.('Stopping all trading...');

    const response = await client.stopTrading(input.flatten_positions);

    return formatToolResult({
      status: response.success ? 'stopped' : 'failed',
      flattenedPositions: input.flatten_positions,
      success: response.success,
    });
  },
});

// ─── Export all tools ──────────────────────────────────────────

import type { StructuredToolInterface } from '@langchain/core/tools';

export const TRADING_TOOLS: StructuredToolInterface[] = [
  ingestData,
  listCatalog,
  runBacktest,
  startPaperTrade,
  startLiveTrade,
  getPositions,
  getOrders,
  stopTrading,
];

export const TRADING_TOOL_MAP = new Map(TRADING_TOOLS.map(t => [t.name, t]));
