import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import { __setClients } from '../../trading/grpc-clients.js';
import type { TradingClient } from '@/grpc/trading-client.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

describe('trading_live consolidated tool', () => {
  afterEach(() => {
    __setClients({ backtestClient: null, tradingClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/trading-live.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('trading_live');
    expect(plugin.domain).toBe('trading');
    expect(plugin.riskLevel).toBe('dangerous');
    expect(plugin.schema).toBeDefined();
  });

  describe('submit_order action — safety gate', () => {
    test('REFUSES when confirmed is false — NO gRPC call made', async () => {
      let grpcCalled = false;
      const mockTradingClient = {
        submitOrder: async () => {
          grpcCalled = true;
          return { orderId: 'ord-1', success: true };
        },
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'AAPL', side: 'buy', type: 'market', quantity: 100 },
          confirmed: false,
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('refused');
      expect(parsed.data.error).toBeDefined();
      expect(grpcCalled).toBe(false);
    });

    test('REFUSES when confirmed is not provided — NO gRPC call made', async () => {
      let grpcCalled = false;
      const mockTradingClient = {
        submitOrder: async () => {
          grpcCalled = true;
          return { orderId: 'ord-1', success: true };
        },
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'AAPL', side: 'buy', type: 'market', quantity: 100 },
          confirmed: false,
        },
        makeCtx(),
      );

      expect(grpcCalled).toBe(false);
    });

    test('PROCEEDS when confirmed is true', async () => {
      const mockTradingClient = {
        submitOrder: async () => ({ orderId: 'ord-123', success: true }),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'AAPL', side: 'buy', type: 'market', quantity: 100 },
          confirmed: true,
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).not.toBe('refused');
      expect(parsed.data.orderId).toBe('ord-123');
      expect(parsed.data.success).toBe(true);
    });

    test('venue parameter is optional and defaults to SIM', async () => {
      const mockTradingClient = {
        submitOrder: async () => ({ orderId: 'ord-456', success: true }),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'AAPL', side: 'buy', type: 'market', quantity: 100 },
          confirmed: true,
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('submitted');
      expect(parsed.data.venue).toBe('SIM');
    });

    test('accepts venue=BINANCE and includes it in response', async () => {
      const mockTradingClient = {
        submitOrder: async () => ({ orderId: 'ord-789', success: true }),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1 },
          confirmed: true,
          venue: 'BINANCE',
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('submitted');
      expect(parsed.data.venue).toBe('BINANCE');
    });

    test('confirmed=true still required regardless of venue', async () => {
      let grpcCalled = false;
      const mockTradingClient = {
        submitOrder: async () => {
          grpcCalled = true;
          return { orderId: 'ord-1', success: true };
        },
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        {
          action: 'submit_order',
          order: { instrument: 'BTCUSDT', side: 'buy', type: 'market', quantity: 0.1 },
          confirmed: false,
          venue: 'BINANCE',
        },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('refused');
      expect(grpcCalled).toBe(false);
    });
  });

  describe('kill_switch action', () => {
    test('executes regardless of confirmed=false', async () => {
      let stopCalled = false;
      const mockTradingClient = {
        stopTrading: async () => {
          stopCalled = true;
          return { success: true };
        },
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        { action: 'kill_switch', confirmed: false },
        makeCtx(),
      );

      expect(stopCalled).toBe(true);
      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('stopped');
      expect(parsed.data.success).toBe(true);
    });

    test('executes with confirmed=true', async () => {
      let stopCalled = false;
      const mockTradingClient = {
        stopTrading: async () => {
          stopCalled = true;
          return { success: true };
        },
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        { action: 'kill_switch', confirmed: true },
        makeCtx(),
      );

      expect(stopCalled).toBe(true);
      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('stopped');
    });

    test('reports failure status when stop fails', async () => {
      const mockTradingClient = {
        stopTrading: async () => ({ success: false }),
      } as unknown as TradingClient;

      __setClients({ tradingClient: mockTradingClient });

      const mod = await import('../../consolidated/trading-live.tool.js');
      const result = await mod.default.execute(
        { action: 'kill_switch', confirmed: true },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('failed');
    });
  });
});
