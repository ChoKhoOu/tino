import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import type { StreamingClient } from '@/grpc/streaming-client.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

async function getSetClients() {
  const mod = await import('../../streaming/grpc-clients.js');
  return mod.__setClients;
}

describe('streaming consolidated tool', () => {
  afterEach(async () => {
    const setClients = await getSetClients();
    setClients({ streamingClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/streaming.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('streaming');
    expect(plugin.domain).toBe('streaming');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('subscribe action', () => {
    test('collects initial events and returns summary', async () => {
      async function* fakeSubscribe() {
        yield {
          type: 1, // QUOTE
          instrument: 'AAPL',
          dataJson: JSON.stringify({ bid: 150.0, ask: 150.5 }),
          timestamp: '2024-01-15T10:00:00Z',
          source: 'polygon',
        };
        yield {
          type: 2, // TRADE
          instrument: 'AAPL',
          dataJson: JSON.stringify({ price: 150.25, size: 100 }),
          timestamp: '2024-01-15T10:00:01Z',
          source: 'polygon',
        };
      }

      const mockClient = {
        subscribe: fakeSubscribe,
      } as unknown as StreamingClient;

      const setClients = await getSetClients();
      setClients({ streamingClient: mockClient });

      const mod = await import('../../consolidated/streaming.tool.js');
      const result = await mod.default.execute(
        { action: 'subscribe', instrument: 'AAPL', source: 'polygon', event_type: 'quote' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.status).toBe('subscribed');
      expect(parsed.data.instrument).toBe('AAPL');
      expect(parsed.data.events).toHaveLength(2);
    });
  });

  describe('unsubscribe action', () => {
    test('unsubscribes from instrument stream', async () => {
      const mockClient = {
        unsubscribe: async () => ({ success: true }),
      } as unknown as StreamingClient;

      const setClients = await getSetClients();
      setClients({ streamingClient: mockClient });

      const mod = await import('../../consolidated/streaming.tool.js');
      const result = await mod.default.execute(
        { action: 'unsubscribe', instrument: 'AAPL', source: 'polygon' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.success).toBe(true);
      expect(parsed.data.instrument).toBe('AAPL');
    });
  });

  describe('list_subscriptions action', () => {
    test('returns active subscriptions', async () => {
      const mockClient = {
        listSubscriptions: async () => ({
          subscriptions: [
            { instrument: 'AAPL', source: 'polygon', eventType: 'quote' },
            { instrument: 'BTCUSD', source: 'coinbase', eventType: 'trade' },
          ],
        }),
      } as unknown as StreamingClient;

      const setClients = await getSetClients();
      setClients({ streamingClient: mockClient });

      const mod = await import('../../consolidated/streaming.tool.js');
      const result = await mod.default.execute(
        { action: 'list_subscriptions' },
        makeCtx(),
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.subscriptions).toHaveLength(2);
      expect(parsed.data.subscriptions[0].instrument).toBe('AAPL');
      expect(parsed.data.subscriptions[1].source).toBe('coinbase');
    });
  });
});
