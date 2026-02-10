import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import { __setClients } from '../../trading/grpc-clients.js';
import type { BacktestClient } from '@/grpc/backtest-client.js';
import type { TradingClient } from '@/grpc/trading-client.js';
import {
  RunBacktestResponse_EventType,
} from '@/grpc/gen/tino/backtest/v1/backtest_pb.js';
import {
  StartTradingResponse_EventType,
} from '@/grpc/gen/tino/trading/v1/trading_pb.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

async function* asyncGen<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

describe('trading_sim consolidated tool', () => {
  afterEach(() => {
    __setClients({ backtestClient: null, tradingClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/trading-sim.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('trading_sim');
    expect(plugin.domain).toBe('trading');
    expect(plugin.riskLevel).toBe('moderate');
    expect(plugin.schema).toBeDefined();
  });

  describe('backtest action', () => {
    test('streams progress via ctx.onProgress', async () => {
      const progressMessages: string[] = [];
      const ctx = makeCtx({ onProgress: (msg) => progressMessages.push(msg) });

      const mockBacktestClient = {
        runBacktest: () =>
          asyncGen([
            {
              type: RunBacktestResponse_EventType.PROGRESS,
              message: 'Loading data',
              progressPct: 50,
              result: undefined,
            },
            {
              type: RunBacktestResponse_EventType.COMPLETED,
              message: 'Done',
              progressPct: 100,
              result: {
                id: 'bt-1',
                totalReturn: 0.15,
                sharpeRatio: 1.2,
                maxDrawdown: -0.08,
                sortinoRatio: 1.5,
                totalTrades: 42,
                winningTrades: 25,
                winRate: 0.595,
                profitFactor: 1.8,
                createdAt: '2024-01-01',
              },
            },
          ]),
      } as unknown as BacktestClient;

      __setClients({ backtestClient: mockBacktestClient });

      const mod = await import('../../consolidated/trading-sim.tool.js');
      const result = await mod.default.execute(
        {
          action: 'backtest',
          strategy_file: 'test_strategy.py',
          instrument: 'AAPL',
          params: { start_date: '2024-01-01', end_date: '2024-06-30' },
        },
        ctx,
      );

      expect(progressMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('completed');
      expect(parsed.data.result).toBeDefined();
      expect(parsed.data.result.totalReturn).toBe(0.15);
    });

    test('handles backtest error events', async () => {
      const mockBacktestClient = {
        runBacktest: () =>
          asyncGen([
            {
              type: RunBacktestResponse_EventType.ERROR,
              message: 'Strategy file not found',
              progressPct: 0,
              result: undefined,
            },
          ]),
      } as unknown as BacktestClient;

      __setClients({ backtestClient: mockBacktestClient });

      const mod = await import('../../consolidated/trading-sim.tool.js');
      const result = await mod.default.execute(
        { action: 'backtest', strategy_file: 'missing.py', instrument: 'AAPL' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('error');
      expect(parsed.data.error).toContain('Strategy file not found');
    });

    test('respects abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const callCount = { value: 0 };
      const mockBacktestClient = {
        runBacktest: () =>
          asyncGen([
            {
              type: RunBacktestResponse_EventType.PROGRESS,
              message: 'Loading',
              progressPct: 10,
              result: undefined,
            },
            {
              type: RunBacktestResponse_EventType.PROGRESS,
              message: 'Still going',
              progressPct: 50,
              result: undefined,
            },
          ]),
      } as unknown as BacktestClient;

      __setClients({ backtestClient: mockBacktestClient });

      const mod = await import('../../consolidated/trading-sim.tool.js');
      const ctx = makeCtx({ signal: controller.signal });
      const result = await mod.default.execute(
        { action: 'backtest', strategy_file: 'test.py', instrument: 'AAPL' },
        ctx,
      );

      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('paper_trade action', () => {
    test('streams trading events via ctx.onProgress', async () => {
      const progressMessages: string[] = [];
      const ctx = makeCtx({ onProgress: (msg) => progressMessages.push(msg) });

      const mockTradingClient = {
        startTrading: () =>
          asyncGen([
            {
              type: StartTradingResponse_EventType.STARTED,
              message: 'Paper trading started',
              dataJson: '',
              timestamp: '2024-01-01T00:00:00Z',
            },
            {
              type: StartTradingResponse_EventType.STOPPED,
              message: 'Paper trading stopped',
              dataJson: '',
              timestamp: '2024-01-01T01:00:00Z',
            },
          ]),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-sim.tool.js');
      const result = await mod.default.execute(
        {
          action: 'paper_trade',
          strategy_file: 'test_strategy.py',
          instrument: 'AAPL',
        },
        ctx,
      );

      expect(progressMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('completed');
      expect(parsed.data.mode).toBe('paper');
    });
  });

  describe('positions action', () => {
    test('returns positions from gRPC client', async () => {
      const mockTradingClient = {
        getPositions: async () => ({
          positions: [
            {
              instrument: 'AAPL',
              quantity: 100,
              avgPrice: 150.5,
              unrealizedPnl: 250.0,
              realizedPnl: 100.0,
            },
          ],
        }),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-sim.tool.js');
      const result = await mod.default.execute(
        { action: 'positions' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.totalPositions).toBe(1);
      expect(parsed.data.positions[0].instrument).toBe('AAPL');
      expect(parsed.data.positions[0].quantity).toBe(100);
    });
  });
});
