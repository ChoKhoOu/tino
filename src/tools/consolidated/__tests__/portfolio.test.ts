import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import type { PortfolioClient } from '@/grpc/portfolio-client.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

async function getSetClients() {
  const mod = await import('../../portfolio/grpc-clients.js');
  return mod.__setClients;
}

describe('portfolio consolidated tool', () => {
  afterEach(async () => {
    const setClients = await getSetClients();
    setClients({ portfolioClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/portfolio.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('portfolio');
    expect(plugin.domain).toBe('portfolio');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('summary action', () => {
    test('returns portfolio summary', async () => {
      const mockClient = {
        getSummary: async () => ({
          totalTrades: 42,
          openPositions: 3,
          totalRealizedPnl: 1500.5,
          totalUnrealizedPnl: 250.0,
          totalFees: 84.0,
        }),
      } as unknown as PortfolioClient;

      const setClients = await getSetClients();
      setClients({ portfolioClient: mockClient });

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute({ action: 'summary' }, makeCtx());

      const parsed = JSON.parse(result);
      expect(parsed.data.totalTrades).toBe(42);
      expect(parsed.data.openPositions).toBe(3);
      expect(parsed.data.totalRealizedPnl).toBe(1500.5);
      expect(parsed.data.totalFees).toBe(84.0);
    });
  });

  describe('trades action', () => {
    test('returns trade history with filters', async () => {
      const mockClient = {
        getTrades: async () => ({
          trades: [
            {
              id: 't-1',
              instrument: 'AAPL',
              side: 'BUY',
              quantity: 100,
              price: 150.0,
              fee: 1.0,
              venue: 'SIM',
              timestamp: '2024-01-15T10:00:00Z',
              orderId: 'o-1',
              strategy: 'momentum',
            },
          ],
        }),
      } as unknown as PortfolioClient;

      const setClients = await getSetClients();
      setClients({ portfolioClient: mockClient });

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'trades', instrument: 'AAPL', limit: 10 },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.trades).toHaveLength(1);
      expect(parsed.data.trades[0].instrument).toBe('AAPL');
      expect(parsed.data.trades[0].side).toBe('BUY');
    });
  });

  describe('positions action', () => {
    test('returns current positions', async () => {
      const mockClient = {
        getPositions: async () => ({
          positions: [
            {
              instrument: 'AAPL',
              quantity: 100,
              avgPrice: 150.5,
              unrealizedPnl: 250.0,
              realizedPnl: 100.0,
              updatedAt: '2024-01-15T10:00:00Z',
            },
          ],
        }),
      } as unknown as PortfolioClient;

      const setClients = await getSetClients();
      setClients({ portfolioClient: mockClient });

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'positions', instrument: 'AAPL' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.totalPositions).toBe(1);
      expect(parsed.data.positions[0].instrument).toBe('AAPL');
      expect(parsed.data.positions[0].avgPrice).toBe(150.5);
    });
  });

  describe('pnl_history action', () => {
    test('returns PnL history entries', async () => {
      const mockClient = {
        getPnLHistory: async () => ({
          entries: [
            {
              date: '2024-01-15',
              instrument: 'AAPL',
              totalPnl: 350.0,
              realizedPnl: 100.0,
              unrealizedPnl: 250.0,
            },
            {
              date: '2024-01-16',
              instrument: 'AAPL',
              totalPnl: 400.0,
              realizedPnl: 150.0,
              unrealizedPnl: 250.0,
            },
          ],
        }),
      } as unknown as PortfolioClient;

      const setClients = await getSetClients();
      setClients({ portfolioClient: mockClient });

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        {
          action: 'pnl_history',
          instrument: 'AAPL',
          start_date: '2024-01-15',
          end_date: '2024-01-16',
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.entries).toHaveLength(2);
      expect(parsed.data.entries[0].date).toBe('2024-01-15');
      expect(parsed.data.entries[1].totalPnl).toBe(400.0);
    });
  });
});
