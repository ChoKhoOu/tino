import { describe, test, expect, afterEach } from 'bun:test';
import { getCoinPrice, getCoinMarketData, getTopCoins } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('CoinGecko client', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => { globalThis.fetch = originalFetch; process.env = { ...ORIGINAL_ENV }; });

  test('getCoinPrice returns price data', async () => {
    const mockData = { bitcoin: { usd: 97500.0, last_updated_at: 1706745600 } };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('simple/price');
      expect(urlStr).toContain('ids=bitcoin');
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getCoinPrice('bitcoin');
    expect(result.bitcoin).toBeDefined();
    expect(result.bitcoin!.usd).toBe(97500.0);
  });

  test('works without API key (free tier)', async () => {
    delete process.env.COINGECKO_API_KEY;
    const mockData = { bitcoin: { usd: 97500.0 } };
    mockFetch(async (_url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['x-cg-demo-api-key']).toBeUndefined();
      return new Response(JSON.stringify(mockData), { status: 200 });
    });
    const result = await getCoinPrice('bitcoin');
    expect(result.bitcoin!.usd).toBe(97500.0);
  });

  test('getCoinMarketData returns detailed market data', async () => {
    const mockData = { id: 'ethereum', symbol: 'eth', name: 'Ethereum', market_cap_rank: 2, market_data: { current_price: { usd: 3200 }, market_cap: { usd: 385000000000 }, total_volume: { usd: 15000000000 }, circulating_supply: 120000000, total_supply: null, max_supply: null, price_change_percentage_24h: 2.5, price_change_percentage_7d: -1.2, price_change_percentage_30d: 8.3 } };
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getCoinMarketData('ethereum');
    expect(result.symbol).toBe('eth');
    expect(result.market_data.current_price.usd).toBe(3200);
  });

  test('getTopCoins returns ranked coins', async () => {
    const mockData = [
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: '', current_price: 97500, market_cap: 1900000000000, market_cap_rank: 1, total_volume: 30000000000, price_change_percentage_24h: 1.5 },
      { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: '', current_price: 3200, market_cap: 385000000000, market_cap_rank: 2, total_volume: 15000000000, price_change_percentage_24h: 2.5 },
    ];
    mockFetch(async () => new Response(JSON.stringify(mockData), { status: 200 }));
    const result = await getTopCoins(2);
    expect(result).toHaveLength(2);
    expect(result[0]!.symbol).toBe('btc');
  });
});
