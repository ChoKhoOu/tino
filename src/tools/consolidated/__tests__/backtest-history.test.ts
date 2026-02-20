import { describe, test, expect, afterEach } from 'bun:test';
import { __setClients } from '../../trading/grpc-clients.js';
import type { BacktestClient } from '@/grpc/backtest-client.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

const mockResult = {
  id: 'bt-001',
  totalReturn: 0.15,
  sharpeRatio: 1.5,
  maxDrawdown: -0.08,
  sortinoRatio: 2.0,
  totalTrades: 100,
  winRate: 0.55,
  profitFactor: 1.8,
  createdAt: '2026-01-01',
  winningTrades: 55,
  equityCurveJson: '[]',
  tradesJson: '[]',
};

const mockResultB = {
  id: 'bt-002',
  totalReturn: 0.25,
  sharpeRatio: 2.0,
  maxDrawdown: -0.05,
  sortinoRatio: 2.5,
  totalTrades: 120,
  winRate: 0.60,
  profitFactor: 2.2,
  createdAt: '2026-01-15',
  winningTrades: 72,
  equityCurveJson: '[1,2]',
  tradesJson: '[{"id":"t1"}]',
};

function makeMockClient(overrides: Partial<BacktestClient> = {}) {
  return {
    listResults: async () => ({ results: [mockResult, mockResultB] }),
    getResult: async (id: string) => {
      const map: Record<string, typeof mockResult> = {
        'bt-001': mockResult,
        'bt-002': mockResultB,
      };
      return { result: map[id] ?? undefined };
    },
    ...overrides,
  } as unknown as BacktestClient;
}

describe('backtest_history consolidated tool', () => {
  afterEach(() => {
    __setClients({ backtestClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../backtest-history.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('backtest_history');
    expect(plugin.domain).toBe('trading');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('list_results action', () => {
    test('returns summarized results', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'list_results' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.total).toBe(2);
      expect(parsed.data.results).toHaveLength(2);

      const first = parsed.data.results[0];
      expect(first.id).toBe('bt-001');
      expect(first.totalReturn).toBe(0.15);
      expect(first.sharpeRatio).toBe(1.5);
      expect(first.maxDrawdown).toBe(-0.08);
      expect(first.sortinoRatio).toBe(2.0);
      expect(first.totalTrades).toBe(100);
      expect(first.winRate).toBe(0.55);
      expect(first.profitFactor).toBe(1.8);
      expect(first.createdAt).toBe('2026-01-01');
      // summarize should NOT include full-result fields
      expect(first.winningTrades).toBeUndefined();
      expect(first.equityCurveJson).toBeUndefined();
      expect(first.tradesJson).toBeUndefined();
    });

    test('returns empty list when no results', async () => {
      __setClients({
        backtestClient: makeMockClient({
          listResults: async () => ({ results: [] }),
        } as unknown as Partial<BacktestClient>),
      });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'list_results' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.total).toBe(0);
      expect(parsed.data.results).toHaveLength(0);
    });
  });

  describe('get_result action', () => {
    test('returns full result for valid id', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'get_result', id: 'bt-001' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.id).toBe('bt-001');
      expect(parsed.data.totalReturn).toBe(0.15);
      expect(parsed.data.sharpeRatio).toBe(1.5);
      expect(parsed.data.maxDrawdown).toBe(-0.08);
      // full result includes extra fields
      expect(parsed.data.winningTrades).toBe(55);
      expect(parsed.data.equityCurveJson).toBe('[]');
      expect(parsed.data.tradesJson).toBe('[]');
    });

    test('returns error when id is missing', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'get_result' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.error).toContain('Missing required parameter: id');
    });

    test('returns error when result not found', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'get_result', id: 'bt-nonexistent' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.error).toContain('No result found for id: bt-nonexistent');
    });
  });

  describe('compare action', () => {
    test('returns deltas between two results', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({
        action: 'compare',
        ids: ['bt-001', 'bt-002'],
      }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.a.id).toBe('bt-001');
      expect(parsed.data.b.id).toBe('bt-002');

      // deltas = b - a
      const deltas = parsed.data.deltas;
      expect(deltas.totalReturn).toBeCloseTo(0.10);     // 0.25 - 0.15
      expect(deltas.sharpeRatio).toBeCloseTo(0.5);      // 2.0 - 1.5
      expect(deltas.maxDrawdown).toBeCloseTo(0.03);     // -0.05 - (-0.08)
      expect(deltas.winRate).toBeCloseTo(0.05);          // 0.60 - 0.55
      expect(deltas.profitFactor).toBeCloseTo(0.4);      // 2.2 - 1.8
    });

    test('returns error when ids array is missing', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({ action: 'compare' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.error).toContain('compare requires exactly 2 IDs');
    });

    test('returns error when ids has != 2 elements', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({
        action: 'compare',
        ids: ['bt-001'],
      }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.error).toContain('compare requires exactly 2 IDs');
    });

    test('returns error when one result not found', async () => {
      __setClients({ backtestClient: makeMockClient() });

      const mod = await import('../backtest-history.tool.js');
      const result = await mod.default.execute({
        action: 'compare',
        ids: ['bt-001', 'bt-missing'],
      }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.error).toContain('Results not found');
      expect(parsed.data.error).toContain('bt-missing');
    });
  });
});
