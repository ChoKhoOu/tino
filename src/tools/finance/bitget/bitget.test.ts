import { describe, test, expect } from 'bun:test';
import {
  toUnifiedTicker,
  toUnifiedKline,
  toUnifiedFundingRate,
  toUnifiedOrderBook,
} from './index.js';
import type {
  BitgetTicker,
  BitgetKline,
  BitgetFundingRate,
  BitgetOrderBook,
} from './types.js';

describe('Bitget unified type adapters', () => {
  test('toUnifiedTicker converts correctly', () => {
    const ticker: BitgetTicker = {
      symbol: 'BTCUSDT',
      lastPr: '65432.10',
      askPr: '65433.00',
      bidPr: '65431.00',
      high24h: '66000.00',
      low24h: '64000.00',
      baseVolume: '12345.678',
      quoteVolume: '800000000',
      ts: '1700000000000',
      change24h: '0.02',
      open: '64000.00',
    };

    const result = toUnifiedTicker(ticker);

    expect(result.exchange).toBe('bitget');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.baseAsset).toBe('BTC');
    expect(result.quoteAsset).toBe('USDT');
    expect(result.last).toBe(65432.10);
    expect(result.bid).toBe(65431.00);
    expect(result.ask).toBe(65433.00);
    expect(result.volume24h).toBe(12345.678);
    expect(result.timestamp).toBe(1700000000000);
  });

  test('toUnifiedKline converts correctly', () => {
    const kline: BitgetKline = {
      ts: 1700000000000,
      open: '65000.00',
      high: '66000.00',
      low: '64000.00',
      close: '65500.00',
      volume: '100.5',
      quoteVolume: '6550000',
    };

    const result = toUnifiedKline(kline, 'BTCUSDT', '1h');

    expect(result.exchange).toBe('bitget');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.interval).toBe('1h');
    expect(result.open).toBe(65000.00);
    expect(result.high).toBe(66000.00);
    expect(result.low).toBe(64000.00);
    expect(result.close).toBe(65500.00);
    expect(result.volume).toBe(100.5);
    expect(result.timestamp).toBe(1700000000000);
  });

  test('toUnifiedFundingRate converts correctly', () => {
    const fr: BitgetFundingRate = {
      symbol: 'BTCUSDT',
      fundingRate: '0.0001',
    };

    const result = toUnifiedFundingRate(fr);

    expect(result.exchange).toBe('bitget');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.rate).toBe(0.0001);
    expect(result.nextFundingTime).toBe(0);
    expect(result.markPrice).toBe(0);
    expect(result.indexPrice).toBe(0);
  });

  test('toUnifiedOrderBook converts correctly', () => {
    const book: BitgetOrderBook = {
      asks: [
        ['65433.00', '1.5'],
        ['65434.00', '2.0'],
      ],
      bids: [
        ['65431.00', '1.2'],
        ['65430.00', '3.0'],
      ],
      ts: '1700000000000',
    };

    const result = toUnifiedOrderBook(book, 'BTCUSDT');

    expect(result.exchange).toBe('bitget');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.asks).toEqual([
      [65433.00, 1.5],
      [65434.00, 2.0],
    ]);
    expect(result.bids).toEqual([
      [65431.00, 1.2],
      [65430.00, 3.0],
    ]);
    expect(result.timestamp).toBe(1700000000000);
  });

  test('toUnifiedTicker handles ETHUSDT', () => {
    const ticker: BitgetTicker = {
      symbol: 'ETHUSDT',
      lastPr: '3500.00',
      askPr: '3501.00',
      bidPr: '3499.00',
      high24h: '3600.00',
      low24h: '3400.00',
      baseVolume: '50000',
      quoteVolume: '175000000',
      ts: '1700000000000',
      change24h: '0.01',
      open: '3450.00',
    };

    const result = toUnifiedTicker(ticker);

    expect(result.symbol).toBe('ETH/USDT');
    expect(result.baseAsset).toBe('ETH');
    expect(result.quoteAsset).toBe('USDT');
    expect(result.last).toBe(3500.00);
  });

  test('toUnifiedKline handles ETHUSDC', () => {
    const kline: BitgetKline = {
      ts: 1700000000000,
      open: '3500.00',
      high: '3600.00',
      low: '3400.00',
      close: '3550.00',
      volume: '200',
      quoteVolume: '710000',
    };

    const result = toUnifiedKline(kline, 'ETHUSDC', '4h');

    expect(result.symbol).toBe('ETH/USDC');
    expect(result.interval).toBe('4h');
  });
});
