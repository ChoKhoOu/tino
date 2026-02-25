/**
 * Type definitions for Bitget Public API V2 responses.
 *
 * Bitget V2 responses are wrapped in { code, msg, data }.
 * Docs: https://www.bitget.com/api-doc/
 */

/** Generic Bitget API response wrapper. */
export interface BitgetResponse<T> {
  code: string;
  msg: string;
  data: T;
  requestTime: number;
}

/**
 * Single kline/candlestick entry from GET /api/v2/spot/market/candles.
 *
 * Array format: [ts, open, high, low, close, volume, quoteVolume, usdtVolume]
 * All string values.
 */
export type BitgetKlineRaw = [string, string, string, string, string, string, string, string];

/** Parsed kline/candlestick entry. */
export interface BitgetKline {
  /** Timestamp in milliseconds */
  ts: number;
  /** Open price */
  open: string;
  /** Highest price */
  high: string;
  /** Lowest price */
  low: string;
  /** Close price */
  close: string;
  /** Trading volume in base currency */
  volume: string;
  /** Trading volume in quote currency */
  quoteVolume: string;
}

/** Ticker entry from GET /api/v2/spot/market/tickers. */
export interface BitgetTicker {
  symbol: string;
  lastPr: string;
  askPr: string;
  bidPr: string;
  high24h: string;
  low24h: string;
  baseVolume: string;
  quoteVolume: string;
  ts: string;
  change24h: string;
  open: string;
}

/** Funding rate from GET /api/v2/mix/market/current-fund-rate. */
export interface BitgetFundingRate {
  symbol: string;
  fundingRate: string;
}

/** Historical funding rate entry from GET /api/v2/mix/market/history-fund-rate. */
export interface BitgetFundingRateHistory {
  symbol: string;
  fundingRate: string;
  fundingTime: string;
}

/** Order book entry: [price, size]. */
export type BitgetBookEntry = [string, string];

/** Order book from GET /api/v2/spot/market/orderbook. */
export interface BitgetOrderBook {
  asks: BitgetBookEntry[];
  bids: BitgetBookEntry[];
  ts: string;
}
