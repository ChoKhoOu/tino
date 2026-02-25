import { describe, test, expect, afterEach } from 'bun:test';
import {
  getKlines,
  getTicker,
  getFundingRate,
  getFundingRateHistory,
  getOrderBook,
  toUnifiedTicker,
  toUnifiedKline,
  toUnifiedFundingRate,
  toUnifiedOrderBook,
} from './index.js';

function mockFetch(fn: (...args: Parameters<typeof fetch>) => Promise<Response>): void {
  globalThis.fetch = Object.assign(fn, { preconnect: () => {} }) as typeof fetch;
}

describe('Gate.io public client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => { globalThis.fetch = originalFetch; });

  // ==========================================================================
  // Klines
  // ==========================================================================

  test('getKlines returns parsed kline data', async () => {
    const rawKline = [
      '1704067200', '63150000.00', '42300.00', '42500.00', '41800.00', '42000.00', '1500.5',
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/spot/candlesticks');
      expect(urlStr).toContain('currency_pair=BTC_USDT');
      expect(urlStr).toContain('interval=1h');
      return new Response(JSON.stringify([rawKline]), { status: 200 });
    });

    const result = await getKlines('BTC_USDT', '1h');
    expect(result).toHaveLength(1);
    expect(result[0]!.t).toBe(1704067200);
    expect(result[0]!.open).toBe('42000.00');
    expect(result[0]!.close).toBe('42300.00');
    expect(result[0]!.high).toBe('42500.00');
    expect(result[0]!.low).toBe('41800.00');
    expect(result[0]!.baseVolume).toBe('1500.5');
    expect(result[0]!.quoteVolume).toBe('63150000.00');
  });

  test('getKlines passes pagination params', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('from=1000');
      expect(urlStr).toContain('to=2000');
      expect(urlStr).toContain('limit=50');
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const result = await getKlines('ETH_USDT', '5m', 1000, 2000, 50);
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Ticker
  // ==========================================================================

  test('getTicker returns single ticker by currency pair', async () => {
    const tickerData = {
      currency_pair: 'BTC_USDT',
      last: '42300.00',
      lowest_ask: '42310.00',
      highest_bid: '42290.00',
      change_percentage: '1.19',
      base_volume: '25000.00',
      quote_volume: '1050000000.00',
      high_24h: '42500.00',
      low_24h: '41700.00',
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/spot/tickers');
      expect(urlStr).toContain('currency_pair=BTC_USDT');
      return new Response(JSON.stringify([tickerData]), { status: 200 });
    });

    const result = await getTicker('BTC_USDT');
    expect(result).toHaveLength(1);
    expect(result[0]!.currency_pair).toBe('BTC_USDT');
    expect(result[0]!.last).toBe('42300.00');
  });

  test('getTicker returns all tickers when no currency pair', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/spot/tickers');
      expect(urlStr).not.toContain('currency_pair');
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const result = await getTicker();
    expect(result).toHaveLength(0);
  });

  // ==========================================================================
  // Funding Rate
  // ==========================================================================

  test('getFundingRate returns futures contract with funding rate', async () => {
    const contractData = {
      name: 'BTC_USDT',
      funding_rate: '0.0001',
      funding_next_apply: 1704124800,
      mark_price: '42300.00',
      index_price: '42290.00',
      last_price: '42300.00',
      funding_rate_indicative: '0.00015',
      funding_interval: 28800,
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/futures/usdt/contracts/BTC_USDT');
      return new Response(JSON.stringify(contractData), { status: 200 });
    });

    const result = await getFundingRate('BTC_USDT');
    expect(result.name).toBe('BTC_USDT');
    expect(result.funding_rate).toBe('0.0001');
    expect(result.mark_price).toBe('42300.00');
  });

  // ==========================================================================
  // Funding Rate History
  // ==========================================================================

  test('getFundingRateHistory returns array of entries', async () => {
    const entries = [
      { t: 1704096000, r: '0.0001' },
      { t: 1704067200, r: '0.00012' },
    ];
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/futures/usdt/funding_rate');
      expect(urlStr).toContain('contract=BTC_USDT');
      return new Response(JSON.stringify(entries), { status: 200 });
    });

    const result = await getFundingRateHistory('BTC_USDT');
    expect(result).toHaveLength(2);
    expect(result[0]!.r).toBe('0.0001');
    expect(result[1]!.r).toBe('0.00012');
  });

  // ==========================================================================
  // Order Book
  // ==========================================================================

  test('getOrderBook returns parsed order book', async () => {
    const bookData = {
      id: 123456,
      current: 1704067200000,
      update: 1704067199000,
      asks: [['42310.00', '1.5'], ['42320.00', '2.0']],
      bids: [['42290.00', '2.0'], ['42280.00', '1.0']],
    };
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('/spot/order_book');
      expect(urlStr).toContain('currency_pair=BTC_USDT');
      return new Response(JSON.stringify(bookData), { status: 200 });
    });

    const result = await getOrderBook('BTC_USDT');
    expect(result.asks).toHaveLength(2);
    expect(result.bids).toHaveLength(2);
    expect(result.asks[0]![0]).toBe('42310.00');
    expect(result.bids[0]![0]).toBe('42290.00');
    expect(result.current).toBe(1704067200000);
  });

  test('getOrderBook passes limit param', async () => {
    mockFetch(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      expect(urlStr).toContain('limit=50');
      return new Response(JSON.stringify({ id: 0, current: 0, update: 0, asks: [], bids: [] }), { status: 200 });
    });

    const result = await getOrderBook('ETH_USDT', 50);
    expect(result.asks).toHaveLength(0);
  });

  // ==========================================================================
  // Unified type adapters
  // ==========================================================================

  test('toUnifiedTicker converts Gate.io ticker', () => {
    const ticker = {
      currency_pair: 'BTC_USDT',
      last: '42300.00',
      lowest_ask: '42310.00',
      highest_bid: '42290.00',
      change_percentage: '1.19',
      base_volume: '25000.00',
      quote_volume: '1050000000.00',
      high_24h: '42500.00',
      low_24h: '41700.00',
    };
    const unified = toUnifiedTicker(ticker);
    expect(unified.exchange).toBe('gate');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.baseAsset).toBe('BTC');
    expect(unified.quoteAsset).toBe('USDT');
    expect(unified.last).toBe(42300);
    expect(unified.bid).toBe(42290);
    expect(unified.ask).toBe(42310);
    expect(unified.volume24h).toBe(25000);
  });

  test('toUnifiedKline converts Gate.io kline', () => {
    const kline = {
      t: 1704067200,
      quoteVolume: '63150000.00',
      close: '42300.00',
      high: '42500.00',
      low: '41800.00',
      open: '42000.00',
      baseVolume: '1500.5',
    };
    const unified = toUnifiedKline(kline, 'BTC_USDT', '1h');
    expect(unified.exchange).toBe('gate');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.interval).toBe('1h');
    expect(unified.open).toBe(42000);
    expect(unified.close).toBe(42300);
    expect(unified.volume).toBe(1500.5);
    expect(unified.timestamp).toBe(1704067200000); // seconds → ms
  });

  test('toUnifiedFundingRate converts Gate.io futures contract', () => {
    const contract = {
      name: 'BTC_USDT',
      funding_rate: '0.0001',
      funding_next_apply: 1704124800,
      mark_price: '42300.00',
      index_price: '42290.00',
      last_price: '42300.00',
      funding_rate_indicative: '0.00015',
      funding_interval: 28800,
    };
    const unified = toUnifiedFundingRate(contract);
    expect(unified.exchange).toBe('gate');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.rate).toBe(0.0001);
    expect(unified.nextFundingTime).toBe(1704124800000); // seconds → ms
    expect(unified.markPrice).toBe(42300);
    expect(unified.indexPrice).toBe(42290);
  });

  test('toUnifiedOrderBook converts Gate.io order book', () => {
    const book = {
      id: 123456,
      current: 1704067200000,
      update: 1704067199000,
      asks: [['42310.00', '1.5'], ['42320.00', '2.0']] as [string, string][],
      bids: [['42290.00', '2.0'], ['42280.00', '1.0']] as [string, string][],
    };
    const unified = toUnifiedOrderBook(book, 'BTC_USDT');
    expect(unified.exchange).toBe('gate');
    expect(unified.symbol).toBe('BTC/USDT');
    expect(unified.bids[0]).toEqual([42290, 2.0]);
    expect(unified.asks[0]).toEqual([42310, 1.5]);
    expect(unified.timestamp).toBe(1704067200000);
  });
});
