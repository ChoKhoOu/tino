import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  ingestData,
  listCatalog,
  runBacktest,
  startPaperTrade,
  startLiveTrade,
  getPositions,
  getOrders,
  stopTrading,
  __setClients,
  TRADING_TOOLS,
  TRADING_TOOL_MAP,
} from './tools.js';
import type { DataClient } from '../../grpc/data-client.js';
import type { BacktestClient } from '../../grpc/backtest-client.js';
import type { TradingClient } from '../../grpc/trading-client.js';
import { RunBacktestResponse_EventType } from '../../grpc/gen/tino/backtest/v1/backtest_pb.js';
import { StartTradingResponse_EventType } from '../../grpc/gen/tino/trading/v1/trading_pb.js';

function createMockDataClient(): DataClient {
  return {
    async *ingestData() {
      yield {
        type: 2,
        message: 'Ingestion complete',
        progressPct: 100,
        rowsIngested: BigInt(252),
      };
    },
    async listCatalog() {
      return {
        entries: [
          {
            instrument: 'AAPL',
            barType: '1-DAY-LAST-EXTERNAL',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            rowCount: BigInt(252),
          },
        ],
      };
    },
  } as unknown as DataClient;
}

function createMockBacktestClient(): BacktestClient {
  return {
    async *runBacktest() {
      yield {
        type: RunBacktestResponse_EventType.PROGRESS,
        message: 'Running...',
        progressPct: 50,
        result: undefined,
      };
      yield {
        type: RunBacktestResponse_EventType.COMPLETED,
        message: 'Done',
        progressPct: 100,
        result: {
          id: 'bt-001',
          totalReturn: 0.15,
          sharpeRatio: 1.2,
          maxDrawdown: -0.08,
          sortinoRatio: 1.5,
          totalTrades: 42,
          winningTrades: 25,
          winRate: 0.595,
          profitFactor: 1.8,
          equityCurveJson: '[]',
          tradesJson: '[]',
          createdAt: '2024-06-15',
        },
      };
    },
    async cancelBacktest() {
      return { success: true };
    },
    async getResult() {
      return { result: { id: 'bt-001', totalReturn: 0.15 } };
    },
    async listResults() {
      return { results: [] };
    },
  } as unknown as BacktestClient;
}

function createMockTradingClient(): TradingClient {
  return {
    async *startTrading(request: { mode: string }) {
      yield {
        type: StartTradingResponse_EventType.STARTED,
        message: `${request.mode} trading started`,
        dataJson: '{}',
        timestamp: '2024-06-15T10:00:00Z',
      };
      yield {
        type: StartTradingResponse_EventType.STOPPED,
        message: 'Trading stopped',
        dataJson: '{}',
        timestamp: '2024-06-15T10:30:00Z',
      };
    },
    async stopTrading() {
      return { success: true };
    },
    async getPositions() {
      return {
        positions: [
          {
            instrument: 'AAPL',
            quantity: 100,
            avgPrice: 150.5,
            unrealizedPnl: 250.0,
            realizedPnl: 0,
          },
        ],
      };
    },
    async getOrders() {
      return {
        orders: [
          {
            id: 'ord-001',
            instrument: 'AAPL',
            side: 'BUY',
            type: 'MARKET',
            quantity: 100,
            price: 150.5,
            status: 'FILLED',
            timestamp: '2024-06-15T10:00:00Z',
          },
        ],
      };
    },
    async submitOrder() {
      return { orderId: 'ord-002', success: true };
    },
    async cancelOrder() {
      return { success: true };
    },
  } as unknown as TradingClient;
}

beforeEach(() => {
  __setClients({
    dataClient: createMockDataClient(),
    backtestClient: createMockBacktestClient(),
    tradingClient: createMockTradingClient(),
  });
});

afterEach(() => {
  __setClients({
    dataClient: null,
    backtestClient: null,
    tradingClient: null,
  });
});

describe('TRADING_TOOLS registry', () => {
  test('contains all 8 sub-tools', () => {
    expect(TRADING_TOOLS).toHaveLength(8);
    const names = TRADING_TOOLS.map(t => t.name);
    expect(names).toContain('ingest_data');
    expect(names).toContain('list_catalog');
    expect(names).toContain('run_backtest');
    expect(names).toContain('start_paper_trade');
    expect(names).toContain('start_live_trade');
    expect(names).toContain('get_positions');
    expect(names).toContain('get_orders');
    expect(names).toContain('stop_trading');
  });

  test('TRADING_TOOL_MAP indexes all tools by name', () => {
    expect(TRADING_TOOL_MAP.size).toBe(8);
    expect(TRADING_TOOL_MAP.get('stop_trading')).toBe(stopTrading);
  });
});

