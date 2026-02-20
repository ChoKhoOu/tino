import { describe, test, expect, afterEach } from 'bun:test';
import { getCurrentFundingRates, getHistoricalFundingRates } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('Binance funding rates client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  test('getCurrentFundingRates returns parsed entries for default symbols', async () => {
    const mockData = [
      { symbol: 'BTCUSDT', fundingRate: '0.00010000', fundingTime: 1706745600000, markPrice: '97500.00' },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('fundingRate');
      expect(urlStr).toContain('limit=1');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });

    const results = await getCurrentFundingRates(['BTCUSDT']);
    expect(results).toHaveLength(1);
    expect(results[0]!.symbol).toBe('BTCUSDT');
    expect(results[0]!.fundingRate).toBe(0.0001);
    expect(results[0]!.markPrice).toBe(97500);
    expect(results[0]!.fundingTime).toBe(1706745600000);
  });

  test('getCurrentFundingRates skips symbols with empty response', async () => {
    let callCount = 0;
    mockFetch(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify([
          { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingTime: 1706745600000, markPrice: '97500' },
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const results = await getCurrentFundingRates(['BTCUSDT', 'FAKECOIN']);
    expect(results).toHaveLength(1);
    expect(results[0]!.symbol).toBe('BTCUSDT');
  });

  test('getHistoricalFundingRates returns parsed time series', async () => {
    const mockData = [
      { symbol: 'ETHUSDT', fundingRate: '0.00050000', fundingTime: 1706659200000, markPrice: '3200.00' },
      { symbol: 'ETHUSDT', fundingRate: '-0.00020000', fundingTime: 1706745600000, markPrice: '3150.00' },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('symbol=ETHUSDT');
      expect(urlStr).toContain('startTime=');
      expect(urlStr).toContain('endTime=');
      expect(urlStr).toContain('limit=1000');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });

    const start = 1706659200000;
    const end = 1706745600000;
    const results = await getHistoricalFundingRates('ETHUSDT', start, end);
    expect(results).toHaveLength(2);
    expect(results[0]!.fundingRate).toBe(0.0005);
    expect(results[1]!.fundingRate).toBe(-0.0002);
    expect(results[1]!.markPrice).toBe(3150);
  });

  test('fundingRate string values are correctly parsed to numbers', async () => {
    const mockData = [
      { symbol: 'SOLUSDT', fundingRate: '-0.00030000', fundingTime: 1706745600000, markPrice: '105.50' },
    ];
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));

    const results = await getCurrentFundingRates(['SOLUSDT']);
    expect(results[0]!.fundingRate).toBe(-0.0003);
    expect(typeof results[0]!.fundingRate).toBe('number');
    expect(typeof results[0]!.markPrice).toBe('number');
  });
});
