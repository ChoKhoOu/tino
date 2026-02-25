import { describe, test, expect, afterEach } from 'bun:test';
import {
  getKlines,
  getTicker,
  getOrderBook,
  toUnifiedTicker,
  toUnifiedKline,
  toUnifiedOrderBook,
} from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

function kucoinResp<T>(data: T) {
  return { code: '200000', data };
}

describe('KuCoin public client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  // ==========================================================================
  // Klines
  // ==========================================================================

  test('getKlines returns parsed kline data', async () => {
    // KuCoin kline: [time(s), open, close, high, low, volume, turnover]
    const rawKline = [
      '1704067200', '42000.00', '42300.00', '42500.00', '41800.00',
      '1500.5', '63150000.00',
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/candles');
      expect(urlStr).toContain('symbol=BTC-USDT');
      expect(urlStr).toContain('type=1hour');
      return new Response(JSON.stringify(kucoinResp([rawKline])), { status: 200 });
    });

    const result = await getKlines('BTC-USDT', '1hour');
    expect(result).toHaveLength(1);
    expect(result[0]!.ts).toBe(1704067200);
    expect(result[0]!.open).toBe('42000.00');
    expect(result[0]!.close).toBe('42300.00');
    expect(result[0]!.high).toBe('42500.00');
    expect(result[0]!.low).toBe('41800.00');
    expect(result[0]!.volume).toBe('1500.5');
    expect(result[0]!.turnover).toBe('63150000.00');
  });

  test('getKlines passes time params', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('startAt=1000');
      expect(urlStr).toContain('endAt=2000');
      return new Response(JSON.stringify(kucoinResp([])), { status: 200 });
    });
    const result = await getKlines('ETH-USDT', '5min', 1000, 2000);
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Ticker
  // ==========================================================================

  test('getTicker returns single ticker by symbol', async () => {
    const tickerData = {
      symbol: 'BTC-USDT',
      buy: '42290.00',
      sell: '42310.00',
      last: '42300.00',
      vol: '25000.00',
      volValue: '1050000000.00',
      high: '42500.00',
      low: '41700.00',
      time: 1704067200000,
      changeRate: '0.012',
      changePrice: '500.00',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/stats');
      expect(urlStr).toContain('symbol=BTC-USDT');
      return new Response(JSON.stringify(kucoinResp(tickerData)), { status: 200 });
    });

    const result = await getTicker('BTC-USDT');
    expect(result).toHaveLength(1);
    expect(result[0]!.symbol).toBe('BTC-USDT');
    expect(result[0]!.last).toBe('42300.00');
  });

  test('getTicker returns all tickers when no symbol', async () => {
    const allTickersData = {
      time: 1704067200000,
      ticker: [
        {
          symbol: 'BTC-USDT',
          buy: '42290.00',
          sell: '42310.00',
          last: '42300.00',
          vol: '25000.00',
          volValue: '1050000000.00',
          high: '42500.00',
          low: '41700.00',
          time: 1704067200000,
          changeRate: '0.012',
          changePrice: '500.00',
        },
      ],
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/allTickers');
      return new Response(JSON.stringify(kucoinResp(allTickersData)), { status: 200 });
    });

    const result = await getTicker();
    expect(result).toHaveLength(1);
    expect(result[0]!.symbol).toBe('BTC-USDT');
  });

  // ==========================================================================
  // Order Book
  // ==========================================================================

  test('getOrderBook returns parsed order book', async () => {
    const bookData = {
      sequence: '3262786978',
      time: 1704067200000,
      bids: [['42290.00', '2.0'], ['42280.00', '1.0']],
      asks: [['42310.00', '1.5'], ['42320.00', '2.0']],
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/market/orderbook/level2_20');
      expect(urlStr).toContain('symbol=BTC-USDT');
      return new Response(JSON.stringify(kucoinResp(bookData)), { status: 200 });
    });

    const result = await getOrderBook('BTC-USDT');
    expect(result.asks).toHaveLength(2);
    expect(result.bids).toHaveLength(2);
    expect(result.asks[0]![0]).toBe('42310.00');
    expect(result.bids[0]![0]).toBe('42290.00');
    expect(result.time).toBe(1704067200000);
    expect(result.sequence).toBe('3262786978');
  });

  // ==========================================================================
  // KuCoin Error Handling (code !== '200000')
  // ==========================================================================

  test('throws on KuCoin API error response', async () => {
    mockFetch(async () => {
      return new Response(
        JSON.stringify({ code: '400100', data: null }),
        { status: 200 }
      );
    });

    await expect(getTicker('INVALID')).rejects.toThrow('failed');
  });

  // ==========================================================================
  // Unified type adapters
  // ==========================================================================

  test('toUnifiedTicker converts correctly', () => {
    const ticker = {
      symbol: 'BTC-USDT',
      buy: '42290.00',
      sell: '42310.00',
      last: '42300.00',
      vol: '25000.00',
      volValue: '1050000000.00',
      high: '42500.00',
      low: '41700.00',
      time: 1704067200000,
      changeRate: '0.012',
      changePrice: '500.00',
    };
    const unified = toUnifiedTicker(ticker);
    expect(unified.exchange).toBe('kucoin');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.baseAsset).toBe('BTC');
    expect(unified.quoteAsset).toBe('USDT');
    expect(unified.last).toBe(42300);
    expect(unified.bid).toBe(42290);
    expect(unified.ask).toBe(42310);
    expect(unified.volume24h).toBe(25000);
    expect(unified.timestamp).toBe(1704067200000);
  });

  test('toUnifiedKline converts correctly', () => {
    const kline = {
      ts: 1704067200,
      open: '42000.00',
      close: '42300.00',
      high: '42500.00',
      low: '41800.00',
      volume: '1500.5',
      turnover: '63150000.00',
    };
    const unified = toUnifiedKline(kline, 'BTC-USDT', '1hour');
    expect(unified.exchange).toBe('kucoin');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.interval).toBe('1hour');
    expect(unified.open).toBe(42000);
    expect(unified.high).toBe(42500);
    expect(unified.low).toBe(41800);
    expect(unified.close).toBe(42300);
    expect(unified.volume).toBe(1500.5);
    expect(unified.timestamp).toBe(1704067200);
  });

  test('toUnifiedOrderBook converts correctly', () => {
    const book = {
      sequence: '3262786978',
      time: 1704067200000,
      bids: [['42290.00', '2.0'], ['42280.00', '1.0']] as [string, string][],
      asks: [['42310.00', '1.5'], ['42320.00', '2.0']] as [string, string][],
    };
    const unified = toUnifiedOrderBook(book, 'BTC-USDT');
    expect(unified.exchange).toBe('kucoin');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.bids).toEqual([[42290, 2], [42280, 1]]);
    expect(unified.asks).toEqual([[42310, 1.5], [42320, 2]]);
    expect(unified.timestamp).toBe(1704067200000);
  });
});
