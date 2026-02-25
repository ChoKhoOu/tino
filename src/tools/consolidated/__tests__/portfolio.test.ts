import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import type { PortfolioClient } from '@/grpc/portfolio-client.js';
import type { ExchangeClient } from '@/grpc/exchange-client.js';
import type { GrpcClients } from '@/domain/tool-plugin.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

function makeCtxWithExchange(exchangeClient: ExchangeClient): ToolContext {
  return makeCtx({
    grpc: { exchange: exchangeClient } as unknown as GrpcClients,
  });
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

  describe('cross_exchange_summary action', () => {
    test('aggregates balances across exchanges', async () => {
      const mockExchangeClient = {
        getAccountBalance: async (exchange: string) => {
          if (exchange === 'binance') {
            return {
              balances: [
                { asset: 'USDT', free: 5000, locked: 1000, total: 6000 },
                { asset: 'BTC', free: 0.5, locked: 0, total: 0.5 },
              ],
            };
          }
          if (exchange === 'okx') {
            return {
              balances: [
                { asset: 'USDT', free: 3000, locked: 500, total: 3500 },
                { asset: 'ETH', free: 2.0, locked: 0, total: 2.0 },
              ],
            };
          }
          return { balances: [] };
        },
      } as unknown as ExchangeClient;

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'cross_exchange_summary' },
        makeCtxWithExchange(mockExchangeClient),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.exchangesQueried).toBe(4);
      expect(parsed.data.exchangesSucceeded).toBe(4);
      expect(parsed.data.totalUsdtValue).toBe(9500);
      expect(parsed.data.exchangeBalances).toHaveLength(4);

      const binance = parsed.data.exchangeBalances.find(
        (e: { exchange: string }) => e.exchange === 'binance',
      );
      expect(binance.totalUsdtValue).toBe(6000);

      const usdtAgg = parsed.data.aggregatedAssets.find(
        (a: { asset: string }) => a.asset === 'USDT',
      );
      expect(usdtAgg.total).toBe(9500);

      expect(parsed.data.distribution).toHaveLength(4);
      const binanceDist = parsed.data.distribution.find(
        (d: { exchange: string }) => d.exchange === 'binance',
      );
      expect(binanceDist.percentage).toBeCloseTo(63.16, 1);
    });

    test('handles exchange errors gracefully', async () => {
      const mockExchangeClient = {
        getAccountBalance: async (exchange: string) => {
          if (exchange === 'binance') {
            return {
              balances: [
                { asset: 'USDT', free: 10000, locked: 0, total: 10000 },
              ],
            };
          }
          throw new Error(`${exchange} API key not configured`);
        },
      } as unknown as ExchangeClient;

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'cross_exchange_summary' },
        makeCtxWithExchange(mockExchangeClient),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.exchangesSucceeded).toBe(1);
      expect(parsed.data.errors).toHaveLength(3);
      expect(parsed.data.totalUsdtValue).toBe(10000);
    });
  });

  describe('cross_exchange_positions action', () => {
    test('aggregates positions across exchanges', async () => {
      const mockExchangeClient = {
        getExchangePositions: async (exchange: string) => {
          if (exchange === 'binance') {
            return {
              positions: [
                {
                  symbol: 'BTCUSDT',
                  side: 'LONG',
                  quantity: 0.1,
                  entryPrice: 60000,
                  unrealizedPnl: 500,
                  leverage: 10,
                  markPrice: 65000,
                  liquidationPrice: 54000,
                  marginType: 'cross',
                },
              ],
            };
          }
          if (exchange === 'bybit') {
            return {
              positions: [
                {
                  symbol: 'ETHUSDT',
                  side: 'SHORT',
                  quantity: 1.0,
                  entryPrice: 3500,
                  unrealizedPnl: -100,
                  leverage: 5,
                  markPrice: 3600,
                  liquidationPrice: 4200,
                  marginType: 'isolated',
                },
              ],
            };
          }
          return { positions: [] };
        },
      } as unknown as ExchangeClient;

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'cross_exchange_positions' },
        makeCtxWithExchange(mockExchangeClient),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.totalPositions).toBe(2);
      expect(parsed.data.totalUnrealizedPnl).toBe(400);
      expect(parsed.data.exchangesQueried).toBe(4);
      expect(parsed.data.exchangesSucceeded).toBe(4);

      const btcPos = parsed.data.positions.find(
        (p: { symbol: string }) => p.symbol === 'BTCUSDT',
      );
      expect(btcPos.exchange).toBe('binance');
      expect(btcPos.side).toBe('LONG');
      expect(btcPos.unrealizedPnl).toBe(500);

      const ethPos = parsed.data.positions.find(
        (p: { symbol: string }) => p.symbol === 'ETHUSDT',
      );
      expect(ethPos.exchange).toBe('bybit');
      expect(ethPos.side).toBe('SHORT');
    });

    test('handles exchange errors gracefully', async () => {
      const mockExchangeClient = {
        getExchangePositions: async (exchange: string) => {
          if (exchange === 'okx') {
            return {
              positions: [
                {
                  symbol: 'BTCUSDT',
                  side: 'LONG',
                  quantity: 0.5,
                  entryPrice: 62000,
                  unrealizedPnl: 1500,
                  leverage: 3,
                  markPrice: 65000,
                  liquidationPrice: 42000,
                  marginType: 'cross',
                },
              ],
            };
          }
          throw new Error(`${exchange} connection failed`);
        },
      } as unknown as ExchangeClient;

      const mod = await import('../../consolidated/portfolio.tool.js');
      const result = await mod.default.execute(
        { action: 'cross_exchange_positions' },
        makeCtxWithExchange(mockExchangeClient),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.totalPositions).toBe(1);
      expect(parsed.data.totalUnrealizedPnl).toBe(1500);
      expect(parsed.data.exchangesSucceeded).toBe(1);
      expect(parsed.data.errors).toHaveLength(3);
    });
  });
});
