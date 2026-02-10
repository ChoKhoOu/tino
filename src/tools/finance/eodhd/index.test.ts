import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getHkStockPrice, getHkStockHistory, getHkFundamentals } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('EODHD client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => { process.env.EODHD_API_KEY = 'test-eodhd-key'; });
  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getHkStockPrice returns normalized HkStockPrice', async () => {
    const mockData = {
      code: '0700.HK',
      timestamp: 1700000000,
      gmtoffset: 28800,
      open: 320.0,
      high: 325.0,
      low: 318.0,
      close: 322.5,
      volume: 15000000,
      previousClose: 319.0,
      change: 3.5,
      change_p: 1.097,
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/real-time/0700.HK');
      expect(urlStr).toContain('api_token=test-eodhd-key');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getHkStockPrice('700');
    expect(result.ticker).toBe('0700.HK');
    expect(result.price).toBe(322.5);
    expect(result.change).toBe(3.5);
    expect(result.changePercent).toBe(1.097);
    expect(result.volume).toBe(15000000);
    expect(result.currency).toBe('HKD');
  });

  test('getHkStockHistory returns historical OHLCV data', async () => {
    const mockData = [
      { date: '2024-01-02', open: 300.0, high: 305.0, low: 298.0, close: 303.0, adjusted_close: 303.0, volume: 12000000 },
      { date: '2024-01-03', open: 303.0, high: 310.0, low: 301.0, close: 308.0, adjusted_close: 308.0, volume: 14000000 },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/eod/0700.HK');
      expect(urlStr).toContain('from=2024-01-01');
      expect(urlStr).toContain('to=2024-01-03');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getHkStockHistory('0700.HK', '2024-01-01', '2024-01-03');
    expect(result).toHaveLength(2);
    expect(result[0]!.close).toBe(303.0);
    expect(result[1]!.volume).toBe(14000000);
  });

  test('getHkFundamentals returns company data', async () => {
    const mockData = {
      General: {
        Code: '0700',
        Name: 'Tencent Holdings Ltd',
        Exchange: 'HKEX',
        CurrencyCode: 'HKD',
        CurrencyName: 'Hong Kong Dollar',
        CountryName: 'Hong Kong',
        Sector: 'Technology',
        Industry: 'Internet Content & Information',
        Description: 'Tencent Holdings Limited provides...',
      },
      Highlights: {
        MarketCapitalization: 3500000000000,
        EBITDA: 200000000000,
        PERatio: 25.5,
        PEGRatio: 1.2,
        DividendYield: 0.8,
        EarningsShare: 12.5,
        BookValue: 80.0,
        RevenueTTM: 600000000000,
        ProfitMargin: 0.25,
      },
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/fundamentals/0700.HK');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getHkFundamentals('0700.HK');
    expect(result.General.Name).toBe('Tencent Holdings Ltd');
    expect(result.General.Exchange).toBe('HKEX');
    expect(result.Highlights.MarketCapitalization).toBe(3500000000000);
    expect(result.Highlights.PERatio).toBe(25.5);
  });

  test('throws when EODHD_API_KEY is missing', async () => {
    delete process.env.EODHD_API_KEY;
    await expect(getHkStockPrice('0700.HK')).rejects.toThrow('Missing API key');
  });

  test('getHkStockPrice normalizes short ticker', async () => {
    const mockData = {
      code: '9988.HK',
      timestamp: 1700000000,
      gmtoffset: 28800,
      open: 80.0,
      high: 82.0,
      low: 79.0,
      close: 81.5,
      volume: 20000000,
      previousClose: 80.0,
      change: 1.5,
      change_p: 1.875,
    };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getHkStockPrice('9988');
    expect(result.ticker).toBe('9988.HK');
    expect(result.price).toBe(81.5);
  });
});
