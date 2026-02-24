import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { rmSync, readdirSync, existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

function coinglassResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ code: '0', msg: 'success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clearTestCache(): void {
  const cacheDir = '.tino/cache';
  if (!existsSync(cacheDir)) return;
  for (const entry of readdirSync(cacheDir)) {
    const entryPath = join(cacheDir, entry);
    if (entry.includes('ZZZ') || entry.includes('zzz') || entry.includes('coinglass')) {
      rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    if (!statSync(entryPath).isDirectory()) continue;
    for (const file of readdirSync(entryPath)) {
      const content = readFileSync(join(entryPath, file), 'utf-8');
      if (content.includes('ZZZ') || content.includes('zzz') || content.includes('coinglass')) {
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

describe('crypto_derivatives consolidated tool', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    clearTestCache();
    process.env.COINGLASS_API_KEY = 'test-cg-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  async function executeAction(params: Record<string, unknown>): Promise<string> {
    const mod = await import('../../consolidated/crypto-derivatives.tool.js');
    return mod.default.execute(params, stubCtx);
  }

  test('exports correct plugin metadata', async () => {
    const mod = await import('../../consolidated/crypto-derivatives.tool.js');
    const plugin = mod.default;
    expect(plugin.id).toBe('crypto_derivatives');
    expect(plugin.domain).toBe('finance');
    expect(plugin.riskLevel).toBe('safe');
    expect(plugin.schema).toBeDefined();
  });

  describe('funding_rates action', () => {
    test('routes to CoinGlass getFundingRates', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { exchange: 'Binance', symbol: 'ZZZUSDT', fundingRate: 0.0001, nextFundingTime: 1706745600000 },
        ]);
      });

      const result = await executeAction({ action: 'funding_rates', symbol: 'ZZZ' });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('funding-rate/exchange-list');
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].exchange).toBe('Binance');
    });
  });

  describe('funding_rate_history action', () => {
    test('routes to CoinGlass getFundingRateHistory', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { t: 1636588800, o: '0.00196', h: '0.002647', l: '0.001631', c: '-0.000601' },
        ]);
      });

      const result = await executeAction({
        action: 'funding_rate_history',
        exchange: 'ZZZExchange',
        symbol: 'ZZZFRH',
        interval: '1d',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('funding-rate/history');
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].t).toBe(1636588800);
    });

    test('returns error when exchange is missing', async () => {
      const result = await executeAction({
        action: 'funding_rate_history',
        symbol: 'BTCUSDT',
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('exchange is required');
    });
  });

  describe('open_interest action', () => {
    test('routes to CoinGlass getOpenInterest', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { exchange: 'Binance', openInterest: 5000000000, openInterestAmount: 50000 },
        ]);
      });

      const result = await executeAction({ action: 'open_interest', symbol: 'ZZZOI' });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('openInterest/exchange-list');
      expect(parsed.data).toHaveLength(1);
    });
  });

  describe('open_interest_history action', () => {
    test('routes to CoinGlass getOpenInterestHistory', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1706745600000, open: '2644845344', high: '2692643311', low: '2576975597', close: '2608846475' },
        ]);
      });

      const result = await executeAction({
        action: 'open_interest_history',
        exchange: 'ZZZExchange',
        symbol: 'ZZZOIH',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('open-interest/history');
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].time).toBe(1706745600000);
    });

    test('returns error when exchange is missing', async () => {
      const result = await executeAction({
        action: 'open_interest_history',
        symbol: 'BTCUSDT',
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('exchange is required');
    });
  });

  describe('long_short_ratio action', () => {
    test('routes to CoinGlass getLongShortRatio', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1706745600000, longRate: 0.52, shortRate: 0.48, longShortRatio: 1.083 },
        ]);
      });

      const result = await executeAction({
        action: 'long_short_ratio',
        exchange: 'ZZZExchange',
        symbol: 'ZZZLSR',
        interval: '4h',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('global-long-short-account-ratio');
      expect(parsed.data[0].longShortRatio).toBe(1.083);
    });

    test('returns error when exchange is missing', async () => {
      const result = await executeAction({
        action: 'long_short_ratio',
        symbol: 'BTCUSDT',
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('exchange is required');
    });
  });

  describe('liquidations action', () => {
    test('routes to CoinGlass getLiquidations', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { exchange: 'All', liquidation_usd: 14673519.81, long_liquidation_usd: 451394.17, short_liquidation_usd: 14222125.64 },
        ]);
      });

      const result = await executeAction({
        action: 'liquidations',
        symbol: 'ZZZLIQ',
        range: '12h',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('liquidation/exchange-list');
      expect(calledUrl).toContain('range=12h');
      expect(parsed.data[0].liquidation_usd).toBe(14673519.81);
    });
  });

  describe('liquidation_history action', () => {
    test('routes to CoinGlass getLiquidationHistory', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1658966400000, aggregated_long_liquidation_usd: 5916885.14, aggregated_short_liquidation_usd: 12969583.87 },
        ]);
      });

      const result = await executeAction({
        action: 'liquidation_history',
        symbol: 'ZZZLQH',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('liquidation/aggregated-history');
      expect(parsed.data[0].aggregated_long_liquidation_usd).toBe(5916885.14);
    });

    test('returns error when symbol is missing', async () => {
      const result = await executeAction({ action: 'liquidation_history' });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('symbol is required');
    });
  });

  describe('futures_premium action', () => {
    test('routes to CoinGlass getFuturesPremium', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1706745600000, basis: 150, basisRate: 0.0015, futuresPrice: 100150, spotPrice: 100000 },
        ]);
      });

      const result = await executeAction({
        action: 'futures_premium',
        symbol: 'ZZZFP',
        interval: '4h',
      });
      const parsed = JSON.parse(result);
      expect(calledUrl).toContain('basis/history');
      expect(parsed.data[0].basisRate).toBe(0.0015);
    });

    test('returns error when symbol is missing', async () => {
      const result = await executeAction({ action: 'futures_premium' });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('symbol is required');
    });
  });

  describe('error handling', () => {
    test('returns error for missing API key', async () => {
      delete process.env.COINGLASS_API_KEY;
      const result = await executeAction({ action: 'funding_rates' });
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain('Missing API key');
    });

    test('throws on unknown action (Zod validation)', async () => {
      await expect(executeAction({ action: 'unknown_action' })).rejects.toThrow();
    });
  });
});
