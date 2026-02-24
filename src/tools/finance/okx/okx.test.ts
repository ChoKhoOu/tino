import { describe, test, expect, afterEach } from 'bun:test';
import { getKlines, getTicker, getFundingRate, getFundingRateHistory, getOrderBook } from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

function okxResp<T>(data: T) {
  return { code: '0', msg: '', data };
}

describe('OKX public client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  // ==========================================================================
  // Klines
  // ==========================================================================

  test('getKlines returns parsed kline data', async () => {
    const rawKline = [
      '1704067200000', '42000.00', '42500.00', '41800.00', '42300.00',
      '1500.5', '63000000.00', '63150000.00', '1',
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/candles');
      expect(urlStr).toContain('instId=BTC-USDT');
      expect(urlStr).toContain('bar=1H');
      return new Response(JSON.stringify(okxResp([rawKline])), { status: 200 });
    });

    const result = await getKlines('BTC-USDT', '1H');
    expect(result).toHaveLength(1);
    expect(result[0]!.ts).toBe(1704067200000);
    expect(result[0]!.open).toBe('42000.00');
    expect(result[0]!.close).toBe('42300.00');
    expect(result[0]!.vol).toBe('1500.5');
    expect(result[0]!.confirm).toBe('1');
  });

  test('getKlines passes pagination params', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('after=1000');
      expect(urlStr).toContain('before=2000');
      expect(urlStr).toContain('limit=50');
      return new Response(JSON.stringify(okxResp([])), { status: 200 });
    });
    const result = await getKlines('ETH-USDT', '5m', 1000, 2000, 50);
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Ticker
  // ==========================================================================

  test('getTicker returns single ticker by instId', async () => {
    const tickerData = {
      instType: 'SPOT',
      instId: 'BTC-USDT',
      last: '42300.00',
      lastSz: '0.01',
      askPx: '42310.00',
      askSz: '1.5',
      bidPx: '42290.00',
      bidSz: '2.0',
      open24h: '41800.00',
      high24h: '42500.00',
      low24h: '41700.00',
      volCcy24h: '1050000000.00',
      vol24h: '25000.00',
      ts: '1704067200000',
      sodUtc0: '41800.00',
      sodUtc8: '41900.00',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/ticker');
      expect(urlStr).toContain('instId=BTC-USDT');
      return new Response(JSON.stringify(okxResp([tickerData])), { status: 200 });
    });

    const result = await getTicker('BTC-USDT');
    expect(result).toHaveLength(1);
    expect(result[0]!.instId).toBe('BTC-USDT');
    expect(result[0]!.last).toBe('42300.00');
  });

  test('getTicker returns all SPOT tickers when no instId', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/tickers');
      expect(urlStr).toContain('instType=SPOT');
      return new Response(JSON.stringify(okxResp([])), { status: 200 });
    });

    const result = await getTicker();
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Funding Rate
  // ==========================================================================

  test('getFundingRate returns parsed funding rate', async () => {
    const frData = {
      instType: 'SWAP',
      instId: 'BTC-USDT-SWAP',
      fundingRate: '0.0001',
      nextFundingRate: '0.00015',
      fundingTime: '1704096000000',
      nextFundingTime: '1704124800000',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/public/funding-rate');
      expect(urlStr).toContain('instId=BTC-USDT-SWAP');
      return new Response(JSON.stringify(okxResp([frData])), { status: 200 });
    });

    const result = await getFundingRate('BTC-USDT-SWAP');
    expect(result.instId).toBe('BTC-USDT-SWAP');
    expect(result.fundingRate).toBe('0.0001');
    expect(result.nextFundingRate).toBe('0.00015');
  });

  test('getFundingRate throws when no data returned', async () => {
    mockFetch(async () => {
      return new Response(JSON.stringify(okxResp([])), { status: 200 });
    });

    expect(getFundingRate('INVALID-SWAP')).rejects.toThrow('No funding rate data');
  });

  // ==========================================================================
  // Funding Rate History
  // ==========================================================================

  test('getFundingRateHistory returns array of entries', async () => {
    const entries = [
      {
        instType: 'SWAP',
        instId: 'BTC-USDT-SWAP',
        fundingRate: '0.0001',
        realizedRate: '0.0001',
        fundingTime: '1704096000000',
      },
      {
        instType: 'SWAP',
        instId: 'BTC-USDT-SWAP',
        fundingRate: '0.00012',
        realizedRate: '0.00012',
        fundingTime: '1704067200000',
      },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/public/funding-rate-history');
      expect(urlStr).toContain('instId=BTC-USDT-SWAP');
      return new Response(JSON.stringify(okxResp(entries)), { status: 200 });
    });

    const result = await getFundingRateHistory('BTC-USDT-SWAP');
    expect(result).toHaveLength(2);
    expect(result[0]!.fundingRate).toBe('0.0001');
    expect(result[1]!.fundingRate).toBe('0.00012');
  });

  // ==========================================================================
  // Order Book
  // ==========================================================================

  test('getOrderBook returns parsed order book', async () => {
    const bookData = {
      asks: [['42310.00', '1.5', '0', '3'], ['42320.00', '2.0', '0', '5']],
      bids: [['42290.00', '2.0', '0', '4'], ['42280.00', '1.0', '0', '2']],
      ts: '1704067200000',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/books');
      expect(urlStr).toContain('instId=BTC-USDT');
      return new Response(JSON.stringify(okxResp([bookData])), { status: 200 });
    });

    const result = await getOrderBook('BTC-USDT');
    expect(result.asks).toHaveLength(2);
    expect(result.bids).toHaveLength(2);
    expect(result.asks[0]![0]).toBe('42310.00');
    expect(result.bids[0]![0]).toBe('42290.00');
    expect(result.ts).toBe('1704067200000');
  });

  test('getOrderBook passes sz param', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('sz=50');
      return new Response(JSON.stringify(okxResp([{ asks: [], bids: [], ts: '0' }])), { status: 200 });
    });

    const result = await getOrderBook('ETH-USDT', 50);
    expect(result.asks).toHaveLength(0);
  });

  // ==========================================================================
  // OKX Error Handling (code !== '0')
  // ==========================================================================

  test('throws on OKX API error response', async () => {
    mockFetch(async () => {
      return new Response(
        JSON.stringify({ code: '50011', msg: 'Invalid instId', data: [] }),
        { status: 200 }
      );
    });

    expect(getTicker('INVALID')).rejects.toThrow('Invalid instId');
  });
});
