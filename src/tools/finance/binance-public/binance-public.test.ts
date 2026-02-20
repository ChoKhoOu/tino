import { describe, test, expect, afterEach } from 'bun:test';
import { getKlines, getTicker24h } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('Binance public client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  test('getKlines returns parsed kline data', async () => {
    const rawKline = [
      1704067200000, "42000.00", "42500.00", "41800.00", "42300.00",
      "1500.5", 1704153599999, "63000000.00", 12000,
      "800.2", "33600000.00", "0",
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/klines');
      expect(urlStr).toContain('symbol=BTCUSDT');
      expect(urlStr).toContain('interval=1h');
      return new Response(JSON.stringify([rawKline]), { status: 200 });
    });

    const result = await getKlines('BTCUSDT', '1h');
    expect(result).toHaveLength(1);
    expect(result[0]!.open).toBe('42000.00');
    expect(result[0]!.close).toBe('42300.00');
    expect(result[0]!.numberOfTrades).toBe(12000);
  });

  test('getTicker24h returns ticker data for symbol', async () => {
    const mockData = {
      symbol: 'BTCUSDT',
      priceChange: '500.00',
      priceChangePercent: '1.2',
      weightedAvgPrice: '42100.00',
      prevClosePrice: '41800.00',
      lastPrice: '42300.00',
      lastQty: '0.5',
      bidPrice: '42290.00',
      bidQty: '2.0',
      askPrice: '42310.00',
      askQty: '1.5',
      openPrice: '41800.00',
      highPrice: '42500.00',
      lowPrice: '41700.00',
      volume: '25000.00',
      quoteVolume: '1050000000.00',
      openTime: 1704067200000,
      closeTime: 1704153599999,
      firstId: 1,
      lastId: 50000,
      count: 50000,
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('symbol=BTCUSDT');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });

    const result = await getTicker24h('BTCUSDT');
    expect(Array.isArray(result)).toBe(false);
    const ticker = result as typeof mockData;
    expect(ticker.symbol).toBe('BTCUSDT');
    expect(ticker.lastPrice).toBe('42300.00');
  });

  test('getKlines uppercases symbol', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('symbol=ETHUSDT');
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const result = await getKlines('ethusdt', '1d');
    expect(result).toHaveLength(0);
  });
});
