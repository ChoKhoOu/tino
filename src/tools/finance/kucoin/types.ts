/**
 * Type definitions for KuCoin Public API v1 responses.
 *
 * All KuCoin responses are wrapped in { code, data }.
 * Docs: https://docs.kucoin.com/
 */

/** Generic KuCoin API response wrapper. */
export interface KucoinResponse<T> {
  code: string;
  data: T;
}

/**
 * Single kline/candlestick entry (parsed from array format).
 *
 * KuCoin returns: [time(s), open, close, high, low, volume, turnover]
 * Note: order is open, close, high, low — not the typical OHLC.
 */
export interface KucoinKline {
  /** Timestamp in seconds */
  ts: number;
  /** Open price */
  open: string;
  /** Close price */
  close: string;
  /** Highest price */
  high: string;
  /** Lowest price */
  low: string;
  /** Trading volume in base currency */
  volume: string;
  /** Turnover in quote currency */
  turnover: string;
}

/** 24h ticker data from GET /api/v1/market/stats. */
export interface KucoinTicker {
  symbol: string;
  buy: string;
  sell: string;
  last: string;
  vol: string;
  volValue: string;
  high: string;
  low: string;
  time: number;
  changeRate: string;
  changePrice: string;
}

/** All tickers wrapper from GET /api/v1/market/allTickers. */
export interface KucoinAllTickersData {
  time: number;
  ticker: KucoinTicker[];
}

/** Order book entry: [price, size]. */
export type KucoinBookEntry = [string, string];

/** Order book from GET /api/v1/market/orderbook/level2_20. */
export interface KucoinOrderBook {
  sequence: string;
  time: number;
  bids: KucoinBookEntry[];
  asks: KucoinBookEntry[];
}
