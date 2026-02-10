import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { rmSync } from 'fs';
import { getFmpIncomeStatement, getFmpDcf, getFmpPrices } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('FMP client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.FMP_API_KEY = 'test-fmp-key';
    rmSync('.tino/cache', { recursive: true, force: true });
  });
  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getFmpIncomeStatement parses response correctly', async () => {
    const mockData = [{ date: '2024-09-28', symbol: 'AAPL', reportedCurrency: 'USD', cik: '0000320193', fillingDate: '2024-11-01', acceptedDate: '2024-11-01', calendarYear: '2024', period: 'FY', revenue: 391035000000, netIncome: 93736000000 }];

    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('income-statement/AAPL');
      expect(urlStr).toContain('apikey=test-fmp-key');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });

    const result = await getFmpIncomeStatement('AAPL', 'annual', 1);
    expect(result).toHaveLength(1);
    expect(result[0]!.symbol).toBe('AAPL');
    expect(result[0]!.revenue).toBe(391035000000);
  });

  test('throws when FMP_API_KEY is missing', async () => {
    delete process.env.FMP_API_KEY;
    await expect(getFmpIncomeStatement('AAPL')).rejects.toThrow('Missing API key');
  });

  test('getFmpDcf returns DCF valuation', async () => {
    const mockData = [{ symbol: 'AAPL', date: '2024-12-01', dcf: 245.5, stockPrice: 230.0 }];
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getFmpDcf('AAPL');
    expect(result[0]!.dcf).toBe(245.5);
    expect(result[0]!.stockPrice).toBe(230.0);
  });

  test('getFmpPrices handles historical wrapper response', async () => {
    const mockData = { symbol: 'AAPL', historical: [{ date: '2024-01-02', open: 185.0, high: 186.0, low: 184.0, close: 185.5, adjClose: 185.5, volume: 50000000, unadjustedVolume: 50000000, change: 0.5, changePercent: 0.27, vwap: 185.2, label: 'Jan 02, 2024', changeOverTime: 0.0027 }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getFmpPrices('AAPL', '2024-01-01', '2024-01-03');
    expect(result).toHaveLength(1);
    expect(result[0]!.close).toBe(185.5);
  });
});
