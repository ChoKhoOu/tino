import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { getPolygonBars, getPolygonTicker, getPolygonOptionsChain } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('Polygon client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => { process.env.POLYGON_API_KEY = 'test-polygon-key'; });
  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getPolygonBars returns OHLCV data', async () => {
    const mockData = { ticker: 'AAPL', queryCount: 2, resultsCount: 2, results: [{ o: 185.0, h: 186.0, l: 184.0, c: 185.5, v: 50000000, vw: 185.2, t: 1704153600000, n: 500000 }, { o: 185.5, h: 187.0, l: 185.0, c: 186.5, v: 48000000, vw: 186.0, t: 1704240000000, n: 480000 }], status: 'OK', adjusted: true };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/v2/aggs/ticker/AAPL/range/1/day/');
      expect(urlStr).toContain('apiKey=test-polygon-key');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getPolygonBars('AAPL', 'day', '2024-01-01', '2024-01-02');
    expect(result.resultsCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.c).toBe(185.5);
  });

  test('throws when POLYGON_API_KEY is missing', async () => {
    delete process.env.POLYGON_API_KEY;
    await expect(getPolygonBars('AAPL', 'day', '2024-01-01', '2024-01-02')).rejects.toThrow('Missing API key');
  });

  test('getPolygonTicker returns ticker details', async () => {
    const mockData = { results: { ticker: 'AAPL', name: 'Apple Inc.', market: 'stocks', locale: 'us', primary_exchange: 'XNAS', type: 'CS', currency_name: 'usd', market_cap: 3000000000000, phone_number: '', address: { address1: 'One Apple Park Way', city: 'Cupertino', state: 'CA' }, description: 'Apple Inc. designs...', sic_code: '3571', sic_description: 'Electronic Computers', total_employees: 164000, list_date: '1980-12-12', homepage_url: 'https://www.apple.com', branding: { logo_url: '', icon_url: '' } } };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getPolygonTicker('AAPL');
    expect(result.name).toBe('Apple Inc.');
    expect(result.market_cap).toBe(3000000000000);
  });

  test('getPolygonOptionsChain returns contracts', async () => {
    const mockData = { results: [{ ticker: 'O:AAPL250117C00200000', underlying_ticker: 'AAPL', contract_type: 'call', expiration_date: '2025-01-17', strike_price: 200, exercise_style: 'american' }] };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getPolygonOptionsChain('AAPL', '2025-01-17');
    expect(result).toHaveLength(1);
    expect(result[0]!.strike_price).toBe(200);
    expect(result[0]!.contract_type).toBe('call');
  });
});
