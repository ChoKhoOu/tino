import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getFinnhubNews, getFinnhubCompanyNews, getFinnhubEarningsCalendar, getFinnhubInsiderTransactions } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('Finnhub client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => { process.env.FINNHUB_API_KEY = 'test-finnhub-key'; });
  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getFinnhubNews returns market news', async () => {
    const mockData = [{ category: 'general', datetime: 1706745600, headline: 'Markets Rally on Strong Earnings', id: 12345, image: 'https://example.com/img.jpg', related: '', source: 'MarketWatch', summary: 'US markets rallied...', url: 'https://example.com/article' }];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/news');
      expect(urlStr).toContain('token=test-finnhub-key');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getFinnhubNews('general');
    expect(result).toHaveLength(1);
    expect(result[0]!.headline).toContain('Markets Rally');
  });

  test('throws when FINNHUB_API_KEY is missing', async () => {
    delete process.env.FINNHUB_API_KEY;
    await expect(getFinnhubNews()).rejects.toThrow('Missing API key');
  });

  test('getFinnhubCompanyNews returns company-specific news', async () => {
    const mockData = [{ category: 'company', datetime: 1706745600, headline: 'Apple Reports Q1 Earnings', id: 67890, image: '', related: 'AAPL', source: 'Reuters', summary: 'Apple reported...', url: 'https://example.com/aapl' }];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('symbol=AAPL');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getFinnhubCompanyNews('AAPL', '2024-01-01', '2024-01-31');
    expect(result).toHaveLength(1);
    expect(result[0]!.related).toBe('AAPL');
  });

  test('getFinnhubEarningsCalendar returns earnings events', async () => {
    const mockData = { earningsCalendar: [{ date: '2024-01-25', epsActual: 2.18, epsEstimate: 2.11, hour: 'amc', quarter: 1, revenueActual: 119575000000, revenueEstimate: 117870000000, symbol: 'AAPL', year: 2024 }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getFinnhubEarningsCalendar('2024-01-01', '2024-02-01');
    expect(result).toHaveLength(1);
    expect(result[0]!.symbol).toBe('AAPL');
    expect(result[0]!.epsActual).toBe(2.18);
  });

  test('getFinnhubInsiderTransactions returns insider data', async () => {
    const mockData = { symbol: 'AAPL', data: [{ symbol: 'AAPL', name: 'Tim Cook', share: 1000000, change: -50000, filingDate: '2024-01-15', transactionDate: '2024-01-12', transactionCode: 'S', transactionPrice: 185.5 }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getFinnhubInsiderTransactions('AAPL');
    expect(result.symbol).toBe('AAPL');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe('Tim Cook');
  });
});
