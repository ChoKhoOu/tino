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
    if (entry.includes('ZZZFRED') || entry.includes('zzzfred')) {
      rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    if (!statSync(entryPath).isDirectory()) continue;
    for (const file of readdirSync(entryPath)) {
      const content = readFileSync(join(entryPath, file), 'utf-8');
      if (content.includes('ZZZFRED') || content.includes('zzzfred')) {
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

describe('macro_data consolidated tool', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    clearTestCache();
    process.env.FRED_API_KEY = 'test-fred-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  async function executeAction(params: Record<string, unknown>): Promise<string> {
    const mod = await import('../../consolidated/macro-data.tool.js');
    return mod.default.execute(params, stubCtx);
  }

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/macro-data.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('macro_data');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('search action', () => {
    test('routes to searchFredSeries', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ seriess: [{ id: 'GDP', title: 'Gross Domestic Product' }] });
      });

      const result = await executeAction({
        action: 'search',
        query: 'zzzfred test query',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.stlouisfed.org/fred/series/search');
      expect(calledUrl).toContain('search_text=zzzfred');
      expect(parsed.data).toBeDefined();
    });

    test('passes limit parameter', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ seriess: [] });
      });

      await executeAction({
        action: 'search',
        query: 'zzzfred unemployment',
        limit: 5,
      });

      expect(calledUrl).toContain('limit=5');
    });

    test('returns error when query is missing', async () => {
      const result = await executeAction({
        action: 'search',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('series action', () => {
    test('routes to getFredSeries', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({
          observations: [{ date: '2024-01-01', value: '27357.0' }],
        });
      });

      const result = await executeAction({
        action: 'series',
        seriesId: 'ZZZFRED1',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.stlouisfed.org/fred/series/observations');
      expect(calledUrl).toContain('series_id=ZZZFRED1');
      expect(parsed.data).toBeDefined();
    });

    test('passes date range parameters', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({ observations: [] });
      });

      await executeAction({
        action: 'series',
        seriesId: 'ZZZFRED',
        startDate: '2020-01-01',
        endDate: '2020-12-31',
      });

      expect(calledUrl).toContain('observation_start=2020-01-01');
      expect(calledUrl).toContain('observation_end=2020-12-31');
    });

    test('returns error when seriesId is missing', async () => {
      const result = await executeAction({
        action: 'series',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('series_info action', () => {
    test('routes to getFredSeriesInfo', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return jsonResponse({
          seriess: [{ id: 'GDP', title: 'Gross Domestic Product', frequency: 'Quarterly' }],
        });
      });

      const result = await executeAction({
        action: 'series_info',
        seriesId: 'ZZZFRED2',
      });

      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('api.stlouisfed.org/fred/series');
      expect(calledUrl).not.toContain('/observations');
      expect(calledUrl).not.toContain('/search');
      expect(calledUrl).toContain('series_id=ZZZFRED2');
      expect(parsed.data).toBeDefined();
    });

    test('returns error when seriesId is missing', async () => {
      const result = await executeAction({
        action: 'series_info',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('returns error when FRED_API_KEY is missing', async () => {
      delete process.env.FRED_API_KEY;

      const result = await executeAction({
        action: 'search',
        query: 'gdp',
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain('API key');
    });
  });
});
