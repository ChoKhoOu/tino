/**
 * Type definitions for Bybit V5 public REST API responses.
 *
 * All Bybit V5 responses are wrapped in a common envelope:
 *   { retCode: number, retMsg: string, result: { ... } }
 *
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */

/** Common Bybit V5 API response envelope. */
export interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

/** Single kline/candlestick entry parsed from GET /v5/market/kline */
export interface BybitKline {
  /** Open time in milliseconds */
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  turnover: string;
}

/** Raw kline list result from Bybit API. */
export interface BybitKlineResult {
  symbol: string;
  category: string;
  list: string[][];
}

/** 24h ticker entry from GET /v5/market/tickers */
export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  indexPrice: string;
  markPrice: string;
  prevPrice24h: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice1h: string;
  volume24h: string;
  turnover24h: string;
  bid1Price: string;
  bid1Size: string;
  ask1Price: string;
  ask1Size: string;
}

/** Raw ticker list result from Bybit API. */
export interface BybitTickerResult {
  category: string;
  list: BybitTicker[];
}

/** Funding rate entry from GET /v5/market/funding/history */
export interface BybitFundingRate {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

/** Raw funding rate list result from Bybit API. */
export interface BybitFundingRateResult {
  category: string;
  list: BybitFundingRate[];
}

/** Order book entry (price + size). */
export interface BybitOrderBookLevel {
  price: string;
  size: string;
}

/** Order book from GET /v5/market/orderbook */
export interface BybitOrderBook {
  symbol: string;
  asks: BybitOrderBookLevel[];
  bids: BybitOrderBookLevel[];
  timestamp: number;
  updateId: number;
}

/** Raw order book result from Bybit API. */
export interface BybitOrderBookRaw {
  s: string;
  a: string[][];
  b: string[][];
  ts: number;
  u: number;
}
