import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { rmSync, readdirSync, existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clearTestCache(): void {
  const cacheDir = '.tino/cache';
  if (!existsSync(cacheDir)) return;
  for (const entry of readdirSync(cacheDir)) {
    const entryPath = join(cacheDir, entry);
    if (entry.includes('ZZZ') || entry.includes('zzz')) {
      rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    if (!statSync(entryPath).isDirectory()) continue;
    for (const file of readdirSync(entryPath)) {
      const content = readFileSync(join(entryPath, file), 'utf-8');
      if (content.includes('ZZZ') || content.includes('zzz')) {
        rmSync(join(entryPath, file), { force: true });
      }
    }
  }
}

const stubCtx = {
  signal: AbortSignal.timeout(30_000),
  onProgress: () => {},
  config: {},
};

describe('market_data consolidated tool', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    clearTestCache();
    process.env.FINANCIAL_DATASETS_API_KEY = 'test-fd-key';
    process.env.POLYGON_API_KEY = 'test-polygon-key';
    process.env.FMP_API_KEY = 'test-fmp-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  async function executeAction(params: Record<string, unknown>): Promise<string> {
    const mod = await import('../../consolidated/market-data.tool.js');
    return mod.default.execute(params, stubCtx);
  }

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/market-data.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('market_data');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('prices action', () => {
    test('routes to Financial Datasets when FD key is available', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ prices: [{ date: '2024-01-02', close: 150 }] });
      });

      const result = await executeAction({
        action: 'prices',
        symbol: 'ZZZPRC',
        from: '2024-06-01',
        to: '2024-06-30',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('financialdatasets.ai');
      expect(parsed.data).toBeDefined();
    });

    test('falls back to FMP when FD key is missing', async () => {
      delete process.env.FINANCIAL_DATASETS_API_KEY;
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ historical: [{ date: '2024-01-02', close: 150 }] });
      });

      const result = await executeAction({
        action: 'prices',
        symbol: 'ZZZFMP',
        from: '2024-06-01',
        to: '2024-06-30',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('financialmodelingprep.com');
      expect(parsed.data).toBeDefined();
    });

    test('returns error when both FD and FMP keys are missing', async () => {
      delete process.env.FINANCIAL_DATASETS_API_KEY;
      delete process.env.FMP_API_KEY;

      const result = await executeAction({
        action: 'prices',
        symbol: 'AAPL',
        from: '2024-01-01',
        to: '2024-01-31',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('API key');
    });
  });

  describe('bars action', () => {
    test('routes to Polygon getPolygonBars', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ results: [{ o: 150, h: 155, l: 149, c: 153, v: 1000 }] });
      });

      const result = await executeAction({
        action: 'bars',
        symbol: 'ZZZBAR',
        from: '2024-06-01',
        to: '2024-06-30',
        timespan: 'day',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.polygon.io');
      expect(calledUrl).toContain('/v2/aggs/ticker/ZZZBAR/range/');
      expect(parsed.data).toBeDefined();
    });

    test('accepts multiplier parameter', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ results: [] });
      });

      await executeAction({
        action: 'bars',
        symbol: 'ZZZMUL',
        from: '2024-06-01',
        to: '2024-06-30',
        timespan: 'hour',
        multiplier: 4,
      });

      expect(calledUrl).toContain('/range/4/hour/');
    });
  });

  describe('snapshot action', () => {
    test('routes to Polygon getPolygonSnapshot', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ ticker: { day: { o: 150 } } });
      });

      const result = await executeAction({
        action: 'snapshot',
        symbol: 'AAPL',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.polygon.io');
      expect(calledUrl).toContain('/v2/snapshot/');
      expect(parsed.data).toBeDefined();
    });
  });

  describe('options_chain action', () => {
    test('routes to Polygon getPolygonOptionsChain', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ results: [{ ticker: 'O:ZZZOPT240119C00150000' }] });
      });

      const result = await executeAction({
        action: 'options_chain',
        symbol: 'ZZZOPT',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.polygon.io');
      expect(calledUrl).toContain('/v3/reference/options/contracts');
      expect(parsed.data).toBeDefined();
    });

    test('passes expiration_date parameter', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ results: [] });
      });

      await executeAction({
        action: 'options_chain',
        symbol: 'ZZZEXP',
        expiration_date: '2024-03-15',
      });

      expect(calledUrl).toContain('expiration_date=2024-03-15');
    });
  });

  describe('ticker_details action', () => {
    test('routes to Polygon getPolygonTicker', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ results: { ticker: 'ZZZTEST', name: 'Test Corp' } });
      });

      const result = await executeAction({
        action: 'ticker_details',
        symbol: 'ZZZTEST',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.polygon.io');
      expect(calledUrl).toContain('/v3/reference/tickers/ZZZTEST');
      expect(parsed.data).toBeDefined();
    });
  });

  describe('crypto_price action', () => {
    test('routes to CoinGecko (no API key required)', async () => {
      delete process.env.FINANCIAL_DATASETS_API_KEY;
      delete process.env.POLYGON_API_KEY;
      delete process.env.FMP_API_KEY;

      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ bitcoin: { usd: 65000 } });
      });

      const result = await executeAction({
        action: 'crypto_price',
        symbol: 'bitcoin',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.coingecko.com');
      expect(calledUrl).toContain('/simple/price');
      expect(parsed.data).toBeDefined();
    });

    test('respects vs_currency parameter', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ bitcoin: { eur: 60000 } });
      });

      await executeAction({
        action: 'crypto_price',
        symbol: 'bitcoin',
        vs_currency: 'eur',
      });

      expect(calledUrl).toContain('vs_currencies=eur');
    });
  });

  describe('crypto_market_data action', () => {
    test('routes to CoinGecko getCoinMarketData', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ id: 'bitcoin', market_cap_rank: 1 });
      });

      const result = await executeAction({
        action: 'crypto_market_data',
        symbol: 'bitcoin',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.coingecko.com');
      expect(calledUrl).toContain('/coins/bitcoin');
      expect(parsed.data).toBeDefined();
    });
  });

  describe('crypto_top_coins action', () => {
    test('routes to CoinGecko getTopCoins', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse([{ id: 'bitcoin', market_cap_rank: 1 }]);
      });

      const result = await executeAction({
        action: 'crypto_top_coins',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.coingecko.com');
      expect(calledUrl).toContain('/coins/markets');
      expect(parsed.data).toBeDefined();
    });

    test('passes limit parameter', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse([]);
      });

      await executeAction({
        action: 'crypto_top_coins',
        limit: 10,
      });

      expect(calledUrl).toContain('per_page=10');
    });
  });

  describe('crypto_history action', () => {
    test('routes to CoinGecko getCoinHistory', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ prices: [[1704067200000, 65000]] });
      });

      const result = await executeAction({
        action: 'crypto_history',
        symbol: 'zzztestcoin',
        from: '2024-01-01',
        to: '2024-01-31',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.coingecko.com');
      expect(calledUrl).toContain('/coins/zzztestcoin/market_chart/range');
      expect(parsed.data).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('requires symbol for symbol-based actions', async () => {
      const result = await executeAction({
        action: 'bars',
        from: '2024-01-01',
        to: '2024-01-31',
        timespan: 'day',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });
});
