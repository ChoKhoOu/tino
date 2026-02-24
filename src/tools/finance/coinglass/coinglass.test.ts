import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import {
  getFundingRates,
  getFundingRateHistory,
  getOpenInterest,
  getOpenInterestHistory,
  getLongShortRatio,
  getLiquidations,
  getLiquidationHistory,
  getFuturesPremium,
} from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

function coinglassResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ code: '0', msg: 'success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CoinGlass provider', () => {
  const originalFetch = globalThis.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.COINGLASS_API_KEY = 'test-cg-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  // ===========================================================================
  // Funding Rates
  // ===========================================================================

  describe('getFundingRates', () => {
    test('sends correct URL and auth header', async () => {
      let calledUrl = '';
      let calledHeaders: Record<string, string> = {};
      mockFetch(async (url, init) => {
        calledUrl = String(url);
        calledHeaders = Object.fromEntries(
          Object.entries((init as RequestInit)?.headers ?? {}),
        );
        return coinglassResponse([
          { exchange: 'Binance', symbol: 'BTCUSDT', fundingRate: 0.0001, nextFundingTime: 1706745600000 },
        ]);
      });

      const result = await getFundingRates('BTC');
      expect(calledUrl).toContain('open-api-v4.coinglass.com');
      expect(calledUrl).toContain('/api/futures/funding-rate/exchange-list');
      expect(calledUrl).toContain('symbol=BTC');
      expect(calledHeaders['CG-API-KEY']).toBe('test-cg-key');
      expect(result).toHaveLength(1);
      expect(result[0]!.exchange).toBe('Binance');
      expect(result[0]!.fundingRate).toBe(0.0001);
    });

    test('defaults to BTC when no symbol provided', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([]);
      });

      await getFundingRates();
      expect(calledUrl).toContain('symbol=BTC');
    });
  });

  describe('getFundingRateHistory', () => {
    test('returns parsed OHLC entries', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { t: 1636588800, o: '0.00196', h: '0.002647', l: '0.001631', c: '-0.000601' },
          { t: 1636675200, o: '0.00100', h: '0.001200', l: '0.000800', c: '0.001100' },
        ]);
      });

      const result = await getFundingRateHistory('Binance', 'BTCUSDT', '1d', 100);
      expect(calledUrl).toContain('exchange=Binance');
      expect(calledUrl).toContain('symbol=BTCUSDT');
      expect(calledUrl).toContain('interval=1d');
      expect(calledUrl).toContain('limit=100');
      expect(result).toHaveLength(2);
      expect(result[0]!.t).toBe(1636588800);
      expect(result[0]!.o).toBe('0.00196');
    });
  });

  // ===========================================================================
  // Open Interest
  // ===========================================================================

  describe('getOpenInterest', () => {
    test('returns exchange list data', async () => {
      mockFetch(async () =>
        coinglassResponse([
          { exchange: 'Binance', openInterest: 5000000000, openInterestAmount: 50000, changePercent24h: 2.5 },
          { exchange: 'OKX', openInterest: 3000000000, openInterestAmount: 30000, changePercent24h: -1.2 },
        ]),
      );

      const result = await getOpenInterest('ETH');
      expect(result).toHaveLength(2);
      expect(result[0]!.exchange).toBe('Binance');
      expect(result[0]!.openInterest).toBe(5000000000);
    });
  });

  describe('getOpenInterestHistory', () => {
    test('returns OHLC history', async () => {
      mockFetch(async () =>
        coinglassResponse([
          { time: 1706745600000, open: '2644845344', high: '2692643311', low: '2576975597', close: '2608846475' },
        ]),
      );

      const result = await getOpenInterestHistory('Binance', 'BTCUSDT');
      expect(result).toHaveLength(1);
      expect(result[0]!.time).toBe(1706745600000);
      expect(result[0]!.open).toBe('2644845344');
    });
  });

  // ===========================================================================
  // Long/Short Ratio
  // ===========================================================================

  describe('getLongShortRatio', () => {
    test('returns ratio history', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1706745600000, longRate: 0.52, shortRate: 0.48, longShortRatio: 1.083 },
          { time: 1706832000000, longRate: 0.49, shortRate: 0.51, longShortRatio: 0.961 },
        ]);
      });

      const result = await getLongShortRatio('Binance', 'BTCUSDT', '4h', 200);
      expect(calledUrl).toContain('global-long-short-account-ratio');
      expect(calledUrl).toContain('exchange=Binance');
      expect(calledUrl).toContain('interval=4h');
      expect(result).toHaveLength(2);
      expect(result[0]!.longRate).toBe(0.52);
      expect(result[1]!.longShortRatio).toBe(0.961);
    });
  });

  // ===========================================================================
  // Liquidation
  // ===========================================================================

  describe('getLiquidations', () => {
    test('returns exchange liquidation stats', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { exchange: 'All', liquidation_usd: 14673519.81, long_liquidation_usd: 451394.17, short_liquidation_usd: 14222125.64 },
          { exchange: 'Binance', liquidation_usd: 8000000, long_liquidation_usd: 300000, short_liquidation_usd: 7700000 },
        ]);
      });

      const result = await getLiquidations('BTC', '12h');
      expect(calledUrl).toContain('liquidation/exchange-list');
      expect(calledUrl).toContain('range=12h');
      expect(result).toHaveLength(2);
      expect(result[0]!.liquidation_usd).toBe(14673519.81);
    });
  });

  describe('getLiquidationHistory', () => {
    test('returns aggregated history', async () => {
      mockFetch(async () =>
        coinglassResponse([
          { time: 1658966400000, aggregated_long_liquidation_usd: 5916885.14, aggregated_short_liquidation_usd: 12969583.87 },
        ]),
      );

      const result = await getLiquidationHistory('BTC', '1d', 100);
      expect(result).toHaveLength(1);
      expect(result[0]!.aggregated_long_liquidation_usd).toBe(5916885.14);
    });
  });

  // ===========================================================================
  // Futures Premium
  // ===========================================================================

  describe('getFuturesPremium', () => {
    test('returns basis history', async () => {
      let calledUrl = '';
      mockFetch(async (url) => {
        calledUrl = String(url);
        return coinglassResponse([
          { time: 1706745600000, basis: 150, basisRate: 0.0015, futuresPrice: 100150, spotPrice: 100000 },
        ]);
      });

      const result = await getFuturesPremium('BTC', '4h', 200);
      expect(calledUrl).toContain('basis/history');
      expect(calledUrl).toContain('symbol=BTC');
      expect(calledUrl).toContain('interval=4h');
      expect(result).toHaveLength(1);
      expect(result[0]!.basisRate).toBe(0.0015);
      expect(result[0]!.futuresPrice).toBe(100150);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('error handling', () => {
    test('throws when API key is missing', async () => {
      delete process.env.COINGLASS_API_KEY;
      await expect(getFundingRates('BTC')).rejects.toThrow('Missing API key');
    });

    test('throws on CoinGlass API error response', async () => {
      mockFetch(async () =>
        new Response(
          JSON.stringify({ code: '50001', msg: 'Invalid API key', data: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(getFundingRates('BTC')).rejects.toThrow('Invalid API key');
    });

    test('throws on HTTP error', async () => {
      mockFetch(async () =>
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
      );

      await expect(getFundingRates('BTC')).rejects.toThrow('403');
    });
  });
});
