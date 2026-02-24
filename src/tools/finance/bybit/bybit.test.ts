import { describe, test, expect, afterEach } from 'bun:test';
import { getKlines, getTicker, getFundingRate, getFundingRateHistory, getOrderBook } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

/** Wrap data in Bybit V5 response envelope. */
function bybitOk<T>(result: T) {
  return { retCode: 0, retMsg: 'OK', result };
}

describe('Bybit public client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  // ==========================================================================
  // Klines
  // ==========================================================================

  test('getKlines returns parsed kline data', async () => {
    const rawList = [
      ['1704067200000', '42000.00', '42500.00', '41800.00', '42300.00', '1500.5', '63000000.00'],
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/kline');
      expect(urlStr).toContain('symbol=BTCUSDT');
      expect(urlStr).toContain('interval=60');
      expect(urlStr).toContain('category=spot');
      return new Response(JSON.stringify(bybitOk({ symbol: 'BTCUSDT', category: 'spot', list: rawList })), { status: 200 });
    });

    const result = await getKlines('BTCUSDT', '60');
    expect(result).toHaveLength(1);
    expect(result[0]!.openTime).toBe(1704067200000);
    expect(result[0]!.open).toBe('42000.00');
    expect(result[0]!.close).toBe('42300.00');
    expect(result[0]!.volume).toBe('1500.5');
    expect(result[0]!.turnover).toBe('63000000.00');
  });

  test('getKlines uppercases symbol', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('symbol=ETHUSDT');
      return new Response(JSON.stringify(bybitOk({ symbol: 'ETHUSDT', category: 'spot', list: [] })), { status: 200 });
    });
    const result = await getKlines('ethusdt', 'D');
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Tickers
  // ==========================================================================

  test('getTicker returns ticker list', async () => {
    const ticker = {
      symbol: 'BTCUSDT',
      lastPrice: '42300.00',
      indexPrice: '42290.00',
      markPrice: '42295.00',
      prevPrice24h: '41800.00',
      price24hPcnt: '0.012',
      highPrice24h: '42500.00',
      lowPrice24h: '41700.00',
      prevPrice1h: '42200.00',
      volume24h: '25000.00',
      turnover24h: '1050000000.00',
      bid1Price: '42290.00',
      bid1Size: '2.0',
      ask1Price: '42310.00',
      ask1Size: '1.5',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/tickers');
      expect(urlStr).toContain('symbol=BTCUSDT');
      expect(urlStr).toContain('category=spot');
      return new Response(JSON.stringify(bybitOk({ category: 'spot', list: [ticker] })), { status: 200 });
    });

    const result = await getTicker('BTCUSDT');
    expect(result).toHaveLength(1);
    expect(result[0]!.symbol).toBe('BTCUSDT');
    expect(result[0]!.lastPrice).toBe('42300.00');
  });

  test('getTicker supports linear category', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('category=linear');
      return new Response(JSON.stringify(bybitOk({ category: 'linear', list: [] })), { status: 200 });
    });
    const result = await getTicker('BTCUSDT', 'linear');
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Funding Rate
  // ==========================================================================

  test('getFundingRate returns latest funding rate', async () => {
    const entry = { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingRateTimestamp: '1704067200000' };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/funding/history');
      expect(urlStr).toContain('category=linear');
      expect(urlStr).toContain('symbol=BTCUSDT');
      expect(urlStr).toContain('limit=1');
      return new Response(JSON.stringify(bybitOk({ category: 'linear', list: [entry] })), { status: 200 });
    });

    const result = await getFundingRate('BTCUSDT');
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.fundingRate).toBe('0.0001');
  });

  test('getFundingRate throws when no data', async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify(bybitOk({ category: 'linear', list: [] })), { status: 200 });
    });
    expect(getFundingRate('UNKNOWN')).rejects.toThrow('No funding rate data');
  });

  // ==========================================================================
  // Funding Rate History
  // ==========================================================================

  test('getFundingRateHistory returns entries', async () => {
    const entries = [
      { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingRateTimestamp: '1704067200000' },
      { symbol: 'BTCUSDT', fundingRate: '0.00015', fundingRateTimestamp: '1704038400000' },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/funding/history');
      expect(urlStr).toContain('symbol=BTCUSDT');
      return new Response(JSON.stringify(bybitOk({ category: 'linear', list: entries })), { status: 200 });
    });

    const result = await getFundingRateHistory('BTCUSDT');
    expect(result).toHaveLength(2);
    expect(result[0]!.fundingRate).toBe('0.0001');
    expect(result[1]!.fundingRate).toBe('0.00015');
  });

  // ==========================================================================
  // Order Book
  // ==========================================================================

  test('getOrderBook returns parsed order book', async () => {
    const raw = {
      s: 'BTCUSDT',
      a: [['42310.00', '1.5'], ['42320.00', '2.0']],
      b: [['42290.00', '2.0'], ['42280.00', '3.0']],
      ts: 1704067200000,
      u: 12345,
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/orderbook');
      expect(urlStr).toContain('symbol=BTCUSDT');
      expect(urlStr).toContain('category=spot');
      return new Response(JSON.stringify(bybitOk(raw)), { status: 200 });
    });

    const result = await getOrderBook('BTCUSDT');
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.asks).toHaveLength(2);
    expect(result.asks[0]!.price).toBe('42310.00');
    expect(result.asks[0]!.size).toBe('1.5');
    expect(result.bids).toHaveLength(2);
    expect(result.bids[0]!.price).toBe('42290.00');
    expect(result.timestamp).toBe(1704067200000);
    expect(result.updateId).toBe(12345);
  });

  // ==========================================================================
  // Error handling (retCode !== 0)
  // ==========================================================================

  test('throws on Bybit API error (retCode !== 0)', async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify({ retCode: 10001, retMsg: 'Invalid symbol', result: {} }), { status: 200 });
    });
    expect(getKlines('INVALID', '60')).rejects.toThrow('Invalid symbol');
  });
});
