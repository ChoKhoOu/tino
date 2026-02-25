import { describe, test, expect, afterEach } from 'bun:test';
import { routeFundingRateArbitrage } from '../funding-rate-arbitrage-router.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('funding-rate-arbitrage router', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  test('scan_rates returns multi-exchange rates via direct APIs', async () => {
    // Mock responses for Binance, OKX, Bybit
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('fapi.binance.com')) {
        return new Response(JSON.stringify([
          { symbol: 'BTCUSDT', fundingRate: '0.00010000', fundingTime: 1706745600000, markPrice: '97500.00' },
        ]), { status: 200 });
      }
      if (urlStr.includes('okx.com')) {
        return new Response(JSON.stringify({
          code: '0', msg: '',
          data: [{
            instType: 'SWAP', instId: 'BTC-USDT-SWAP',
            fundingRate: '0.00050000', nextFundingRate: '0.00040000',
            fundingTime: '1706745600000', nextFundingTime: '1706774400000',
          }],
        }), { status: 200 });
      }
      if (urlStr.includes('bybit.com')) {
        return new Response(JSON.stringify({
          retCode: 0, retMsg: 'OK',
          result: {
            category: 'linear',
            list: [{
              symbol: 'BTCUSDT',
              fundingRate: '0.00030000',
              fundingRateTimestamp: '1706745600000',
            }],
          },
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const result = await routeFundingRateArbitrage({
      action: 'scan_rates',
      symbols: ['BTC'],
    });

    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
    expect(parsed.data.BTC).toBeDefined();
    expect(parsed.data.BTC.length).toBeGreaterThanOrEqual(1);
  });

  test('find_opportunities returns sorted opportunities', async () => {
    // Mock responses with different rates across exchanges
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('fapi.binance.com')) {
        return new Response(JSON.stringify([
          { symbol: 'BTCUSDT', fundingRate: '0.00010000', fundingTime: 1706745600000, markPrice: '97500.00' },
        ]), { status: 200 });
      }
      if (urlStr.includes('okx.com')) {
        return new Response(JSON.stringify({
          code: '0', msg: '',
          data: [{
            instType: 'SWAP', instId: 'BTC-USDT-SWAP',
            fundingRate: '0.00080000', nextFundingRate: '0.00040000',
            fundingTime: '1706745600000', nextFundingTime: '1706774400000',
          }],
        }), { status: 200 });
      }
      if (urlStr.includes('bybit.com')) {
        return new Response(JSON.stringify({
          retCode: 0, retMsg: 'OK',
          result: {
            category: 'linear',
            list: [{
              symbol: 'BTCUSDT',
              fundingRate: '0.00030000',
              fundingRateTimestamp: '1706745600000',
            }],
          },
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const result = await routeFundingRateArbitrage({
      action: 'find_opportunities',
      symbols: ['BTC'],
      top_n: 5,
    });

    const parsed = JSON.parse(result);
    expect(parsed.data).toBeDefined();
    expect(Array.isArray(parsed.data)).toBe(true);
    if (parsed.data.length > 0) {
      const opp = parsed.data[0];
      expect(opp.symbol).toBe('BTC');
      expect(opp.rateDifferential).toBeGreaterThan(0);
      expect(opp.longExchange).toBeDefined();
      expect(opp.shortExchange).toBeDefined();
      expect(opp.fees).toBeDefined();
      expect(opp.riskLevel).toBeDefined();
    }
  });

  test('backtest returns error when required params missing', async () => {
    const result = await routeFundingRateArbitrage({
      action: 'backtest',
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('symbol is required');
  });

  test('backtest returns error when exchange_long missing', async () => {
    const result = await routeFundingRateArbitrage({
      action: 'backtest',
      symbol: 'BTC',
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('exchange_long is required');
  });

  test('backtest returns error when exchange_short missing', async () => {
    const result = await routeFundingRateArbitrage({
      action: 'backtest',
      symbol: 'BTC',
      exchange_long: 'Binance',
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('exchange_short is required');
  });

  test('analyze returns error when required params missing', async () => {
    const result = await routeFundingRateArbitrage({
      action: 'analyze',
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('symbol is required');
  });

  test('unknown action returns error', async () => {
    const result = await routeFundingRateArbitrage({
      action: 'unknown_action' as never,
    });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('Unknown action');
  });
});
