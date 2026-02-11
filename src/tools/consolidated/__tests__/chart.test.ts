import { describe, test, expect, afterEach } from 'bun:test';
import type { ToolContext } from '@/domain/tool-plugin.js';
import type { ChartClient } from '@/grpc/chart-client.js';

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: AbortSignal.timeout(5_000),
    onProgress: () => {},
    config: {},
    ...overrides,
  };
}

async function getSetClients() {
  const mod = await import('../../chart/grpc-clients.js');
  return mod.__setClients;
}

describe('chart consolidated tool', () => {
  afterEach(async () => {
    const setClients = await getSetClients();
    setClients({ chartClient: null });
  });

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/chart.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('chart');
    expect(plugin.domain).toBe('chart');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('candlestick action', () => {
    test('returns ansi chart', async () => {
      const mockClient = {
        renderCandlestick: async () => ({
          ansiChart: 'mock-ansi-chart',
        }),
      } as unknown as ChartClient;

      const setClients = await getSetClients();
      setClients({ chartClient: mockClient });

      const mod = await import('../../consolidated/chart.tool.js');
      const result = await mod.default.execute(
        {
          action: 'candlestick',
          dates: ['2024-01-01'],
          open: [100],
          close: [105],
          high: [110],
          low: [95],
        },
        makeCtx()
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.ansiChart).toBe('mock-ansi-chart');
    });
  });

  describe('line_chart action', () => {
    test('returns ansi chart', async () => {
      const mockClient = {
        renderLineChart: async () => ({
          ansiChart: 'mock-line-chart',
        }),
      } as unknown as ChartClient;

      const setClients = await getSetClients();
      setClients({ chartClient: mockClient });

      const mod = await import('../../consolidated/chart.tool.js');
      const result = await mod.default.execute(
        {
          action: 'line_chart',
          labels: ['Jan'],
          values: [100],
        },
        makeCtx()
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.ansiChart).toBe('mock-line-chart');
    });
  });

  describe('subplot action', () => {
    test('returns ansi chart', async () => {
      const mockClient = {
        renderSubplot: async () => ({
          ansiChart: 'mock-subplot-chart',
        }),
      } as unknown as ChartClient;

      const setClients = await getSetClients();
      setClients({ chartClient: mockClient });

      const mod = await import('../../consolidated/chart.tool.js');
      const result = await mod.default.execute(
        {
          action: 'subplot',
          dates: ['2024-01-01'],
          open: [100],
          close: [105],
          high: [110],
          low: [95],
          volume: [1000],
        },
        makeCtx()
      );

      const parsed = JSON.parse(result);
      expect(parsed.data.ansiChart).toBe('mock-subplot-chart');
    });
  });
});