describe('ingest_data', () => {
  test('returns ingestion result', async () => {
    const raw = await ingestData.invoke({
      instrument: 'AAPL',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('completed');
    expect(result.data.instrument).toBe('AAPL');
    expect(result.data.rowsIngested).toBe(252);
  });
});

describe('list_catalog', () => {
  test('returns catalog entries', async () => {
    const raw = await listCatalog.invoke({});
    const result = JSON.parse(raw as string);
    expect(result.data.totalEntries).toBe(1);
    expect(result.data.entries[0].instrument).toBe('AAPL');
    expect(result.data.entries[0].rowCount).toBe(252);
  });
});

describe('run_backtest', () => {
  test('streams progress and returns result', async () => {
    const raw = await runBacktest.invoke({
      strategy_path: '/path/to/ema_cross.py',
      instrument: 'AAPL',
      start_date: '2024-01-01',
      end_date: '2024-06-30',
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('completed');
    expect(result.data.result.totalReturn).toBe(0.15);
    expect(result.data.result.sharpeRatio).toBe(1.2);
    expect(result.data.result.totalTrades).toBe(42);
    expect(result.data.result.winRate).toBe(0.595);
  });

  test('returns error on backtest failure', async () => {
    __setClients({
      backtestClient: {
        async *runBacktest() {
          yield {
            type: RunBacktestResponse_EventType.ERROR,
            message: 'Strategy file not found',
            progressPct: 0,
            result: undefined,
          };
        },
      } as unknown as BacktestClient,
    });

    const raw = await runBacktest.invoke({
      strategy_path: '/invalid/path.py',
      instrument: 'AAPL',
      start_date: '2024-01-01',
      end_date: '2024-06-30',
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('error');
    expect(result.data.error).toBe('Strategy file not found');
  });
});

describe('start_paper_trade', () => {
  test('starts paper trading and returns events', async () => {
    const raw = await startPaperTrade.invoke({
      strategy_path: '/path/to/ema_cross.py',
      instruments: ['AAPL'],
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('completed');
    expect(result.data.mode).toBe('paper');
    expect(result.data.events).toHaveLength(2);
    expect(result.data.events[0].type).toBe('STARTED');
    expect(result.data.events[1].type).toBe('STOPPED');
  });
});

describe('start_live_trade', () => {
  test('refuses without confirmed=true', async () => {
    const raw = await startLiveTrade.invoke({
      strategy_path: '/path/to/ema_cross.py',
      instruments: ['AAPL'],
      venue: 'BINANCE',
      confirmed: false,
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('refused');
    expect(result.data.error).toContain('confirmed=true');
  });

  test('starts live trading with confirmed=true', async () => {
    const raw = await startLiveTrade.invoke({
      strategy_path: '/path/to/ema_cross.py',
      instruments: ['AAPL'],
      venue: 'BINANCE',
      confirmed: true,
    });
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('completed');
    expect(result.data.mode).toBe('live');
  });
});

describe('get_positions', () => {
  test('returns current positions', async () => {
    const raw = await getPositions.invoke({});
    const result = JSON.parse(raw as string);
    expect(result.data.totalPositions).toBe(1);
    expect(result.data.positions[0].instrument).toBe('AAPL');
    expect(result.data.positions[0].quantity).toBe(100);
    expect(result.data.positions[0].unrealizedPnl).toBe(250);
  });
});

describe('get_orders', () => {
  test('returns order history', async () => {
    const raw = await getOrders.invoke({});
    const result = JSON.parse(raw as string);
    expect(result.data.totalOrders).toBe(1);
    expect(result.data.orders[0].id).toBe('ord-001');
    expect(result.data.orders[0].side).toBe('BUY');
    expect(result.data.orders[0].status).toBe('FILLED');
  });
});

describe('stop_trading', () => {
  test('stops trading and returns success', async () => {
    const raw = await stopTrading.invoke({});
    const result = JSON.parse(raw as string);
    expect(result.data.status).toBe('stopped');
    expect(result.data.success).toBe(true);
    expect(result.data.flattenedPositions).toBe(true);
  });

  test('respects flatten_positions=false', async () => {
    const raw = await stopTrading.invoke({ flatten_positions: false });
    const result = JSON.parse(raw as string);
    expect(result.data.flattenedPositions).toBe(false);
  });
});
